import { ConflictException } from '@nestjs/common';
import { combineUtc, dateKey, extractUtcYmd } from '../../common/utc-date.util';

export interface ScheduleSlotLike {
  // RULE-INST-14: carried through to the generated session — the matéria is a
  // property of the slot, so a turma's Monday and Wednesday sessions can be
  // different matérias.
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ProjectedCandidateSession {
  subjectId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

export interface ProjectCandidateSessionsInput {
  slots: ScheduleSlotLike[];
  holidayDateKeys: Set<string>;
  // Any candidate whose computed scheduledStart matches one of these ISO
  // timestamps is treated as "already accounted for" — counted toward
  // consideredCount but excluded from the returned candidates. Callers decide
  // which existing class_session statuses populate this set (see
  // SessionGenerationService.generateForRange's dedupeStatuses).
  existingStartKeys: Set<string>;
  // Both date-only Date values (UTC), inclusive on both ends.
  rangeStartDate: Date;
  rangeEndDate: Date;
  // Optional additional cutoff: a candidate whose scheduledStart is not
  // strictly AFTER this instant is also treated as "already accounted for"
  // (considered, not generated) — needed because rangeStartDate is only
  // day-granularity, so "today" can still contain slot times earlier than
  // this exact moment. Used by ScheduleRegenerationService (RULE-INST-04
  // third-round item #5's "sessions that have not yet occurred");
  // ClassScheduleService.generateSessions never sets this.
  strictlyAfter?: Date;
}

export interface ProjectCandidateSessionsResult {
  candidates: ProjectedCandidateSession[];
  consideredCount: number;
}

// RULE-INST-04: projects every (date, slot) combination between
// rangeStartDate and rangeEndDate (inclusive) whose weekday matches a
// recurring slot, skipping institutional holidays and anything already
// accounted for (existingStartKeys / strictlyAfter). Pure/stateless — no DB
// access, no DI — shared as-is by ClassScheduleService.generateSessions and
// ScheduleRegenerationService.regenerateFutureSessions (both via
// SessionGenerationService.generateForRange) instead of two copies of this
// loop.
export function projectCandidateSessions(input: ProjectCandidateSessionsInput): ProjectCandidateSessionsResult {
  const { year: startYear, month: startMonth, day: startDay } = extractUtcYmd(input.rangeStartDate);
  const { year: endYear, month: endMonth, day: endDay } = extractUtcYmd(input.rangeEndDate);
  const endUtcMs = Date.UTC(endYear, endMonth, endDay);

  const candidates: ProjectedCandidateSession[] = [];
  let consideredCount = 0;
  let cursorMs = Date.UTC(startYear, startMonth, startDay);

  while (cursorMs <= endUtcMs) {
    const cursor = new Date(cursorMs);
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const day = cursor.getUTCDate();
    const weekday = cursor.getUTCDay(); // JS Date.getDay() convention — matches slot.dayOfWeek

    if (!input.holidayDateKeys.has(dateKey(year, month, day))) {
      for (const slot of input.slots) {
        if (slot.dayOfWeek !== weekday) {
          continue;
        }
        consideredCount += 1;
        const scheduledStart = combineUtc(year, month, day, slot.startTime);
        const scheduledEnd = combineUtc(year, month, day, slot.endTime);
        const alreadyAccountedFor =
          input.existingStartKeys.has(scheduledStart.toISOString()) ||
          (input.strictlyAfter !== undefined && scheduledStart.getTime() <= input.strictlyAfter.getTime());
        if (!alreadyAccountedFor) {
          candidates.push({ subjectId: slot.subjectId, scheduledStart, scheduledEnd });
        }
      }
    }

    cursorMs = Date.UTC(year, month, day + 1);
  }

  return { candidates, consideredCount };
}

// Defensive check beyond what ScheduleConflictDetectionService alone can see:
// that service only queries ALREADY-PERSISTED class_session rows, so it can't
// catch two of THIS SAME turma's slot definitions producing overlapping
// candidates within this one batch (e.g. two slots both on Monday with
// overlapping start/end times) — which would still be a real RULE-INST-10
// conflict, since they share the same room and teachers by construction.
// Checked in-memory, pairwise, before touching the database at all.
export function assertNoSelfOverlap(classGroupId: string, candidates: ProjectedCandidateSession[]): void {
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.scheduledStart < b.scheduledEnd && b.scheduledStart < a.scheduledEnd) {
        throw new ConflictException(
          `class_group ${classGroupId}'s own recurring slots produce overlapping sessions on ` +
            `${a.scheduledStart.toISOString()} and ${b.scheduledStart.toISOString()} (RULE-INST-10) — fix the schedule slots before generating`,
        );
      }
    }
  }
}
