import { Injectable, InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TenantContextService } from '../../database/tenant-context.service';
import { AttendanceFactorTypeEntity, RawIdentificationEventEntity } from '../../database/entities';
import { QueueService } from '../../queue/queue.service';
import { IdentifyEventJobData, IDENTIFY_EVENT_QUEUE } from '../identification/identify-event.job';
import { InstitutionalNetworkService } from '../institutional-network/institutional-network.service';
import { LocationConsentService } from '../location-consent/location-consent.service';
import { LocationVerificationService } from '../location-verification/location-verification.service';
import { APP_CHECKIN_FACTOR_CODE } from '../attendance-factor-codes';
import { AppCheckinDto } from './dto/app-checkin.dto';

export interface AppCheckinResult {
  created: boolean;
  // null exclusively for the two "no pipeline event exists at all" cases:
  // RULE-PRES-14/15's consent routing and RULE-PRES-01's rede/geo AND gate
  // (see the three-gate block in submit() below) — both intentionally reuse
  // the SAME created:false/eventId:null shape the idempotency-duplicate path
  // already had, so AppCheckinController's existing `created ? 201 : 200`
  // logic already does the right thing (200 OK, "login funciona
  // normalmente") without any controller change.
  eventId: string | null;
}

type ClassSessionResolution =
  | { outcome: 'resolved'; classSessionId: string }
  | { outcome: 'none' }
  | { outcome: 'ambiguous'; classSessionIds: string[] };

