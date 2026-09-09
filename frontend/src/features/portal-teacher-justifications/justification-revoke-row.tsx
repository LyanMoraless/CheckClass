import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { errorMessage } from '../../lib/api-client';
import { ITEM_STATUS_BADGE } from '../portal-student-justifications/absence-justification-api';
import { revokeAbsenceJustificationApproval, type AbsenceJustificationQueueItem } from './absence-justification-decision-api';
import styles from './justification-queue-page.module.css';

// RULE-JUST-17: revoking an approval is a NEW, append-only act — it never
// undoes the original approval, and the motivo is ALWAYS required (unlike
// approving, where a note is optional). item comes from GET
// .../decided?status=approved (see JustificationQueuePage), so this reaches
// every approval this professor has ever made, not just the ones decided
// earlier in the current browser session.
//
// That listing does NOT re-check RULE-JUST-17.3's período de apuração
// window — only POST .../revoke does, for real — so a revoke attempt here
// can still come back with a 400 ("período não é mais o corrente"), surfaced
// below through the normal ErrorBanner rather than pre-validated on the
// client.
export function JustificationRevokeRow({ item, queryKey }: { item: AbsenceJustificationQueueItem; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: () => revokeAbsenceJustificationApproval(item.id, note.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <li className={styles.decidedRow}>
      <div>
        <p className={styles.meta}>
          Aula <code>{item.classSessionId}</code> — aluno <code>{item.personId}</code>
        </p>
        <Badge label={ITEM_STATUS_BADGE[item.status].label} tone={ITEM_STATUS_BADGE[item.status].tone} />
      </div>

      {item.status === 'approved' && !isExpanded && (
        <button type="button" className={`secondary ${styles.iconButton}`} onClick={() => setIsExpanded(true)}>
          <RotateCcw size={14} />
          Revogar aprovação
        </button>
      )}

      {item.status === 'approved' && isExpanded && (
        <div>
          {revokeMutation.isError && <ErrorBanner message={errorMessage(revokeMutation.error)} />}
          <label>
            Motivo da revogação (obrigatório)
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} required />
          </label>
          <button
            type="button"
            className={`danger ${styles.iconButton}`}
            disabled={revokeMutation.isPending || !note.trim()}
            onClick={() => revokeMutation.mutate()}
          >
            <RotateCcw size={14} />
            {revokeMutation.isPending ? 'Revogando…' : 'Confirmar revogação'}
          </button>
        </div>
      )}
    </li>
  );
}
