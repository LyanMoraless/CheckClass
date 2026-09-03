import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Info } from 'lucide-react';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { PendingReviewRow } from './pending-review-row';
import { listPendingReviews } from './pending-reviews-api';
import styles from './pending-reviews-page.module.css';

const QUERY_KEY = ['pending-reviews'];

export function PendingReviewsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: listPendingReviews });

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
      {data?.map((review) => <PendingReviewRow key={review.id} review={review} queryKey={QUERY_KEY} />)}
    </section>
  );
}
