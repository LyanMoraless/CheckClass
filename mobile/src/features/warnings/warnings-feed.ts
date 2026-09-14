import type {
  AbsenceJustificationApprovalRevokedDetails,
  AbsenceJustificationDecisionResultDetails,
  AbsenceJustificationNotice,
  ActiveWarningEntry,
} from './warnings-api';

// RULE-JUST-22.6: "os dois tipos aparecem em lista única, ordenada por
// recência" — the backend deliberately keeps GET /v1/me/warnings and
// GET /v1/absence-justification-notices as two separate read models. This
// module is that single-list merge, done entirely client-side (same idiom as
// the web dashboard's student-warnings-page.tsx), pulled into its own file
// so the merge/sort logic is unit-testable without rendering the screen.
export type FeedEntry =
  | { kind: 'frequency'; recency: number; warning: ActiveWarningEntry }
  | { kind: 'justification'; recency: number; notice: AbsenceJustificationNotice };

// Ranking below_minimum ahead of approaching_minimum is a presentation
// choice the backend explicitly left to the UI (RULE-FREQ-07) — kept as a
// SECONDARY tiebreaker only, since RULE-JUST-22.6 requires the merged list's
// primary order to be recency, not severity.
export function buildWarningsFeed(warnings: ActiveWarningEntry[], notices: AbsenceJustificationNotice[]): FeedEntry[] {
  const warningEntries: FeedEntry[] = warnings.map((warning) => ({
    kind: 'frequency',
    // ActiveWarningEntry carries no createdAt of its own — warningTypeSince
    // (when the warning last CHANGED type/appeared) is the closest proxy for
    // "recência" this endpoint offers.
    recency: new Date(warning.warningTypeSince).getTime(),
    warning,
  }));
  const noticeEntries: FeedEntry[] = notices.map((notice) => ({
    kind: 'justification',
    recency: new Date(notice.createdAt).getTime(),
    notice,
  }));
  return [...warningEntries, ...noticeEntries].sort((a, b) => {
    if (a.recency !== b.recency) {
      return b.recency - a.recency;
    }
    return feedEntrySeverityRank(a) - feedEntrySeverityRank(b);
  });
}

function feedEntrySeverityRank(entry: FeedEntry): number {
  return entry.kind === 'frequency' && entry.warning.warningType === 'below_minimum' ? 0 : 1;
}

// Notices only carry subjectId (no subjectName) and classGroupId is not even
// on the notice at all — resolving through a classSessionId that appears
// inside the notice's own details (RULE-JUST-21 items 2-4) is the only path
// available without a new backend field (same approach, and same limitation,
// as the web dashboard's student-warnings-page.tsx).
export function resolveNoticeSubjectLabel(notice: AbsenceJustificationNotice, labelBySessionId: Map<string, string>): string | null {
  const firstSessionId =
    notice.noticeType === 'decision_result'
      ? (notice.details as AbsenceJustificationDecisionResultDetails).items[0]?.classSessionId
      : (notice.details as AbsenceJustificationApprovalRevokedDetails).revocations[0]?.classSessionId;
  return firstSessionId ? (labelBySessionId.get(firstSessionId) ?? null) : null;
}
