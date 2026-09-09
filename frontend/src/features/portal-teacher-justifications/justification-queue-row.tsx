import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download } from 'lucide-react';
import { useState } from 'react';
import { ErrorBanner } from '../../components/error-banner';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage, triggerBrowserDownload } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { downloadAbsenceJustificationAttachment, LEGAL_CATEGORY_LABELS } from '../portal-student-justifications/absence-justification-api';
import { decideAbsenceJustificationItem, type AbsenceJustificationQueueItem, type DecideAbsenceJustificationItemInput } from './absence-justification-decision-api';
import styles from './justification-queue-page.module.css';

// RULE-JUST-08/24: the professor of THIS specific (turma, matéria) decides —
// enforced server-side (isSubjectTeacher check inside
// AbsenceJustificationDecisionService.decide), this row never re-derives
// that authorization on its own.
//
// classGroupId/subjectId/classSessionId/personId are shown as raw ids
// (<code>), the SAME limitation PendingReviewRow already has for
// classSessionId/personId — the queue endpoint (see
// AbsenceJustificationDecisionService.listQueueForTeacher) returns only
// AbsenceJustificationItemEntity's own denormalized columns plus the joined
// legalCategory/description, no joined names/dates. classGroupName is
// resolved from roleContext.teaching (already loaded by AuthProvider) since
// that mapping IS 1:1 by classGroupId; subject name has no equivalent
// mapping available anywhere on the frontend today (flagged in the Frontend
// Implementation Summary).
interface JustificationQueueRowProps {
  item: AbsenceJustificationQueueItem;
  queryKey: unknown[];
  // Invalidated alongside queryKey on a successful decision, so an approval
  // shows up immediately in the "decididos" list on JustificationQueuePage
  // (that list is now fetched from GET .../decided?status=approved rather
  // than kept in local React state).
  decidedQueryKey: unknown[];
}

export function JustificationQueueRow({ item, queryKey, decidedQueryKey }: JustificationQueueRowProps) {
  const queryClient = useQueryClient();
  const { hasPermission, roleContext } = useAuth();
  const canViewAttachment = hasPermission('view_absence_justification_attachment');

  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [note, setNote] = useState('');

  const classGroupName = roleContext.teaching.find((entry) => entry.classGroupId === item.classGroupId)?.classGroupName;

  const decideMutation = useMutation({
    mutationFn: (input: DecideAbsenceJustificationItemInput) => decideAbsenceJustificationItem(item.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: decidedQueryKey });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => downloadAbsenceJustificationAttachment(item.submissionId),
    onSuccess: ({ blob, filename }) => triggerBrowserDownload(blob, filename),
  });

  function handleDecide() {
    if (decision === 'rejected' && !note.trim()) {
      return;
    }
    decideMutation.mutate({ decision, note: note.trim() || undefined });
  }

  return (
    <fieldset>
      <legend>Aula {classGroupName ?? <code>{item.classGroupId}</code>}</legend>
      <p className={styles.meta}>
        Matéria: <code>{item.subjectId}</code>
      </p>
      <p className={styles.meta}>
        Aula: <code>{item.classSessionId}</code>
      </p>
      <p className={styles.meta}>
        Aluno: <code>{item.personId}</code>
      </p>
      <p className={styles.meta}>Motivo alegado: {LEGAL_CATEGORY_LABELS[item.legalCategory]}</p>
      <p className={styles.description}>{item.description}</p>

      <div className={styles.actionsRow}>
        {canViewAttachment ? (
          <button type="button" className={styles.iconButton} onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
            <Download size={16} />
            {downloadMutation.isPending ? 'Baixando…' : 'Ver documento enviado'}
          </button>
        ) : (
          <PermissionHint permission="view_absence_justification_attachment" />
        )}
      </div>
      {downloadMutation.isError && <ErrorBanner message={errorMessage(downloadMutation.error)} />}
      <p>
        <small>Documento enviado pelo aluno — o sistema não verifica sua autenticidade. A decisão abaixo é a verificação.</small>
      </p>

      {decideMutation.isError && <ErrorBanner message={errorMessage(decideMutation.error)} />}
      <label>
        Decisão
        <select value={decision} onChange={(event) => setDecision(event.target.value as 'approved' | 'rejected')}>
          <option value="approved">Aprovar (retira a falta)</option>
          <option value="rejected">Rejeitar (mantém a falta)</option>
        </select>
      </label>
      <label>
        Nota {decision === 'rejected' ? '(obrigatória ao rejeitar)' : '(opcional)'}
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} required={decision === 'rejected'} />
      </label>
      <button
        type="button"
        className={styles.iconButton}
        onClick={handleDecide}
        disabled={decideMutation.isPending || (decision === 'rejected' && !note.trim())}
      >
        <CheckCircle2 size={16} />
        {decideMutation.isPending ? 'Registrando…' : 'Registrar decisão'}
      </button>
    </fieldset>
  );
}
