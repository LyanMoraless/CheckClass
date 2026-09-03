import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { PendingReviewRow } from './pending-review-row';
import { listMyPendingReviews } from './pending-reviews-api';
import styles from './pending-reviews-page.module.css';

const QUERY_KEY = ['my-pending-reviews'];

// Shared route (/portal/pending-reviews) reached from all three of the
// Professor/Coordenador/Direção nav groups — RULE-ATT-12's leadership chain
// already scopes GET /v1/pending-reviews/mine to exactly what each caller is
// authorized to resolve, so one screen serves all three roles rather than
// three copies differing only in which nav group linked here.
export function MyPendingReviewsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: listMyPendingReviews });

  return (
    <section>
      <PageHeader
        icon={ClipboardList}
        area="portal"
        title="Revisões pendentes"
        description="Lançamentos das suas turmas que a régua automática não conseguiu resolver sozinha."
      />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && data.length === 0 && <p className={styles.empty}>Nenhuma revisão pendente para você resolver.</p>}
      {data?.map((review) => <PendingReviewRow key={review.id} review={review} queryKey={QUERY_KEY} />)}
    </section>
  );
}
