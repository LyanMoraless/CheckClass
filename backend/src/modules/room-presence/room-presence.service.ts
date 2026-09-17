import { Injectable, Logger } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  AttendanceFactorTypeEntity,
  ClassSessionEntity,
  IdentificationCheckinEntity,
  RawLocationSignalEntity,
  RoomPresenceEventEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LocationVerificationService } from '../location-verification/location-verification.service';

const ROOM_ENTRY_FACTOR_CODE = 'ROOM_ENTRY';
const ROOM_EXIT_FACTOR_CODE = 'ROOM_EXIT';

export interface SessionProjectedInterval {
  closedIntervals: Array<{ entryAt: Date; exitAt: Date }>;
  hasOpenInterval: boolean;
  // Present only when hasOpenInterval is true — PresenceIntervalService needs
  // this to persist the open row's own entry_at (presence_interval keeps one
  // row per interval, closed or not); isPresentForSession/evaluatePerson
  // callers never need it, hence not folded into the closedIntervals/
  // hasOpenInterval pair the architecture names as "mesmo contrato de saída".
  openIntervalEntryAt: Date | null;
}

// "room-presence" (RULE-PRES-04/05/06/07/08,
// attendance-presence-flow-rules.md; "Decisão de arquitetura — Fluxo de
// Chamada Redesenhado", architecture-overview.md; .doc/checkclass-
// arquitetura-chamada.html, "Onde Fica Cada Lógica"). Structural precedent:
// device-binding (Frente 12) — a dedicated read primitive that owns its own
// state (room_presence_event) and is read by the Motor de Regras, never the
// reverse; never writes to identification_checkin.
//
// Write path (recordFromCheckin) is invoked by DeduplicationWorker right
// after DeduplicationService.deduplicate() resolves a checkin's final
// is_duplicate state, inside the SAME tenant transaction (see that worker's
// own comment) — "pós-dedup" cashes out concretely to "re-read the checkin
// AFTER deduplicate() ran", not a second queue/consumer.
@Injectable()
export class RoomPresenceService {
  private readonly logger = new Logger(RoomPresenceService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly locationVerificationService: LocationVerificationService,
  ) {}

  // Consumes identification_checkin post-dedup (is_duplicate = false),
  // ROOM_ENTRY/ROOM_EXIT only, already resolved to a class_session
  // (IdentificationService.resolveClassSession already enforces "leitor da
  // própria sala", RULE-PRES-04, upstream — see AddRoomPresenceEvent
  // migration's own header for why room_id is deliberately not repeated
  // here). A checkin that doesn't meet all of these produces no row — never
  // an error, since "this checkin isn't room-presence's concern" is the
  // overwhelmingly common case (every other factor type, every duplicate).
  async recordFromCheckin(checkinId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const checkin = await manager.getRepository(IdentificationCheckinEntity).findOneBy({ id: checkinId, tenantId });
    if (!checkin) {
      this.logger.warn(`Checkin ${checkinId} not found for tenant ${tenantId} — nothing for room-presence to record`);
      return;
    }
    if (checkin.isDuplicate) {
      return;
    }
    if (!checkin.classSessionId) {
      return;
    }

    const factorType = await manager
      .getRepository(AttendanceFactorTypeEntity)
      .findOneBy({ id: checkin.attendanceFactorTypeId });
    if (factorType?.code !== ROOM_ENTRY_FACTOR_CODE && factorType?.code !== ROOM_EXIT_FACTOR_CODE) {
      return;
    }
    const direction = factorType.code === ROOM_ENTRY_FACTOR_CODE ? 'entry' : 'exit';

    // Same transactional-outbox-adjacent insert-or-ignore pattern as
    // IdentificationService/AppCheckinService: identification_checkin_id's
    // own UNIQUE constraint (AddRoomPresenceEvent migration) makes this
    // idempotent against a redelivered DEDUPLICATE_CHECKIN_QUEUE job for
    // free, without room-presence needing its own dedup logic.
    await manager
      .createQueryBuilder()
      .insert()
      .into(RoomPresenceEventEntity)
      .values({
        tenantId,
        personId: checkin.personId,
        classSessionId: checkin.classSessionId,
        direction,
        identificationCheckinId: checkin.id,
        occurredAt: checkin.checkinAt,
      } as QueryDeepPartialEntity<RoomPresenceEventEntity>)
      .orIgnore()
      .execute();
  }

