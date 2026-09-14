import { apiClient } from '../../lib/api-client';

// GET /v1/me/warnings — RULE-FREQ-04 items 2/4, self-scoped like every other
// /v1/me/* route (RULE-ATT-15's "is this my own data" idiom). Mirrors
// FrequencyWarningReadService's ActiveWarningEntry exactly — same shape as
// the web dashboard's student-warnings-api.ts.
export interface ActiveWarningEntry {
  id: string;
  classGroupId: string;
  classGroupName: string;
  subjectId: string;
  subjectName: string;
  // Narrowed here (backend keeps it a raw string) — drives the exhaustive
  // WARNING_TYPE_LABEL lookup and the two visually-distinct card treatments
  // (RULE-FREQ-07), same idiom as the web client.
  warningType: 'approaching_minimum' | 'below_minimum';
  warningTypeSince: string;
  // Rounded integer the backend actually compared against the minimum —
  // never the raw ratio.
  frequencyPercentage: number;
  presentCount: number;
  consideredCount: number;
  // Explainability only (what was in force when this row was last written) —
  // never a live configuration source.
  minPercentageApplied: number;
  // Date-only strings ("YYYY-MM-DD"), rendered by the backend precisely so no
  // timezone-shift bug can move these. Never parse these with `new Date(...)`
  // for anything but display of the date parts themselves — see
  // formatDateOnly in warnings-screen.tsx.
  periodStartDate: string;
  periodEndDate: string;
  // Null means this is the FIRST time this warning has ever been shown to
  // the student (RULE-FREQ-04 item 1) — this value is from BEFORE this same
  // request stamped it, so the client is the only place that can still tell
  // "first view" from "already seen".
  seenAt: string | null;
}

export async function listMyWarnings(): Promise<ActiveWarningEntry[]> {
  return apiClient.get<ActiveWarningEntry[]>('/v1/me/warnings');
}

// RULE-JUST-21/22: exclusive to the student titular, its OWN read model —
// deliberately NOT merged into GET /v1/me/warnings on the backend.
// RULE-JUST-22.6 ("os dois tipos aparecem em lista única... rotulado com o
// seu tipo") is implemented as a CLIENT-SIDE merge in warnings-feed.ts
// instead — the two backend read models stay separate, exactly as the
// backend intentionally left them.
export type AbsenceJustificationNoticeType = 'decision_result' | 'approval_revoked';

// Mirrors AbsenceJustificationItemStatus from the web dashboard's
// absence-justification-api.ts. That file belongs to the absence-
// justification submission/decision feature, which is out of scope for this
// task (a later front) — duplicated here as a minimal local type instead of
// importing that whole feature. In practice a decision_result notice only
// ever carries 'approved' or 'rejected' here.
export type AbsenceJustificationItemStatus =
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'closed_subject_removed'
  | 'approval_revoked';

// RULE-JUST-21 items 2-4: mirrors AbsenceJustificationNoticeService's
// `details` shape for noticeType 'decision_result' — jsonb on the backend,
// narrowed here the same way ActiveWarningEntry.warningType is.
export interface AbsenceJustificationNoticeDecisionItem {
  classSessionId: string;
  status: AbsenceJustificationItemStatus;
  note: string | null;
  decidedByPersonId: string | null;
  decidedAt: string | null;
}

export interface AbsenceJustificationDecisionResultDetails {
  approvedCount: number;
  rejectedCount: number;
  items: AbsenceJustificationNoticeDecisionItem[];
  // RULE-JUST-21 item 4: only present on an approval; null on a
  // rejection-only outcome.
  frequencyBeforePercentage: number | null;
  frequencyAfterPercentage: number | null;
  // RULE-JUST-21 item 3 / RULE-JUST-05.4: an approximate signal, the backend
  // re-checks for real if the student actually tries to resend.
  resendMayStillBeEligible: boolean;
}

export interface AbsenceJustificationRevocationEntry {
  classSessionId: string;
  note: string;
  revokedAt: string;
}

// RULE-JUST-17.5: mirrors the `details` shape for noticeType
// 'approval_revoked' — an array because a second revocation of the same
// (submission, subject) APPENDS to this same notice row instead of creating
// a second one.
export interface AbsenceJustificationApprovalRevokedDetails {
  revocations: AbsenceJustificationRevocationEntry[];
}

export interface AbsenceJustificationNotice {
  id: string;
  personId: string;
  submissionId: string;
  subjectId: string;
  noticeType: AbsenceJustificationNoticeType;
  details: AbsenceJustificationDecisionResultDetails | AbsenceJustificationApprovalRevokedDetails;
  // RULE-JUST-22.2: being seen only stamps this for unread-count purposes —
  // never removes the notice, unlike ActiveWarningEntry.seenAt.
  seenAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

// GET /v1/absence-justification-notices — gated by RULE-JUST-10
// (AbsenceJustificationAreaGateInterceptor rejects tenants that aren't type
// "faculdade"). For a non-faculdade tenant this call fails; the screen
// surfaces that failure the same way the web dashboard does (an error
// banner) — it is deliberately NOT treated as "empty list" here.
export async function listMyJustificationNotices(): Promise<AbsenceJustificationNotice[]> {
  return apiClient.get<AbsenceJustificationNotice[]>('/v1/absence-justification-notices');
}

export interface DismissJustificationNoticeResult {
  noticeId: string;
  dismissed: boolean;
}

export async function dismissJustificationNotice(noticeId: string): Promise<DismissJustificationNoticeResult> {
  return apiClient.post<DismissJustificationNoticeResult>(`/v1/absence-justification-notices/${noticeId}/dismiss`);
}
