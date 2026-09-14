import type { AbsenceJustificationNotice, ActiveWarningEntry } from '../warnings-api';
import { buildWarningsFeed, resolveNoticeSubjectLabel } from '../warnings-feed';

function makeWarning(overrides: Partial<ActiveWarningEntry> = {}): ActiveWarningEntry {
  return {
    id: 'warning-1',
    classGroupId: 'group-1',
    classGroupName: 'Turma A',
    subjectId: 'subject-1',
    subjectName: 'Cálculo I',
    warningType: 'approaching_minimum',
    warningTypeSince: '2026-09-01T10:00:00.000Z',
    frequencyPercentage: 78,
    presentCount: 10,
    consideredCount: 13,
    minPercentageApplied: 75,
    periodStartDate: '2026-08-01',
    periodEndDate: '2026-09-30',
    seenAt: '2026-09-01T10:05:00.000Z',
    ...overrides,
  };
}

function makeNotice(overrides: Partial<AbsenceJustificationNotice> = {}): AbsenceJustificationNotice {
  return {
    id: 'notice-1',
    personId: 'person-1',
    submissionId: 'submission-1',
    subjectId: 'subject-1',
    noticeType: 'decision_result',
    details: {
      approvedCount: 1,
      rejectedCount: 0,
      items: [{ classSessionId: 'session-1', status: 'approved', note: null, decidedByPersonId: 'prof-1', decidedAt: '2026-09-01T09:00:00.000Z' }],
      frequencyBeforePercentage: 72,
      frequencyAfterPercentage: 78,
      resendMayStillBeEligible: false,
    },
    seenAt: null,
    dismissedAt: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    ...overrides,
  };
}

test('buildWarningsFeed_withMixOfWarningsAndNotices_ordersByRecencyDescending', () => {
  const older = makeWarning({ id: 'warning-old', warningTypeSince: '2026-09-01T00:00:00.000Z' });
  const newer = makeNotice({ id: 'notice-new', createdAt: '2026-09-05T00:00:00.000Z' });

  const feed = buildWarningsFeed([older], [newer]);

  expect(feed.map((entry) => (entry.kind === 'frequency' ? entry.warning.id : entry.notice.id))).toEqual(['notice-new', 'warning-old']);
});

test('buildWarningsFeed_withSameRecency_ranksBelowMinimumWarningBeforeApproachingMinimum', () => {
  const sameInstant = '2026-09-01T00:00:00.000Z';
  const approaching = makeWarning({ id: 'approaching', warningType: 'approaching_minimum', warningTypeSince: sameInstant });
  const below = makeWarning({ id: 'below', warningType: 'below_minimum', warningTypeSince: sameInstant });

  const feed = buildWarningsFeed([approaching, below], []);

  expect(feed.map((entry) => (entry.kind === 'frequency' ? entry.warning.id : entry.notice.id))).toEqual(['below', 'approaching']);
});

test('buildWarningsFeed_withSameRecencyBetweenWarningAndNotice_ranksNoticeAfterBelowMinimumWarningOnly', () => {
  const sameInstant = '2026-09-01T00:00:00.000Z';
  const below = makeWarning({ id: 'below', warningType: 'below_minimum', warningTypeSince: sameInstant });
  const notice = makeNotice({ id: 'notice-tied', createdAt: sameInstant });

  const feed = buildWarningsFeed([below], [notice]);

  expect(feed.map((entry) => (entry.kind === 'frequency' ? entry.warning.id : entry.notice.id))).toEqual(['below', 'notice-tied']);
});

test('buildWarningsFeed_withEmptyInputs_returnsEmptyFeed', () => {
  expect(buildWarningsFeed([], [])).toEqual([]);
});

test('resolveNoticeSubjectLabel_forDecisionResultNotice_resolvesFromFirstItemsClassSessionId', () => {
  const notice = makeNotice({
    noticeType: 'decision_result',
    details: {
      approvedCount: 1,
      rejectedCount: 0,
      items: [{ classSessionId: 'session-42', status: 'approved', note: null, decidedByPersonId: null, decidedAt: null }],
      frequencyBeforePercentage: null,
      frequencyAfterPercentage: null,
      resendMayStillBeEligible: false,
    },
  });
  const labelBySessionId = new Map([['session-42', 'Cálculo I — Turma A']]);

  expect(resolveNoticeSubjectLabel(notice, labelBySessionId)).toBe('Cálculo I — Turma A');
});

test('resolveNoticeSubjectLabel_forApprovalRevokedNotice_resolvesFromFirstRevocationsClassSessionId', () => {
  const notice = makeNotice({
    noticeType: 'approval_revoked',
    details: { revocations: [{ classSessionId: 'session-77', note: 'erro de lançamento', revokedAt: '2026-09-02T00:00:00.000Z' }] },
  });
  const labelBySessionId = new Map([['session-77', 'Física II — Turma B']]);

  expect(resolveNoticeSubjectLabel(notice, labelBySessionId)).toBe('Física II — Turma B');
});

test('resolveNoticeSubjectLabel_whenSessionIdNotInSchedule_returnsNull', () => {
  const notice = makeNotice();

  expect(resolveNoticeSubjectLabel(notice, new Map())).toBeNull();
});