// RULE-ATT-06's confirmed note: the app check-in submission path is a
// person-JWT-authenticated capability, structurally distinct from the
// device-authenticated ingestion contract (IngestionService) — but it feeds
// the exact same downstream pipeline. This service replicates ONLY the
// Ingestion Gateway's hand-off (validate → durably insert into
// raw_identification_event via the SAME transactional-outbox
// insert-or-ignore-then-enqueue pattern IngestionService uses → enqueue
// IDENTIFY_EVENT_QUEUE), not the device-specific parts around it (no
// DeviceAuthGuard, no roomId). Factor type and person are resolved here
// (trivial — a static platform-standard code and the caller's own JWT
// identity); class session is resolved here too, since app check-in has no
// room signal for IdentificationService to key off of (RULE-ATT-06's
// confirmed resolution strategy: caller's active enrollments + the session
// currently in progress). Everything after the raw event is inserted —
// Identification's factor/person/session correlation for THIS event type,
// Deduplication, the Motor de Regras — is the unmodified existing pipeline;
// see IdentificationService's APP_CHECKIN_FACTOR_CODE branches.
//
// Security/code-review finding + user decision (2026-08-22): session
// resolution used to be keyed off a client-supplied `capturedAt`, with no
// bound on how far in the past it could be — any enrolled student could
// back-date a check-in to any past session they'd actually skipped, just by
// claiming a timestamp inside that session's scheduled window. Decided fix:
// no tolerance — check-in must be effectively real-time. The class session
// is now resolved exclusively from the SERVER's own request-received clock
// (`new Date()` taken at the top of submit(), below), never from anything
// the client sends. Accepted consequence: a check-in queued offline and only
// delivered to the server after its class session has ended will now
// legitimately 422 below (no active session) — that is intentional, not a
// regression to work around.
//
// RULE-PRES-01/02/14 ("Decisão de arquitetura — Fluxo de Chamada
// Redesenhado", architecture-overview.md's "Implementação — room-presence e
// integração dos três gates"): three checks now run before any of the above,
// in AND estrito, nunca fundidos numa única primitiva:
// 1. LocationConsentService.hasActiveConsent — checked FIRST and is NOT one
//    of the two AND'd anti-fraud gates below; it's a ROUTING decision, not a
//    gate failure (RULE-PRES-14's own wording: "não é uma falha de gate
//    igual às outras duas"). A student without active consent is
//    permanently blocked from this login+localização path (RULE-PRES-14) —
//    routed to RULE-PRES-15's caminho alternativo (room-presence/tag alone,
//    see that module) — so rede/geo are never even evaluated for them.
// 2. InstitutionalNetworkService.isWithinInstitutionalNetwork (rede) — same
//    primitive/posture already used for GAP-10 (device-binding).
// 3. LocationVerificationService.isWithinInstitutionalRadius (geo) — new
//    this round.
// Any one of 2/3 failing (or coordinates being entirely absent — DTO makes
// them optional for the RULE-PRES-15 caller, see AppCheckinDto's own
// comment, so a present-but-consenting caller missing them fails this gate
// the same fail-closed way an out-of-radius coordinate would) reuses the
// EXACT same "endpoint responds success, no pipeline event" behavior
// InstitutionalNetworkService's GAP-10 caller already has — see
// AppCheckinResult's own comment for why no controller change is needed.
// RULE-PRES-01's own text: "nenhuma trilha de auditoria" for a failed
// attempt — nothing about any of these three gates is persisted here.
@Injectable()
export class AppCheckinService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly queue: QueueService,
    private readonly institutionalNetworkService: InstitutionalNetworkService,
    private readonly locationVerificationService: LocationVerificationService,
    private readonly locationConsentService: LocationConsentService,
  ) {}

  async submit(personId: string, dto: AppCheckinDto, sourceIp: string): Promise<AppCheckinResult> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // RULE-PRES-14/15: routing decision, checked before — and independently
    // of — the rede/geo AND below (see this class's own top-of-file
    // comment).
    const hasLocationConsent = await this.locationConsentService.hasActiveConsent(personId);
    if (!hasLocationConsent) {
      return { created: false, eventId: null };
    }

    // RULE-PRES-01: rede + geolocalização, AND estrito, never fused into one
    // combined check — each is independently capable of catching a
    // different fraud vector (see that rule's own rationale), so both are
    // always evaluated (no short-circuit) purely so the reasoning stays
    // legible; the outcome only ever needs the conjunction.
    const withinNetwork = await this.institutionalNetworkService.isWithinInstitutionalNetwork(tenantId, sourceIp);
    const withinRadius =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? await this.locationVerificationService.isWithinInstitutionalRadius(tenantId, {
            latitude: dto.latitude,
            longitude: dto.longitude,
          })
        : false;
    if (!withinNetwork || !withinRadius) {
      return { created: false, eventId: null };
    }

    // The server's own request-received timestamp — see this class's
    // top-of-file comment. Never derived from anything in `dto`; this is the
    // one and only clock session resolution and the raw event's captured_at
    // are keyed off.
    const serverReceivedAt = new Date();

    const resolution = await this.resolveActiveClassSession(personId, serverReceivedAt);
    if (resolution.outcome === 'none') {
      throw new UnprocessableEntityException(
        'No class session is currently in progress for any of your enrolled classes at this time.',
      );
    }
    if (resolution.outcome === 'ambiguous') {
      // Gap — "Sobreposição de turmas simultâneas no check-in via app"
      // (pending-decisions.md): the user has NOT confirmed what should
      // happen when two enrolled sessions are in progress at once. This is
      // a deliberate, clearly-flagged stopgap — reject and ask for
      // disambiguation — rather than guessing "apply to both" or "first
      // found". Revisit once real business behavior is confirmed.
      throw new UnprocessableEntityException(
        'More than one of your enrolled class sessions is in progress right now; automatic check-in cannot ' +
          'disambiguate between them yet (unconfirmed business behavior — see pending-decisions.md).',
      );
    }

    const factorType = await manager
      .getRepository(AttendanceFactorTypeEntity)
      .findOneBy({ code: APP_CHECKIN_FACTOR_CODE, tenantId: IsNull() });
    if (!factorType) {
      // Expected to always exist (seeded by SeedAppCheckinFactorType,
      // RULE-ATT-01/06) — its absence is a deployment/migration problem,
      // never something the caller did wrong.
      throw new InternalServerErrorException('APP_CHECKIN attendance factor type is not registered for this platform');
    }

    const rawPayload: Record<string, unknown> = {
      // Server-derived (see serverReceivedAt above), not client-supplied —
      // populates the same raw_payload.capturedAt field the device-originated
      // path (IngestionService) populates from its envelope, so downstream
      // (IdentificationService's checkinAt, Deduplication, Motor de Regras)
      // keeps working unmodified.
      capturedAt: serverReceivedAt.toISOString(),
      roomId: null,
      data: { personId, classSessionId: resolution.classSessionId },
    };

    // Same transactional-outbox insert-or-ignore pattern as
    // IngestionService.ingest: the job only becomes durable if this
    // transaction commits, and idempotencyKey's existing
    // UNIQUE(tenant_id, idempotency_key) constraint (ScopeIdempotencyKeyToTenant)
    // is reused as-is — this row lives on the same raw_identification_event
    // table, so no new constraint is needed.
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(RawIdentificationEventEntity)
      .values({
        tenantId,
        deviceId: null,
        eventType: APP_CHECKIN_FACTOR_CODE,
        idempotencyKey: dto.idempotencyKey,
        rawPayload,
      } as QueryDeepPartialEntity<RawIdentificationEventEntity>)
      .orIgnore()
      .returning(['id'])
      .execute();

    const insertedId = insertResult.identifiers[0]?.id as string | undefined;
    if (insertedId) {
      const jobData: IdentifyEventJobData = { rawEventId: insertedId, tenantId };
      await this.queue.sendWithManager(IDENTIFY_EVENT_QUEUE, jobData, manager);
      return { created: true, eventId: insertedId };
    }

    // idempotency_key already existed for this tenant (RULE-ATT-10,
    // first-valid-submission wins) — same resend-tolerance semantics as
    // IngestionService.ingest, deliberately NOT re-run through resolution
    // above first: this mirrors the existing device path's ordering
    // trade-off (envelope validated before the duplicate check there too),
    // not a new inconsistency introduced here.
    const existing = await manager.getRepository(RawIdentificationEventEntity).findOneBy({
      idempotencyKey: dto.idempotencyKey,
    });
    if (!existing) {
      throw new InternalServerErrorException('idempotency_key conflict could not be resolved for this tenant');
    }
    return { created: false, eventId: existing.id };
  }

  // RULE-ATT-06's confirmed note: resolves the class session automatically
  // from the caller's own active class_group_enrollment rows + the session
  // whose scheduled window contains the current moment — no manual session
  // selection, no room signal at all (unlike device check-in's room+time
  // resolution in IdentificationService.resolveClassSession). `serverNow` is
  // ALWAYS this service's own server-clock reading (see submit() above),
  // never anything client-supplied — that is the whole point of this fix
  // (see top-of-file comment): authorization/session-resolution must not be
  // steerable by a value the caller controls.
  private async resolveActiveClassSession(personId: string, serverNow: Date): Promise<ClassSessionResolution> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows: Array<{ id: string }> = await manager.query(
      `
      SELECT cs.id
      FROM class_group_enrollment cge
      JOIN class_session cs ON cs.class_group_id = cge.class_group_id
      WHERE cge.tenant_id = $1
        AND cge.person_id = $2
        AND cs.scheduled_start <= $3::timestamptz
        AND cs.scheduled_end >= $3::timestamptz
      `,
      [tenantId, personId, serverNow.toISOString()],
    );

    if (rows.length === 0) {
      return { outcome: 'none' };
    }
    if (rows.length > 1) {
      return { outcome: 'ambiguous', classSessionIds: rows.map((row) => row.id) };
    }
    return { outcome: 'resolved', classSessionId: rows[0].id };
  }
}
