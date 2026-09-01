import { Injectable } from '@nestjs/common';
import { In, MoreThan } from 'typeorm';
import {
  ClassGroupEntity,
  ClassGroupScheduleSlotEntity,
  ClassSessionEntity,
  ClassSessionRequiredFactorEntity,
} from '../../database/entities';
import { extractUtcYmd } from '../../common/utc-date.util';
import { TenantContextService } from '../../database/tenant-context.service';
import { SessionGenerationService } from './session-generation.service';

export interface RegenerateFutureSessionsResult {
  deleted: number;
  created: number;
  skipped: number;
}

// RULE-INST-04 (third-round update, item #5) / architecture-overview.md's
// "Cronograma automático": when the recurring grade changes (a slot is added
// or removed — ClassScheduleService.createSlot/deleteSlot, which call
// regenerateFutureSessions below at the end of the same request/transaction),
// every FUTURE session that was purely auto-generated from the OLD grade and
// has not yet occurred (scheduledStart > now(), status = 'scheduled' — i.e.
// never pontually touched) must be regenerated from the NEW grade. Past
// sessions and any pontually edited/cancelled session (RULE-INST-04 items
// #1-#3) are NEVER touched, regardless of date — deleting or recreating them
// would silently discard a real, human-made decision about that one specific
// occurrence.
//
// FK/DELETE safety investigation (documented per task, not assumed): five
// tables carry a class_session_id FK with no ON DELETE CASCADE (InitSchema /
// AddClassSessionRequiredFactorSnapshot migrations) — identification_checkin,
// presence_interval, session_attendance_consolidation,
// attendance_pending_review, and class_session_required_factor.
//   - The first four can only ever be populated as a downstream consequence
//     of an actual check-in, and EVERY check-in-to-session resolution path in
//     this codebase (IdentificationService.resolveClassSession,
//     AppCheckinService.resolveActiveClassSession) requires
//     `scheduled_start <= <the instant the check-in happened> <= scheduled_end`.
//     A session with scheduledStart > now() therefore cannot have a row in
//     any of those four tables yet — deleting it is always safe with respect
//     to them. If the DB's FK ever disagreed (only possible from a bug
//     elsewhere producing a check-in on a not-yet-started session), the
//     chosen behavior is to let the FK reject the DELETE with a raw 500
//     rather than silently working around it here — that would be a real
//     data-integrity bug worth surfacing loudly, not something this service
//     should paper over.
//   - class_session_required_factor is different: ClassSessionService
//     .createSession always writes it synchronously at session-creation
//     time whenever the effective config has any required factor —
//     completely independent of whether the session has occurred. A
//     brand-new, never-touched 'scheduled' future session WILL usually have
//     rows there, so this service deletes them explicitly, before deleting
//     the class_session itself: safe, since that snapshot has no
//     independent meaning once its parent session is gone.
@Injectable()
export class ScheduleRegenerationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly sessionGeneration: SessionGenerationService,
  ) {}

  async regenerateFutureSessions(classGroupId: string, authenticatedPersonId: string): Promise<RegenerateFutureSessionsResult> {
    const manager = this.tenantContext.getManager();
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      // Defensive only: every caller today (createSlot/deleteSlot) already
      // resolved this exact classGroup, with authority, moments earlier in
      // the same transaction — this branch should be unreachable in
      // practice.
      return { deleted: 0, created: 0, skipped: 0 };
    }

    // Same precondition as ClassScheduleService.generateSessions — but here a
    // missing term period/room is a silent no-op, not a BadRequestException:
    // createSlot/deleteSlot must keep succeeding even for a turma whose
    // montagem isn't finished yet (a coordinator can build the recurring
    // grade before a room or term period is picked). Nothing was ever
    // generated without both set, so there is nothing to regenerate.
    if (!classGroup.termStartDate || !classGroup.termEndDate || !classGroup.roomId) {
      return { deleted: 0, created: 0, skipped: 0 };
    }

    const now = new Date();
    const sessionRepo = manager.getRepository(ClassSessionEntity);

    const staleFutureSessions = await sessionRepo.find({
      where: { classGroupId, status: 'scheduled', scheduledStart: MoreThan(now) },
    });
    if (staleFutureSessions.length > 0) {
      const staleIds = staleFutureSessions.map((session) => session.id);
      await manager.getRepository(ClassSessionRequiredFactorEntity).delete({ classSessionId: In(staleIds) });
      await sessionRepo.delete(staleIds);
    }

    const slots = await manager.getRepository(ClassGroupScheduleSlotEntity).findBy({ classGroupId });

    // Bound the projection loop to "today (UTC) or the term start, whichever
    // is later" — pure optimization (skips iterating already-past days that
    // could never produce a future candidate anyway); the real
    // not-yet-occurred cutoff at millisecond precision is `strictlyAfter:
    // now` below, since "today" can still contain a slot time earlier than
    // this exact moment.
    const { year, month, day } = extractUtcYmd(now);
    const todayUtc = new Date(Date.UTC(year, month, day));
    const termStartYmd = extractUtcYmd(classGroup.termStartDate);
    const termStartUtc = new Date(Date.UTC(termStartYmd.year, termStartYmd.month, termStartYmd.day));
    const rangeStartDate = todayUtc.getTime() > termStartUtc.getTime() ? todayUtc : termStartUtc;

    const { created, skipped } = await this.sessionGeneration.generateForRange({
      classGroup,
      slots,
      rangeStartDate,
      rangeEndDate: classGroup.termEndDate,
      // RULE-INST-04 item #5: a pontually edited/cancelled session must never
      // be duplicated by regeneration — unlike
      // ClassScheduleService.generateSessions' own documented choice for the
      // FIRST bulk generation (where a previously-cancelled slot IS re-filled
      // — see that service's own doc comment), a cancelled session here must
      // stick. 'scheduled' is included too, for defensive symmetry with
      // generateSessions, even though the delete step above already removes
      // every future 'scheduled' session first (so it should never actually
      // match here).
      dedupeStatuses: ['scheduled', 'edited', 'cancelled'],
      strictlyAfter: now,
      authenticatedPersonId,
    });

    return { deleted: staleFutureSessions.length, created, skipped };
  }
}
