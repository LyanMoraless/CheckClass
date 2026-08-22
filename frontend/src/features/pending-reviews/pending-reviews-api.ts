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

export async function resolvePendingReview(
  pendingReviewId: string,
  input: ResolvePendingReviewInput,
): Promise<{ pendingReviewId: string; decision: string }> {
  return api.post(`/v1/pending-reviews/${pendingReviewId}/resolve`, input);
}
