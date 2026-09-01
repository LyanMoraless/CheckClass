import { Injectable } from '@nestjs/common';
import { ClassGroupEnrollmentEntity, ClassGroupScheduleSlotEntity, ClassSessionEntity, HolidayEntity } from '../../database/entities';
import { dateKeyOfUtc } from '../../common/utc-date.util';
import { TenantContextService } from '../../database/tenant-context.service';
import { ClassSessionService } from '../class-session/class-session.service';
import { ScheduleConflictDetectionService } from '../schedule-conflict-detection/schedule-conflict-detection.service';
import { assertNoSelfOverlap, projectCandidateSessions } from './schedule-session-projection.util';

export interface GenerateForRangeInput {
  classGroup: { id: string; roomId: string | null };
  slots: ClassGroupScheduleSlotEntity[];
  rangeStartDate: Date;
  rangeEndDate: Date;
  // Which existing class_session statuses (for this classGroup) count as
  // "already occupying that exact scheduledStart" and must therefore be
  // skipped instead of duplicated. generateSessions (first bulk generation)
  // and regenerateFutureSessions (grade-edit regeneration) deliberately pass
  // different sets here — see each caller's own doc comment for why.
  dedupeStatuses: string[];
  strictlyAfter?: Date;
  // Threaded through to ClassSessionService.createSession, which enforces
  // RULE-INST-09's cumulative leadership-scope check itself (security-review
  // finding — createSession used to be the one class_session write path that
  // skipped it). Every caller here already ran its own
  // hasAuthorityOverClassGroup check for this same classGroupId/person before
  // reaching this method, so this is a defense-in-depth re-check, not new
  // exposure.
  authenticatedPersonId: string;
}

export interface GenerateForRangeResult {
  created: number;
  skipped: number;
}

// Shared primitive behind BOTH RULE-INST-04 entry points that turn the
// recurring grade (class_group_schedule_slot) into concrete class_session
// rows: ClassScheduleService.generateSessions (first bulk generation over the
// whole term) and ScheduleRegenerationService.regenerateFutureSessions
// (re-derives only the future portion after the grade itself changes).
// Neither duplicates this "load holidays/teachers/existing sessions -> project
// candidates -> tudo-ou-nada conflict-check -> create" pipeline — only the
// date range and the dedupe-status set differ between the two callers, both
// passed in by them.
@Injectable()
export class SessionGenerationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly conflictDetection: ScheduleConflictDetectionService,
    private readonly classSessionService: ClassSessionService,
  ) {}

  async generateForRange(input: GenerateForRangeInput): Promise<GenerateForRangeResult> {
    if (input.slots.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const manager = this.tenantContext.getManager();

    const holidays = await manager.getRepository(HolidayEntity).find();
    const holidayDateKeys = new Set(holidays.map((holiday) => dateKeyOfUtc(holiday.date)));

    const teacherEnrollments = await manager
      .getRepository(ClassGroupEnrollmentEntity)
      .find({ where: { classGroupId: input.classGroup.id, role: 'teacher' } });
    const teacherPersonIds = teacherEnrollments.map((enrollment) => enrollment.personId);

    const existingSessions = await manager
      .getRepository(ClassSessionEntity)
      .find({ where: { classGroupId: input.classGroup.id } });
    const existingStartKeys = new Set(
      existingSessions
        .filter((session) => input.dedupeStatuses.includes(session.status))
        .map((session) => session.scheduledStart.toISOString()),
    );

    const { candidates, consideredCount } = projectCandidateSessions({
      slots: input.slots,
      holidayDateKeys,
      existingStartKeys,
      rangeStartDate: input.rangeStartDate,
      rangeEndDate: input.rangeEndDate,
      strictlyAfter: input.strictlyAfter,
    });

    if (candidates.length === 0) {
      return { created: 0, skipped: consideredCount };
    }

    assertNoSelfOverlap(input.classGroup.id, candidates);

    // Tudo-ou-nada: every candidate is validated against
    // ScheduleConflictDetectionService BEFORE any of them is persisted. No
    // extra manager.transaction() wrapping is added — TenantContextInterceptor
    // already runs the whole HTTP request through
    // TenantContextService.runWithTenant, which wraps the request in one DB
    // transaction end-to-end, so a mid-loop failure anywhere below rolls back
    // every class_session already written via ClassSessionService.createSession
    // earlier in this same call.
    for (const candidate of candidates) {
      await this.conflictDetection.assertNoConflict({
        roomId: input.classGroup.roomId,
        teacherPersonIds,
        scheduledStart: candidate.scheduledStart,
        scheduledEnd: candidate.scheduledEnd,
      });
    }

    for (const candidate of candidates) {
      // roomId intentionally omitted: RULE-INST-07's inheritance — these
      // sessions track class_group.roomId dynamically (class_session.roomId
      // stays NULL) instead of freezing a snapshot of it at generation time.
      await this.classSessionService.createSession(
        {
          classGroupId: input.classGroup.id,
          scheduledStart: candidate.scheduledStart,
          scheduledEnd: candidate.scheduledEnd,
        },
        input.authenticatedPersonId,
      );
    }

    return { created: candidates.length, skipped: consideredCount - candidates.length };
  }
}
