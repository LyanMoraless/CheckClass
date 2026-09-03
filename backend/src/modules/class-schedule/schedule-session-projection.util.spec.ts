import { ConflictException } from '@nestjs/common';
import { assertNoSelfOverlap, projectCandidateSessions } from './schedule-session-projection.util';

// Pure-function coverage — no DB/DI involved. RULE-INST-04/10.
describe('projectCandidateSessions', () => {
  const mondaySlot = { subjectId: 'subject-1', dayOfWeek: 1, startTime: '13:00:00', endTime: '15:00:00' };
  // 2026-09-07 is a Monday (UTC).
  const oneWeekRange = { rangeStartDate: new Date(Date.UTC(2026, 8, 7)), rangeEndDate: new Date(Date.UTC(2026, 8, 13)) };

  test('test_projectCandidateSessions_oneWeekOneMondaySlot_generatesExactlyOneCandidate', () => {
    const result = projectCandidateSessions({
      slots: [mondaySlot],
      holidayDateKeys: new Set(),
      existingStartKeys: new Set(),
      ...oneWeekRange,
    });

    expect(result).toEqual({
      candidates: [
        {
          // RULE-INST-14: the candidate carries the slot's matéria through to
          // the session it becomes.
          subjectId: 'subject-1',
          scheduledStart: new Date('2026-09-07T13:00:00.000Z'),
          scheduledEnd: new Date('2026-09-07T15:00:00.000Z'),
        },
      ],
      consideredCount: 1,
    });
  });

  test('test_projectCandidateSessions_holidayOnSlotDate_skipsThatDateEntirely', () => {
    const result = projectCandidateSessions({
      slots: [mondaySlot],
      holidayDateKeys: new Set(['2026-09-07']),
      existingStartKeys: new Set(),
      rangeStartDate: new Date(Date.UTC(2026, 8, 7)),
      rangeEndDate: new Date(Date.UTC(2026, 8, 14)), // extends to the second Monday
    });

    expect(result).toEqual({
      candidates: [
        {
          subjectId: 'subject-1',
          scheduledStart: new Date('2026-09-14T13:00:00.000Z'),
          scheduledEnd: new Date('2026-09-14T15:00:00.000Z'),
        },
      ],
      consideredCount: 1,
    });
  });

  test('test_projectCandidateSessions_existingStartKeyMatches_isConsideredButNotReturned', () => {
    const result = projectCandidateSessions({
      slots: [mondaySlot],
      holidayDateKeys: new Set(),
      existingStartKeys: new Set(['2026-09-07T13:00:00.000Z']),
      ...oneWeekRange,
    });

    expect(result).toEqual({ candidates: [], consideredCount: 1 });
  });

  // ScheduleRegenerationService's cutoff (RULE-INST-04 item #5): a candidate
  // that isn't strictly after `strictlyAfter` is considered but not returned,
  // even when rangeStartDate falls on the SAME calendar day.
  test('test_projectCandidateSessions_strictlyAfterCutoff_excludesCandidateOnOrBeforeThatInstant', () => {
    const result = projectCandidateSessions({
      slots: [mondaySlot],
      holidayDateKeys: new Set(),
      existingStartKeys: new Set(),
      ...oneWeekRange,
      strictlyAfter: new Date('2026-09-07T14:00:00.000Z'), // after the 13:00 candidate has already started
    });

    expect(result).toEqual({ candidates: [], consideredCount: 1 });
  });

  test('test_projectCandidateSessions_strictlyAfterCutoff_includesCandidateStartingAfterThatInstant', () => {
    const result = projectCandidateSessions({
      slots: [mondaySlot],
      holidayDateKeys: new Set(),
      existingStartKeys: new Set(),
      ...oneWeekRange,
      strictlyAfter: new Date('2026-09-07T12:00:00.000Z'), // before the 13:00 candidate
    });

    expect(result.candidates).toHaveLength(1);
  });

  test('test_projectCandidateSessions_noSlotsMatchWeekday_returnsNoCandidates', () => {
    const tuesdaySlot = { ...mondaySlot, dayOfWeek: 2 };
    const result = projectCandidateSessions({
      slots: [tuesdaySlot],
      holidayDateKeys: new Set(),
      existingStartKeys: new Set(),
      rangeStartDate: new Date(Date.UTC(2026, 8, 7)),
      rangeEndDate: new Date(Date.UTC(2026, 8, 7)), // single day, a Monday
    });

    expect(result).toEqual({ candidates: [], consideredCount: 0 });
  });
});

describe('assertNoSelfOverlap', () => {
  test('test_assertNoSelfOverlap_nonOverlappingCandidates_doesNotThrow', () => {
    const candidates = [
      { scheduledStart: new Date('2026-09-07T13:00:00Z'), scheduledEnd: new Date('2026-09-07T15:00:00Z') },
      { scheduledStart: new Date('2026-09-07T15:00:00Z'), scheduledEnd: new Date('2026-09-07T17:00:00Z') },
    ];

    expect(() => assertNoSelfOverlap('class-group-1', candidates)).not.toThrow();
  });

  test('test_assertNoSelfOverlap_overlappingCandidates_throwsConflict', () => {
    const candidates = [
      { scheduledStart: new Date('2026-09-07T13:00:00Z'), scheduledEnd: new Date('2026-09-07T15:00:00Z') },
      { scheduledStart: new Date('2026-09-07T14:00:00Z'), scheduledEnd: new Date('2026-09-07T16:00:00Z') },
    ];

    expect(() => assertNoSelfOverlap('class-group-1', candidates)).toThrow(ConflictException);
  });
});
