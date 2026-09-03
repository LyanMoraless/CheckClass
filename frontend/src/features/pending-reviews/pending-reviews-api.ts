import { api } from '../../lib/api-client';

export interface PendingReview {
  id: string;
  classSessionId: string;
  personId: string;
  reason: string;
  resolvedByPersonId: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface ResolvePendingReviewInput {
  decision: 'present' | 'absent';
  note?: string;
}

export async function listPendingReviews(): Promise<PendingReview[]> {
  return api.get('/v1/pending-reviews');
}

// GET /v1/pending-reviews/mine — narrower, leadership-chain-scoped view
// ("only what I'm authorized to resolve", RULE-ATT-12) used by the
// Professor/Coordenador/Direção portal, as opposed to listPendingReviews()
// above, which stays the tenant-wide admin view gated on
// view_attendance_register. Already implemented server-side
// (pending-review.controller.ts) — this is only the missing frontend client
// for it, added alongside the existing one rather than replacing it.
export async function listMyPendingReviews(): Promise<PendingReview[]> {
  return api.get('/v1/pending-reviews/mine');
}

export async function resolvePendingReview(
  pendingReviewId: string,
  input: ResolvePendingReviewInput,
): Promise<{ pendingReviewId: string; decision: string }> {
  return api.post(`/v1/pending-reviews/${pendingReviewId}/resolve`, input);
}
