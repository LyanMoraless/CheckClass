import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  AttendancePendingReviewEntity,
  ClassGroupEnrollmentEntity,
  ClassSessionEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { PresenceIntervalService } from './presence-interval.service';

type PendingReason = 'missing_factor' | 'missing_exit';

interface RequiredFactorRow {
  attendance_factor_type_id: string;
  code: string;
}

interface SatisfiedFactorRow {
  code: string;
}

// "Motor de Regras de Presença" (architecture-overview.md): applies
// RULE-ATT-04/07/08/09. Never decides on incomplete data — a session can
// only be evaluated once it has actually ended, since a required factor or
// exit that hasn't arrived yet might still be a late device retry, not truly
// absent (that's exactly why RULE-ATT-07/09 route to pending review instead
// of guessing).
//
// Interpretation, not explicit in the source rules: RULE-ATT-04's percentage
// gate only applies when permanência is actually being tracked END TO END —
// both ROOM_ENTRY and ROOM_EXIT required for this session's config. Entries
// only ever close into a countable interval once a matching exit exists, so
// requiring entry without exit would silently floor everyone's duration to 0.
// An institution that doesn't require both has no reliable duration signal
// to gate on, so presence there reduces to "were the required factors
// satisfied".
@Injectable()
export class AttendanceRulesEngineService {
  private readonly logger = new Logger(AttendanceRulesEngineService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly presenceIntervalService: PresenceIntervalService,
  ) {}

  async evaluateSession(classSessionId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }
    if (new Date() < session.scheduledEnd) {
      throw new BadRequestException(
        `class_session ${classSessionId} has not ended yet (scheduled_end=${session.scheduledEnd.toISOString()}) — a required factor or exit still has time to arrive`,
      );
    }

    const requiredFactors: RequiredFactorRow[] = await manager.query(
      `
      SELECT csrf.attendance_factor_type_id, aft.code
      FROM class_session_required_factor csrf
      JOIN attendance_factor_type aft ON aft.id = csrf.attendance_factor_type_id
      WHERE csrf.tenant_id = $1 AND csrf.class_session_id = $2
      `,
      [tenantId, classSessionId],
    );
    const requiredCodes = new Set(requiredFactors.map((f) => f.code));
    const roomEntryRequired = requiredCodes.has('ROOM_ENTRY');
    const roomExitRequired = requiredCodes.has('ROOM_EXIT');

    const roster = await manager.getRepository(ClassGroupEnrollmentEntity).findBy({
      classGroupId: session.classGroupId,
      role: 'student',
    });

    const sessionDurationMinutes = (session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60000;

    for (const enrollment of roster) {
      await this.evaluatePerson(session, enrollment.personId, requiredCodes, roomEntryRequired, roomExitRequired, sessionDurationMinutes);
    }
  }

  private async evaluatePerson(
    session: ClassSessionEntity,
    personId: string,
    requiredCodes: Set<string>,
    roomEntryRequired: boolean,
    roomExitRequired: boolean,
    sessionDurationMinutes: number,
  ): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // Code review finding: re-evaluating a session (a retry, a re-run of
    // session:evaluate) must never overwrite a human's explicit decision —
    // architecture-overview.md is explicit that resolution "flui de volta
    // para Consolidação... nunca gerada pelo motor". A resolved consolidation
    // row (resolved_by_person_id set, via PendingReviewService) is final.
    const existingConsolidation = await manager
      .getRepository(SessionAttendanceConsolidationEntity)
      .findOneBy({ classSessionId: session.id, personId });
    if (existingConsolidation?.resolvedByPersonId) {
      this.logger.log(
        `Skipping re-evaluation for person ${personId} in session ${session.id} — already resolved by a human`,
      );
      return;
    }

