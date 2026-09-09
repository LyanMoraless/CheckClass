import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Eye, FileCheck2, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage, triggerBrowserDownload } from '../../lib/api-client';
import { listMySchedule } from '../portal-student/student-schedule-api';
import {
  cancelAbsenceJustification,
  downloadAbsenceJustificationAttachment,
  ITEM_STATUS_BADGE,
  LEGAL_CATEGORY_LABELS,
  listAbsenceJustificationAttachmentAccessLog,
  listAbsenceJustificationItems,
  listMyAbsenceJustifications,
  type AbsenceJustificationAttachmentAccessResult,
  type AbsenceJustificationItem,
} from './absence-justification-api';
import styles from './absence-justification-page.module.css';

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const ACCESS_RESULT_LABEL: Record<AbsenceJustificationAttachmentAccessResult, string> = {
  granted: 'Acesso concedido',
  denied: 'Acesso negado',
  deleted_unavailable: 'Tentativa após eliminação do arquivo',
};

// Aluno-only screen, reached from "Meus pedidos" or by direct URL — RULE-JUST-
// 06 (per-item status, decision can be partial), RULE-JUST-05.4 (cancel only
// while nothing was decided yet), RULE-JUST-11.4 (titular always sees the
// attachment and its access log). There is no GET /:submissionId endpoint on
// the backend — the submission's own fields (period/categoria/descrição) are
// resolved here from the already-fetched "mine" list, the same
// join-two-already-existing-lists pattern student-attendance-page.tsx uses
// for classGroupOptions, rather than a new backend route for one field set.
export function JustificationDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();

  if (!submissionId) {
    return <ErrorBanner message="ID do pedido ausente na URL" />;
  }

  return <SubmissionDetail submissionId={submissionId} />;
}

// Split out so no hook below is ever called conditionally on submissionId
// being present — same wrapper/child precedent as SecurityIncidentDetailPage
// / IncidentDetail.
function SubmissionDetail({ submissionId }: { submissionId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: submissions } = useQuery({ queryKey: ['my-justifications'], queryFn: listMyAbsenceJustifications });
  const submission = submissions?.find((entry) => entry.id === submissionId);

  const {
    data: items,
    isLoading: itemsLoading,
    error: itemsError,
  } = useQuery({ queryKey: ['justification-items', submissionId], queryFn: () => listAbsenceJustificationItems(submissionId) });

  const { data: accessLog } = useQuery({
    queryKey: ['justification-attachment-access-log', submissionId],
    queryFn: () => listAbsenceJustificationAttachmentAccessLog(submissionId),
    // RULE-JUST-11.2: opening this list is itself an access attempt against
    // the attachment's metadata, but NOT against its bytes — no need to
    // gate this behind an explicit click, unlike the download button below.
    retry: false,
  });

  const { data: schedule } = useQuery({ queryKey: ['student-schedule'], queryFn: listMySchedule });
  const sessionLabelBySessionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of schedule ?? []) {
      map.set(entry.classSessionId, `${entry.subjectName} — ${new Date(entry.scheduledStart).toLocaleString('pt-BR')}`);
    }
    return map;
  }, [schedule]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelAbsenceJustification(submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['justification-items', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['my-justifications'] });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => downloadAbsenceJustificationAttachment(submissionId),
    onSuccess: ({ blob, filename }) => {
      triggerBrowserDownload(blob, filename);
      queryClient.invalidateQueries({ queryKey: ['justification-attachment-access-log', submissionId] });
    },
  });

  // RULE-JUST-05.4: cancelling is only possible while NO item has been
  // decided yet — mirrors AbsenceJustificationSubmissionService.cancel()'s
  // own guard, here only used to decide whether to SHOW the button (the
  // backend is the actual enforcer).
  const canCancel = (items ?? []).length > 0 && (items ?? []).every((item: AbsenceJustificationItem) => item.status === 'under_review');

  return (
    <section>
      <Link to="/student/justifications" className={styles.backLink}>
        <ArrowLeft size={16} />
        Voltar para meus pedidos
      </Link>

      <PageHeader icon={FileCheck2} area="portal" title="Detalhes do pedido" />

      {submission && (
        <div className={styles.card}>
          <p className={styles.cardDates}>
            {submission.startDate === submission.endDate
              ? formatDateOnly(submission.startDate)
              : `${formatDateOnly(submission.startDate)} a ${formatDateOnly(submission.endDate)}`}
          </p>
          <p className={styles.cardMeta}>{LEGAL_CATEGORY_LABELS[submission.legalCategory]}</p>
          <p className={styles.cardDescription}>{submission.description}</p>
        </div>
      )}

      <h2>Anexo</h2>
      {downloadMutation.isError && <ErrorBanner message={errorMessage(downloadMutation.error)} />}
      <p>
        <button type="button" className={styles.iconButton} onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
          <Download size={16} />
          {downloadMutation.isPending ? 'Baixando…' : 'Baixar documento enviado'}
        </button>
      </p>
      <p>
        <small>
          Documento enviado por você — o sistema não verifica sua autenticidade. A verificação é o próprio ato de
          decisão do professor da matéria.
        </small>
      </p>

      {accessLog && accessLog.length > 0 && (
        <>
          <h2>Quem acessou este anexo</h2>
          <p>
            <small>Todo acesso é registrado, inclusive tentativas negadas e os seus próprios acessos (RULE-JUST-11.4).</small>
          </p>
          <ul className={styles.accessLogList}>
            {accessLog.map((entry) => (
              <li key={entry.id} className={styles.accessLogItem}>
                <Eye size={14} />
                <span>
                  {new Date(entry.occurredAt).toLocaleString('pt-BR')} — pessoa <code>{entry.accessedByPersonId}</code> —{' '}
                  {ACCESS_RESULT_LABEL[entry.accessResult]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Aulas do pedido</h2>
      {itemsLoading && <Loading />}
      {itemsError && <ErrorBanner message={errorMessage(itemsError)} />}
      {items && items.length === 0 && <p className={styles.empty}>Nenhuma aula neste pedido.</p>}
      {items && items.length > 0 && (
        <ul className={styles.itemList}>
          {items.map((item) => (
            <li key={item.id} className={styles.itemRow}>
              <span className={styles.itemMeta}>
                {sessionLabelBySessionId.get(item.classSessionId) ?? (
                  <>
                    Aula <code>{item.classSessionId}</code>
                  </>
                )}
              </span>
              <Badge label={ITEM_STATUS_BADGE[item.status].label} tone={ITEM_STATUS_BADGE[item.status].tone} />
            </li>
          ))}
        </ul>
      )}

      {canCancel && (
        <fieldset>
          <legend>Cancelar pedido</legend>
          {cancelMutation.isError && <ErrorBanner message={errorMessage(cancelMutation.error)} />}
          <p>
            <small>
              Só é possível cancelar enquanto nenhuma aula deste pedido tiver sido decidida. Depois de cancelado, não é
              possível reabrir — seria necessário enviar um novo pedido.
            </small>
          </p>
          <button
            type="button"
            className={`danger ${styles.iconButton}`}
            disabled={cancelMutation.isPending}
            onClick={() => {
              cancelMutation.mutate(undefined, { onSuccess: () => navigate('/student/justifications') });
            }}
          >
            <XCircle size={16} />
            {cancelMutation.isPending ? 'Cancelando…' : 'Cancelar pedido'}
          </button>
        </fieldset>
      )}
    </section>
  );
}
