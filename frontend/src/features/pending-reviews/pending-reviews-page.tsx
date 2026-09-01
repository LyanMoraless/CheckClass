import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Info } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { listPendingReviews, resolvePendingReview, type PendingReview } from './pending-reviews-api';
import styles from './pending-reviews-page.module.css';

export function PendingReviewsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['pending-reviews'], queryFn: listPendingReviews });

  return (
    <section>
      <PageHeader
        icon={ClipboardList}
        area="core"
        title="Revisões pendentes"
        description="Decida presença ou ausência nos lançamentos que a régua automática não conseguiu resolver sozinha."
      />
      <p className={styles.infoNote}>
        <Info size={16} className={styles.infoIcon} />
        A resolução de uma revisão é autorizada pela cadeia de liderança acima da turma da aula (professor,
        coordenador de curso ou direção da instituição) — não pelos grupos de permissões gerais. Um 403 aqui
        significa que você não está nessa cadeia para esta aula específica, não uma permissão ausente.
      </p>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && data.length === 0 && <p className={styles.empty}>Nenhuma revisão pendente.</p>}
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
      <p className={styles.meta}>
        Pessoa: <code>{review.personId}</code>
      </p>
      <p className={styles.meta}>
        Motivo: <Badge label={review.reason} tone="warning" />
      </p>
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
      <button type="button" className={styles.iconButton} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        <CheckCircle2 size={16} />
        {mutation.isPending ? 'Resolvendo…' : 'Resolver'}
      </button>
    </fieldset>
  );
}
