import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { errorMessage } from '../../lib/api-client';
import { listPendingReviews, resolvePendingReview, type PendingReview } from './pending-reviews-api';

export function PendingReviewsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['pending-reviews'], queryFn: listPendingReviews });

  return (
    <section>
      <h1>Pending reviews</h1>
      <p>
        <small>
          Resolving a review is authorized by the leadership chain above the session's class group (professor,
          course coordinator, or institution head) — not by the general permission groups. A 403 here means you're
          not in that chain for this specific session, not a missing permission-group grant.
        </small>
      </p>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && data.length === 0 && <p>No unresolved reviews.</p>}
      {data?.map((review) => <ReviewRow key={review.id} review={review} />)}
    </section>
  );
}

function ReviewRow({ review }: { review: PendingReview }) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<'present' | 'absent'>('present');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => resolvePendingReview(review.id, { decision, note: note || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-reviews'] }),
  });

  return (
    <fieldset>
      <legend>Session {review.classSessionId}</legend>
      <p>Person: {review.personId}</p>
      <p>Reason: {review.reason}</p>
      {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
      <label>
        Decision
        <select value={decision} onChange={(event) => setDecision(event.target.value as 'present' | 'absent')}>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
        </select>
      </label>
      <label>
        Note (optional)
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Resolving…' : 'Resolve'}
      </button>
    </fieldset>
  );
}
