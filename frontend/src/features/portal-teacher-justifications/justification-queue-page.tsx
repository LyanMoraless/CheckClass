import { useQuery } from '@tanstack/react-query';
import { FileSearch, Info } from 'lucide-react';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { listAbsenceJustificationQueue, listMyDecidedAbsenceJustificationItems } from './absence-justification-decision-api';
import { JustificationQueueRow } from './justification-queue-row';
import { JustificationRevokeRow } from './justification-revoke-row';
import styles from './justification-queue-page.module.css';

const QUERY_KEY = ['justification-queue'];
// status=approved narrows to the items RULE-JUST-17 actually lets this
// professor revoke — GET .../decided lists every decision this professor
// has ever made (any session, any device), not just the ones made earlier
// in the current page session.
const DECIDED_QUERY_KEY = ['justification-decided', 'approved'];

// Professor-only screen (roleContext.teaching.length > 0) — RULE-JUST-06/08/24's
// decision queue: only items of a (turma, matéria) this professor actually
// teaches, one decision per aula, result of the submission can be partial.
export function JustificationQueuePage() {
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: listAbsenceJustificationQueue });
  const {
    data: decided,
    isLoading: isDecidedLoading,
    error: decidedError,
  } = useQuery({
    queryKey: DECIDED_QUERY_KEY,
    queryFn: () => listMyDecidedAbsenceJustificationItems('approved'),
  });

  return (
    <section>
      <PageHeader
        icon={FileSearch}
        area="portal"
        title="Justificativas de falta"
        description="Aulas das suas matérias com pedido de justificativa em análise — uma decisão por aula, nunca por aluno inteiro."
      />
      <p className={styles.hintNote}>
        <Info size={16} className={styles.hintIcon} />
        Aprovar retira a falta (conta como presença, mas permanece identificável como falta justificada). Rejeitar mantém
        a falta e exige uma nota escrita explicando o motivo.
      </p>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && data.length === 0 && <p className={styles.empty}>Nenhuma justificativa aguardando sua decisão.</p>}
      {data?.map((item) => (
        <JustificationQueueRow key={item.id} item={item} queryKey={QUERY_KEY} decidedQueryKey={DECIDED_QUERY_KEY} />
      ))}

      <h2>Aprovações revogáveis</h2>
      <p>
        <small>
          Toda aprovação já concedida por você, de qualquer sessão — revogar exige uma nota escrita e só é possível
          enquanto o período de apuração da aula ainda for o atual (RULE-JUST-17).
        </small>
      </p>
      {isDecidedLoading && <Loading />}
      {decidedError && <ErrorBanner message={errorMessage(decidedError)} />}
      {decided && decided.length === 0 && <p className={styles.empty}>Nenhuma aprovação sua disponível para revogação.</p>}
      {decided && decided.length > 0 && (
        <ul className={styles.decidedList}>
          {decided.map((item) => (
            <JustificationRevokeRow key={item.id} item={item} queryKey={DECIDED_QUERY_KEY} />
          ))}
        </ul>
      )}
    </section>
  );
}
