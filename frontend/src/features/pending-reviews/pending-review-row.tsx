import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { errorMessage } from '../../lib/api-client';
import { resolvePendingReview, type PendingReview } from './pending-reviews-api';
import styles from './pending-reviews-page.module.css';

// Extracted from pending-reviews-page.tsx so the Portal's
// Professor/Coordenador/Direção pending-review screens can reuse the exact
// same resolution UI/mutation instead of a second copy of it — the two
// screens only differ in which list query feeds them (tenant-wide vs.
// "mine"), never in how a single review gets resolved.
export function PendingReviewRow({ review, queryKey }: { review: PendingReview; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<'present' | 'absent'>('present');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => resolvePendingReview(review.id, { decision, note: note || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
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
