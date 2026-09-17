import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ClassSessionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { APP_CHECKIN_FACTOR_CODE } from '../attendance-factor-codes';
import { RoomPresenceService } from '../room-presence/room-presence.service';

// RULE-PRES-11: "5 pessoas ou mais, confirmada em duas contagens
// consecutivas" — fixed by the rule's own text ("Creio que a partir de 5"),
// not a tenant-configurable value (same status as the camera's own 15-minute
// capture interval — architecture-overview.md, "Padrão arquitetural
// aplicado": "intervalo fixo por regra de negócio, não configuração").
const DIVERGENCE_ALERT_THRESHOLD_PEOPLE = 5;

const CANCELLED_SESSION_STATUS = 'cancelled';

export interface ClassroomHeadcountWindow {
  // The camera reading's own captured_at (raw_identification_event.raw_payload
  // ->>'capturedAt') — this window's identity. Not the job's wall-clock call
  // time (see the class-level header for why).
  capturedAt: Date;
  cameraCount: number;
  appCheckinCount: number;
  roomPresenceCount: number;
  // Largest absolute difference among the three numbers above (RULE-PRES-10's
  // "cruza três números" / RULE-PRES-11's "diferença entre os números
  // cruzados") — see the class-level header for why this is pairwise across
  // all three, not just camera-vs-others.
  maxDivergence: number;
}

export interface ClassroomHeadcountReconciliationResult {
  classSessionId: string;
  // False whenever the session isn't currently running (RULE-PRES-10 only
  // ever applies "durante a aula") — windows is always empty in that case,
  // and no camera/app-checkin/room-presence query is even attempted.
  inProgress: boolean;
  // Null when inProgress is false, or when the session's effective room
  // couldn't be resolved (defensive — RULE-INST rules already guarantee a
  // room in the normal case).
  roomId: string | null;
  // Most recent windows examined, most recent first — length 0 (no camera
  // reading yet for this room/session), 1 (only one reading so far, RULE-
  // PRES-11's "duas contagens consecutivas" can't be confirmed yet), or 2.
  // Never more than 2: a third reading would confirm or refute the SAME
  // divergence the two most recent already settle, RULE-PRES-11 asks for no
  // more than that.
  windows: ClassroomHeadcountWindow[];
  // RULE-PRES-11: true only when exactly the two most recent windows both
  // reached the threshold. A single confirmed window, however large, never
  // alerts alone.
  alertActive: boolean;
}