    const satisfiedRows: SatisfiedFactorRow[] = await manager.query(
      `
      SELECT DISTINCT aft.code
      FROM identification_checkin ic
      JOIN attendance_factor_type aft ON aft.id = ic.attendance_factor_type_id
      WHERE ic.tenant_id = $1 AND ic.class_session_id = $2 AND ic.person_id = $3 AND ic.is_duplicate = false
      `,
      [tenantId, session.id, personId],
    );
    const satisfiedCodes = new Set(satisfiedRows.map((r) => r.code));
    // ROOM_EXIT is deliberately excluded here: whether it's missing is
    // decided exclusively by the open-interval check below (RULE-ATT-09),
    // which is more specific than the generic "factor never seen" case
    // (RULE-ATT-07) — an entry with no exit must never be reported as a
    // plain missing_factor, even though a naive satisfied-codes check would
    // also technically call ROOM_EXIT "unsatisfied" here.
    const missingFactorCodes = [...requiredCodes].filter((code) => code !== 'ROOM_EXIT' && !satisfiedCodes.has(code));

    // Attempted regardless of whether entry/exit are required — if the
    // checkins exist, we use them; RULE-ATT-08 always sums whatever real
    // intervals occurred.
    const { closedIntervals, hasOpenInterval } = await this.presenceIntervalService.rebuildForPerson(session.id, personId);

    if (missingFactorCodes.length > 0) {
      await this.recordPending(session, personId, 'missing_factor');
      return;
    }
    if (roomExitRequired && hasOpenInterval) {
      // RULE-ATT-09: an entry with no matching exit is never assumed to run
      // through to session end, even though ROOM_ENTRY (the "factor") was
      // technically satisfied.
      await this.recordPending(session, personId, 'missing_exit');
      return;
    }

    if (roomEntryRequired && roomExitRequired) {
      // Code review finding: gating on roomEntryRequired alone was wrong —
      // if exits aren't required/tracked, entries never close into an
      // interval, totalMinutes stays 0, and a genuinely present student was
      // computed as 0% and marked absent. Duration-based grading only makes
      // sense when BOTH factors are required (i.e. permanência is actually
      // being tracked end to end); otherwise fall through to the
      // factors-only "present" branch below.
      const totalMinutes = closedIntervals.reduce(
        (sum, interval) => sum + (interval.exitAt.getTime() - interval.entryAt.getTime()) / 60000,
        0,
      );
      const percentage = sessionDurationMinutes > 0 ? (totalMinutes / sessionDurationMinutes) * 100 : 0;
      const status = percentage >= Number(session.minAttendancePercentageSnapshot) ? 'present' : 'absent';
      await this.upsertConsolidation(session, personId, Math.round(totalMinutes), percentage, status);
      return;
    }

    // No permanência tracked for this session's config — every required
    // factor was satisfied, so the student is present.
    await this.upsertConsolidation(session, personId, 0, 100, 'present');
  }

  private async recordPending(session: ClassSessionEntity, personId: string, reason: PendingReason): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    await this.upsertConsolidation(session, personId, 0, 0, 'pending');

    const pendingRepository = manager.getRepository(AttendancePendingReviewEntity);
    // RULE-ATT-11: pending never auto-resolves — don't spawn a second open
    // review for the same reason on repeated evaluation. Filtering
    // resolvedAt explicitly (rather than fetching any row and checking it in
    // JS) matters once more than one row can exist for the same reason —
    // an unfiltered, unordered findOneBy could non-deterministically return
    // an already-resolved row and create a duplicate anyway.
    const existingUnresolved = await pendingRepository.findOneBy({
      classSessionId: session.id,
      personId,
      reason,
      resolvedAt: IsNull(),
    });
    if (existingUnresolved) {
      return;
    }
    await pendingRepository.save(
      pendingRepository.create({ tenantId, classSessionId: session.id, personId, reason }),
    );
  }

  private async upsertConsolidation(
    session: ClassSessionEntity,
    personId: string,
    totalPresenceMinutes: number,
    attendancePercentage: number,
    status: 'present' | 'absent' | 'pending',
  ): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(SessionAttendanceConsolidationEntity);

    const existing = await repository.findOneBy({ classSessionId: session.id, personId });
    if (existing) {
      await repository.update(
        { id: existing.id },
        { totalPresenceMinutes, attendancePercentage, status },
      );
      return;
    }
    await repository.save(
      repository.create({
        tenantId,
        classSessionId: session.id,
        personId,
        totalPresenceMinutes,
        attendancePercentage,
        status,
      }),
    );
  }
}
