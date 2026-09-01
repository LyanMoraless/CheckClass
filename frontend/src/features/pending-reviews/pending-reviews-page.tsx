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
      <h1>Revisões pendentes</h1>
      <p>
        <small>
          A resolução de uma revisão é autorizada pela cadeia de liderança acima da turma da aula (professor,
          coordenador de curso ou direção da instituição) — não pelos grupos de permissões gerais. Um 403 aqui
          significa que você não está nessa cadeia para esta aula específica, não uma permissão ausente.
        </small>
      </p>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && data.length === 0 && <p>Nenhuma revisão pendente.</p>}
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
      <legend>Aula {review.classSessionId}</legend>
      <p>Pessoa: {review.personId}</p>
      <p>Motivo: {review.reason}</p>
      {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
      <label>
        Decisão
        <select value={decision} onChange={(event) => setDecision(event.target.value as 'present' | 'absent')}>
          <option value="present">Presente</option>
          <option value="absent">Ausente</option>
        </select>
      </label>
      <label>
        Nota (opcional)
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Resolvendo…' : 'Resolver'}
      </button>
    </fieldset>
  );
}
