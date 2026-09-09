import { api } from '../../lib/api-client';
import type { AbsenceJustificationItemStatus } from './absence-justification-api';

// RULE-JUST-21/22: exclusive to the student titular, its OWN read model —
// deliberately NOT merged into GET /v1/me/warnings on the backend (see
// AbsenceJustificationNoticeReadService's header). RULE-JUST-22.6 ("os dois
// tipos aparecem em lista única... rotulado com o seu tipo") is implemented
// as a CLIENT-SIDE merge in student-warnings-page.tsx instead — the two
// backend read models stay separate, exactly as the backend intentionally
// left them.
export type AbsenceJustificationNoticeType = 'decision_result' | 'approval_revoked';

// details.items[].status narrows AbsenceJustificationItemStatus, but in
// practice only ever 'approved' or 'rejected' here — a decision_result
// notice is only emitted once every item of the (envio, matéria) reached a
// terminal state.
export interface AbsenceJustificationNoticeDecisionItem {
  classSessionId: string;
  status: AbsenceJustificationItemStatus;
  note: string | null;
  decidedByPersonId: string | null;
  decidedAt: string | null;
}

// RULE-JUST-21 items 2-4: mirrors AbsenceJustificationNoticeService's
// `details` shape for noticeType 'decision_result' — jsonb on the backend,
// so this is a Frontend Agent narrowing of an untyped column, same idiom
// already used for ActiveWarningEntry.warningType.
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
// (submission, subject) APPENDS to this same notice row instead of a second
// one (AbsenceJustificationNoticeService.recordRevocation's own comment on
// why: the UNIQUE(submission_id, subject_id, notice_type) constraint).
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
  // never removes the notice, unlike ActiveWarningEntry.seenAt. Same
  // pre-stamp/first-read semantics as that field though: null here means
  // this exact read is the first time this notice was shown.
  seenAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export async function listMyJustificationNotices(): Promise<AbsenceJustificationNotice[]> {
  return api.get('/v1/absence-justification-notices');
}

export async function dismissJustificationNotice(noticeId: string): Promise<{ noticeId: string; dismissed: boolean }> {
  return api.post(`/v1/absence-justification-notices/${noticeId}/dismiss`);
}
