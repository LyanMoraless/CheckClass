import { api, buildQuery } from '../../lib/api-client';
// Same item shape both roles read — see that file's own comment on why this
// is imported rather than duplicated (cross-feature-import precedent already
// used by portal-exams importing from features/exams).
import type { AbsenceJustificationItem, AbsenceJustificationItemStatus, AbsenceJustificationLegalCategory } from '../portal-student-justifications/absence-justification-api';

// The queue and decided-items endpoints below both join in the submission's
// legalCategory/description alongside the item's own columns — a shape the
// plain student-facing AbsenceJustificationItem doesn't have (that one is
// item-only; legalCategory/description live on the submission there). Kept
// as its own type rather than widening AbsenceJustificationItem itself,
// since student-facing endpoints (.../items) still return the narrower shape.
export interface AbsenceJustificationQueueItem extends AbsenceJustificationItem {
  legalCategory: AbsenceJustificationLegalCategory;
  description: string;
}

// RULE-JUST-06/08/24: only items of a (turma, matéria) this professor
// actually teaches, and only 'under_review' ones — server-side filtered,
// nothing to narrow further here.
export async function listAbsenceJustificationQueue(): Promise<AbsenceJustificationQueueItem[]> {
  return api.get('/v1/absence-justification-items/queue');
}

// Items THIS professor has already decided (any status by default, or
// narrowed to a single status — the revoke screen uses status=approved so
// RULE-JUST-17 revocations aren't limited to items decided earlier in the
// same browser session). Ordered by decidedAt desc server-side. Note: this
// listing does NOT re-validate RULE-JUST-17.3's período de apuração window —
// that only happens for real on POST .../revoke, so an item can appear here
// and still 400 when a revoke is actually attempted (handled as a normal
// ErrorBanner at the call site, not replicated here).
export async function listMyDecidedAbsenceJustificationItems(
  status?: AbsenceJustificationItemStatus,
): Promise<AbsenceJustificationQueueItem[]> {
  return api.get(`/v1/absence-justification-items/decided${buildQuery({ status })}`);
}

export interface DecideAbsenceJustificationItemInput {
  decision: 'approved' | 'rejected';
  // RULE-JUST-03 addendum item 1: required when rejecting, optional when
  // approving — enforced server-side; the UI only mirrors it to fail fast.
  note?: string;
}

export async function decideAbsenceJustificationItem(
  itemId: string,
  input: DecideAbsenceJustificationItemInput,
): Promise<AbsenceJustificationItem> {
  return api.post(`/v1/absence-justification-items/${itemId}/decide`, input);
}

// RULE-JUST-17: always requires a written note, only works on an item that
// is still 'approved' AND whose session's período de apuração is still the
// current one (backend 400s with a specific message otherwise — propagated
// as-is via errorMessage()).
export async function revokeAbsenceJustificationApproval(
  itemId: string,
  note: string,
): Promise<AbsenceJustificationItem> {
  return api.post(`/v1/absence-justification-items/${itemId}/revoke`, { note });
}
