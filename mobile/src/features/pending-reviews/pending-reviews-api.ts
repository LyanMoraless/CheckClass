import { apiClient } from '../../lib/api-client';

export type PendingReviewDecision = 'present' | 'absent';

// Mirrors the row shape PendingReviewService.listUnresolvedForPerson returns exactly
// (pending-review.service.ts).
export interface PendingReview {
  id: string;
  tenantId: string;
  classSessionId: string;
  personId: string;
  reason: string;
  resolvedByPersonId: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

// GET /v1/pending-reviews/mine (pending-review.controller.ts): RULE-ATT-12's leadership-
// chain-scoped view — "only what I'm authorized to resolve", not the whole tenant. A person
// with no leadership assignment (e.g. a student with no Professor role) simply gets an empty
// list here; this is not an error case to handle specially.
export async function listMyPendingReviews(): Promise<PendingReview[]> {
  return apiClient.get<PendingReview[]>('/v1/pending-reviews/mine');
}

export interface ResolvePendingReviewResult {
  pendingReviewId: string;
  decision: PendingReviewDecision;
}

// POST /v1/pending-reviews/:id/resolve — a 403 here means "not in the direct leadership
// chain above this specific session" (RULE-ATT-12), enforced server-side; this app has no
// separate client-side permission check to duplicate that with.
export async function resolvePendingReview(
  pendingReviewId: string,
  decision: PendingReviewDecision,
  note?: string,
): Promise<ResolvePendingReviewResult> {
  return apiClient.post<ResolvePendingReviewResult>(`/v1/pending-reviews/${pendingReviewId}/resolve`, {
    decision,
    note: note || undefined,
  });
}