  // RULE-PRES-05: "em sala" is a pré-requisito for the login/APP_CHECKIN
  // factor, not a continuous real-time state — evaluateSession only ever
  // runs after scheduled_end (AttendanceRulesEngineService's own guard), by
  // which point a genuinely present student has almost always already
  // tagged back out. "Cobrindo a sessão" is read here as "the tag proved
  // this person was in this session's room at least once", i.e. at least one
  // 'entry' row exists — matching RULE-PRES-04's own wording ("Passar a tag
  // no leitor de uma sala marca o aluno como 'em sala'").
  async isPresentForSession(personId: string, classSessionId: string): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const entryCount = await manager
      .getRepository(RoomPresenceEventEntity)
      .count({ where: { tenantId, personId, classSessionId, direction: 'entry' } });
    return entryCount > 0;
  }

  // Same output contract PresenceIntervalService.rebuildForPerson already
  // produces from identification_checkin today (closedIntervals/
  // hasOpenInterval) plus openIntervalEntryAt (see that field's own comment)
  // — PresenceIntervalService consumes this in place of its old direct query
  // for ROOM_ENTRY/ROOM_EXIT specifically, unchanged for every other factor.
  //
  // Implements RULE-PRES-08's exit-precedence chain. Ergonomia de
  // implementação (não decisão de negócio, "Perguntas Em Aberto" do
  // documento de arquitetura): mora aqui, dentro de room-presence, em vez de
  // dentro de PresenceIntervalService — room-presence já é quem lê
  // location-verification para RULE-PRES-09 e já é dono do dado próprio de
  // prioridade 1 (o tag-out), então resolver a precedência inteira aqui
  // mantém PresenceIntervalService cego a de onde um "exit" veio (tag,
  // afastamento, ou nenhum) — ele só persiste o que este método já decidiu.
  async getSessionProjectedInterval(personId: string, classSessionId: string): Promise<SessionProjectedInterval> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows = await manager.getRepository(RoomPresenceEventEntity).find({
      where: { tenantId, personId, classSessionId },
      order: { occurredAt: 'ASC' },
    });

    const closedIntervals: Array<{ entryAt: Date; exitAt: Date }> = [];
    let openEntryAt: Date | null = null;

    for (const row of rows) {
      if (row.direction === 'entry') {
        if (openEntryAt) {
          this.logger.warn(
            `Two consecutive room_presence_event entries for person ${personId} in session ${classSessionId} — treating the later one as the active entry`,
          );
        }
        openEntryAt = row.occurredAt;
      } else {
        if (openEntryAt) {
          closedIntervals.push({ entryAt: openEntryAt, exitAt: row.occurredAt });
          openEntryAt = null;
        } else {
          this.logger.warn(
            `room_presence_event exit with no preceding entry for person ${personId} in session ${classSessionId} — ignored, can't pair`,
          );
        }
      }
    }

    if (openEntryAt === null) {
      // RULE-PRES-08 priority 1: every entry already has its own tag-out.
      return { closedIntervals, hasOpenInterval: false, openIntervalEntryAt: null };
    }

    const priorityTwoExitAt = await this.resolvePriorityTwoExitAt(tenantId, personId, classSessionId);
    if (priorityTwoExitAt) {
      closedIntervals.push({ entryAt: openEntryAt, exitAt: priorityTwoExitAt });
      return { closedIntervals, hasOpenInterval: false, openIntervalEntryAt: null };
    }

    // RULE-PRES-08 priority 3: no source at all — stays open. Same
    // missing_exit/pendência path AttendanceRulesEngineService already
    // applies today for an unmatched ROOM_ENTRY, no new mechanism.
    return { closedIntervals, hasOpenInterval: true, openIntervalEntryAt: openEntryAt };
  }

  // RULE-PRES-08 priority 2, mão única leitura (room-presence never writes
  // to location-verification or vice versa): afastamento prolongado
  // (location-verification) OR explicit app logout — first available wins;
  // the rule states these as one tier, not two sub-priorities, and in
  // practice at most one will ever be available for a given open interval.
  private async resolvePriorityTwoExitAt(
    tenantId: string,
    personId: string,
    classSessionId: string,
  ): Promise<Date | null> {
    const explicitLogoutAt = this.resolveExplicitLogoutAt();
    if (explicitLogoutAt) {
      return explicitLogoutAt;
    }
    return this.resolveDepartureExitAt(tenantId, personId, classSessionId);
  }

  // Reuses LocationVerificationService.evaluateDepartureFromClassLocation
  // (RULE-PRES-09) rather than re-walking raw_location_signal a second time
  // — same primitive the app's live afastamento monitor will call, applied
  // here retroactively at session-evaluation time instead of in real time.
  // `coordinates` is fed the LAST persisted class_monitoring reading's own
  // position (if any exists at all) — evaluateDepartureFromClassLocation
  // then walks the SAME history backward from there to find when the
  // sustained departure actually began, exactly as it already does for a
  // live caller; passing that reading's own coordinates back into itself is
  // not circular, it's how a retroactive caller without a live GPS fix asks
  // "as of the last thing we ever heard from this person, were they
  // departed, and since when". `asOfDate: session.scheduledEnd` caps the
  // elapsed-minutes computation at the session's own end instead of
  // evaluateSession's wall-clock call time (which can run long after
  // scheduled_end) — without this cap, a departure that started 5 minutes
  // before class ended but got evaluated hours later would wrongly read as
  // "prolonged", when in-class it never crossed the threshold.
  private async resolveDepartureExitAt(tenantId: string, personId: string, classSessionId: string): Promise<Date | null> {
    const manager = this.tenantContext.getManager();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId, tenantId });
    if (!session) {
      return null;
    }

    const latestReading = await manager.getRepository(RawLocationSignalEntity).findOne({
      where: { tenantId, personId, classSessionId, signalType: 'class_monitoring' },
      order: { capturedAt: 'DESC' },
    });
    if (!latestReading) {
      // No location signal has ever been ingested for this session — either
      // the app's monitor never ran (e.g. this person is on RULE-PRES-15's
      // caminho alternativo, consent refused, and by construction never
      // produces this signal — see that rule's own "nota de implicação") or
      // ingestion simply hasn't happened yet. Either way, nothing to
      // evaluate; falls through to priority 3, never fabricates a departure.
      return null;
    }

    const evaluation = await this.locationVerificationService.evaluateDepartureFromClassLocation(
      tenantId,
      personId,
      classSessionId,
      { latitude: Number(latestReading.latitude), longitude: Number(latestReading.longitude) },
      session.scheduledEnd,
    );
    return evaluation.prolongedDepartureDetected ? evaluation.departureStartedAt : null;
  }

  // RULE-PRES-08 priority 2's second leg ("logout explícito do app" — "o
  // aluno apertou 'sair'"). FLAGGED, not decided here: no backend signal
  // exists yet for this today. mobile-auth's own logout()/refresh-token
  // revocation (auth/refresh-token.service.ts) is a DIFFERENT, JWT-session-
  // lifecycle concept that also fires on ordinary token ROTATION (every
  // refresh, many times a day) — not just an explicit "sair da aula" tap —
  // so reusing revokedAt here would misattribute routine token refreshes as
  // RULE-PRES-08 exits. A real signal (a class-session-scoped "explicit
  // leave" action) needs to be designed alongside the App Mobile round that
  // builds it; until then this always returns null, correctly falling
  // through to priority 3 (open interval / missing_exit pending review),
  // never fabricating an exit from an unrelated signal.
  private resolveExplicitLogoutAt(): Date | null {
    return null;
  }
}