// "classroom-headcount-reconciliation" (Bloco 4, RULE-PRES-10/11/12;
// architecture-overview.md, "Decisão de arquitetura — Fluxo de Chamada
// Redesenhado", Estrutura proposta item 4; consolidated in
// .doc/checkclass-arquitetura-chamada.html, "Como O Dado Flui — BLOCO 4").
// Job de tempo, mesma família de attendance-retention (Frente 10): no
// scheduler/cron/queue lives here, real periodic invocation (RULE-SEC-05/
// PRES-11's fixed 15-minute cadence) is a DevOps decision — see
// src/scripts/classroom-headcount-reconciliation-check.ts.
//
// ENTIRELY READ-ONLY, deliberately, and not just against the three tables
// the task explicitly named (session_attendance_consolidation,
// attendance_pending_review, room_presence_event) — this service issues NO
// write of any kind, anywhere, ever. That is also how "confirmada em duas
// contagens consecutivas" (RULE-PRES-11) is implemented: rather than
// persisting this job's own cross-run state (which window fired last time),
// each evaluation looks at the TWO MOST RECENT CAMERA_COUNT raw events
// already sitting in raw_identification_event for the session's room, and
// recomputes app-checkin/room-presence counts AS OF each of those two
// readings' own capturedAt — i.e. "as the room actually stood at the moment
// of that specific camera reading", not at whatever instant this job happens
// to run. Two real camera readings ARE "duas contagens consecutivas";
// nothing else needs to be remembered between runs. This sidesteps a genuine
// gap (no existing table is a natural home for cross-run alert state, and
// deciding new persistent schema is Database Agent's call, not this agent's
// — see the Backend Implementation Summary for this round) while still
// satisfying the rule's literal text, and keeps this job re-runnable/
// idempotent for free: running it twice in a row against the same data
// always produces the same verdict.
//
// The "alert" itself has two channels, both computed from the exact same
// evaluateSession() below, never duplicated logic: the CLI script's own
// console output (an observable event per run, same idiom as
// attendance-retention's reporting), and a live self-service read for the
// professor (GET /v1/me/class-sessions/:id/headcount-alert, self-service
// module) — reusing the Portal de Autoatendimento Web's existing HTTP
// surface rather than standing up a new notification channel, per the
// architecture's own instruction ("reusando a superfície de notificação/
// pendência já existente — não é canal novo").
@Injectable()
export class ClassroomHeadcountReconciliationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly roomPresenceService: RoomPresenceService,
  ) {}

  // Auto-discovers every session currently in progress for this tenant and
  // evaluates each — same "one CLI invocation covers everything eligible
  // right now" idiom as AbsenceJustificationAttachmentService.sweepDueAttachments,
  // as opposed to session:evaluate's "caller names one session" idiom (which
  // doesn't fit here: nothing external enumerates "sessions in progress" for
  // this job to be pointed at).
  async evaluateInProgressSessions(): Promise<ClassroomHeadcountReconciliationResult[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows: Array<{ id: string }> = await manager.query(
      `
      SELECT id FROM class_session
      WHERE tenant_id = $1 AND status <> $2 AND scheduled_start <= $3 AND scheduled_end > $3
      `,
      [tenantId, CANCELLED_SESSION_STATUS, new Date().toISOString()],
    );

    const results: ClassroomHeadcountReconciliationResult[] = [];
    for (const row of rows) {
      results.push(await this.evaluateSession(row.id));
    }
    return results;
  }

  // Single-session entry point — also the one GET /v1/me/class-sessions/:id/
  // headcount-alert calls directly (after its own teacher-authorization
  // check), so the periodic job and the professor's live read are always
  // looking at literally the same computation.
  async evaluateSession(classSessionId: string): Promise<ClassroomHeadcountReconciliationResult> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId, tenantId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }

    if (!this.isInProgress(session)) {
      return { classSessionId, inProgress: false, roomId: null, windows: [], alertActive: false };
    }

    const roomId = await this.resolveEffectiveRoomId(manager, tenantId, classSessionId);
    if (!roomId) {
      return { classSessionId, inProgress: true, roomId: null, windows: [], alertActive: false };
    }

    const cameraReadings = await this.findRecentCameraReadings(manager, tenantId, roomId, session);
    const windows: ClassroomHeadcountWindow[] = [];
    for (const reading of cameraReadings) {
      const appCheckinCount = await this.countAppCheckinSatisfiedAsOf(manager, tenantId, classSessionId, reading.capturedAt);
      const roomPresenceCount = await this.roomPresenceService.countActiveInRoom(classSessionId, reading.capturedAt);
      windows.push({
        capturedAt: reading.capturedAt,
        cameraCount: reading.count,
        appCheckinCount,
        roomPresenceCount,
        maxDivergence: this.maxPairwiseDivergence(reading.count, appCheckinCount, roomPresenceCount),
      });
    }

    const alertActive = windows.length === 2 && windows.every((window) => window.maxDivergence >= DIVERGENCE_ALERT_THRESHOLD_PEOPLE);

    return { classSessionId, inProgress: true, roomId, windows, alertActive };
  }

  // scheduled_end is exclusive on purpose (>), matching class_session's own
  // "definitivamente terminou" boundary AttendanceRulesEngineService.evaluateSession
  // uses (`new Date() < session.scheduledEnd` blocks evaluation there) — a
  // session is "em andamento" up to and not including the instant it ends.
  private isInProgress(session: ClassSessionEntity): boolean {
    if (session.status === CANCELLED_SESSION_STATUS) {
      return false;
    }
    const now = new Date();
    return session.scheduledStart <= now && now < session.scheduledEnd;
  }

  // RULE-INST-07's COALESCE(class_session.room_id, class_group.room_id) —
  // the SAME effective-room resolution IdentificationService.resolveClassSession
  // and ScheduleConflictDetectionService already use, not a third
  // implementation of it.
  private async resolveEffectiveRoomId(
    manager: EntityManager,
    tenantId: string,
    classSessionId: string,
  ): Promise<string | null> {
    const rows: Array<{ roomId: string | null }> = await manager.query(
      `
      SELECT COALESCE(cs.room_id, cg.room_id) AS "roomId"
      FROM class_session cs
      JOIN class_group cg ON cg.id = cs.class_group_id
      WHERE cs.id = $1 AND cs.tenant_id = $2
      `,
      [classSessionId, tenantId],
    );
    return rows[0]?.roomId ?? null;
  }

  // The two MOST RECENT CAMERA_COUNT raw events for this room, bounded to
  // this session's own [scheduled_start, scheduled_end] window — a reading
  // captured before this session started (leftover from whatever used the
  // room right before) or after it ended must never be attributed to this
  // session. capturedAt/count both live inside raw_payload jsonb (see
  // raw-identification-event.entity.ts's own comment on why capturedAt isn't
  // a promoted column yet) — read here via ->> /->, same idiom already used
  // for envelope.data.count in event-data.validator.ts.
  private async findRecentCameraReadings(
    manager: EntityManager,
    tenantId: string,
    roomId: string,
    session: ClassSessionEntity,
  ): Promise<Array<{ capturedAt: Date; count: number }>> {
    const rows: Array<{ capturedAt: Date; count: number }> = await manager.query(
      `
      SELECT
        (raw_payload->>'capturedAt')::timestamptz AS "capturedAt",
        (raw_payload->'data'->>'count')::int AS "count"
      FROM raw_identification_event
      WHERE tenant_id = $1
        AND event_type = 'CAMERA_COUNT'
        AND raw_payload->>'roomId' = $2
        AND (raw_payload->>'capturedAt')::timestamptz >= $3
        AND (raw_payload->>'capturedAt')::timestamptz <= $4
      ORDER BY (raw_payload->>'capturedAt')::timestamptz DESC
      LIMIT 2
      `,
      [tenantId, roomId, session.scheduledStart.toISOString(), session.scheduledEnd.toISOString()],
    );
    return rows;
  }

  // RULE-PRES-05's own composite ("identification_checkin AND room-presence")
  // is deliberately NOT reused here — that check only makes sense once a
  // session has ended (AttendanceRulesEngineService only ever runs it after
  // scheduled_end) and folds in RULE-PRES-15's consent-based routing, which
  // is about who is EXEMPT from being required to satisfy the factor, not
  // about how many people the camera should currently be seeing in the room.
  // "Contagem de fatores APP_CHECKIN satisfeitos", read literally per this
  // round's task, is simpler and mid-session-safe: a plain count of
  // non-duplicate APP_CHECKIN identification_checkin rows for this session,
  // as of a given instant — the same satisfiedCodes membership test every
  // other factor gets in the rules engine, without the composite/consent
  // layers that only apply at final evaluation time.
  private async countAppCheckinSatisfiedAsOf(
    manager: EntityManager,
    tenantId: string,
    classSessionId: string,
    asOf: Date,
  ): Promise<number> {
    const rows: Array<{ count: string }> = await manager.query(
      `
      SELECT COUNT(DISTINCT ic.person_id) AS count
      FROM identification_checkin ic
      JOIN attendance_factor_type aft ON aft.id = ic.attendance_factor_type_id
      WHERE ic.tenant_id = $1 AND ic.class_session_id = $2 AND ic.is_duplicate = false
        AND aft.code = $3 AND ic.checkin_at <= $4
      `,
      [tenantId, classSessionId, APP_CHECKIN_FACTOR_CODE, asOf.toISOString()],
    );
    return Number(rows[0]?.count ?? 0);
  }

  // RULE-PRES-10's "cruza três números" / RULE-PRES-11's "diferença entre os
  // números cruzados": read as the divergence among ALL THREE numbers
  // pairwise, not just camera-vs-the-other-two. RULE-PRES-11's own worked
  // example is the textual evidence for this reading — "30 logins, 25 tags"
  // is called out as "problema real" with the camera not even mentioned,
  // which only makes sense if a login/tag mismatch alone can trigger the
  // same alert a camera/tag or camera/login mismatch would.
  private maxPairwiseDivergence(cameraCount: number, appCheckinCount: number, roomPresenceCount: number): number {
    return Math.max(
      Math.abs(cameraCount - appCheckinCount),
      Math.abs(cameraCount - roomPresenceCount),
      Math.abs(appCheckinCount - roomPresenceCount),
    );
  }
}
