import { useMutation } from '@tanstack/react-query';
import { FileCheck2, Info, Send } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import {
  ABSENCE_JUSTIFICATION_ATTACHMENT_ACCEPT,
  ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES,
  ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES,
  ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES,
  createAbsenceJustification,
  EXCLUSION_REASON_LABELS,
  ITEM_STATUS_BADGE,
  LEGAL_CATEGORY_LABELS,
  type AbsenceJustificationLegalCategory,
  type CreateAbsenceJustificationResult,
} from './absence-justification-api';
import styles from './absence-justification-page.module.css';

const ALLOWED_MIME_TYPES: readonly string[] = ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES;

// Aluno-only screen (roleContext.isStudent) — RULE-JUST-01 addendum: the
// aluno informs a DATE RANGE and NEVER picks a matéria — the system derives
// which sessions/matérias are affected (RULE-JUST-06/13/14). The anexo is
// always required (no request without a file) and is validated here purely
// as UX (fail fast before a wasted multipart upload) — the backend
// re-validates by magic-bytes regardless (RULE-JUST-11).
export function NewJustificationPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [legalCategory, setLegalCategory] = useState<AbsenceJustificationLegalCategory>(
    ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES[0],
  );
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const mutation = useMutation({ mutationFn: createAbsenceJustification });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(selected.type)) {
      setFile(null);
      setFileError('Formato não aceito — envie um arquivo em PDF, JPEG ou PNG.');
      return;
    }
    if (selected.size > ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES) {
      setFile(null);
      setFileError('Arquivo maior que o limite de 10 MB.');
      return;
    }
    setFile(selected);
    setFileError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setFileError('O anexo é obrigatório — não é possível enviar um pedido sem arquivo.');
      return;
    }
    mutation.mutate({ startDate, endDate, legalCategory, description, file });
  }

  const canSubmit = Boolean(startDate && endDate && description.trim() && file) && !fileError;

  return (
    <section>
      <PageHeader
        icon={FileCheck2}
        area="portal"
        title="Justificar falta"
        description="Informe o período da ausência — o sistema identifica sozinho quais aulas e matérias entram no pedido, uma decisão por aula."
      />

      {!mutation.isSuccess && (
        <>
          <p className={styles.hintNote}>
            <Info size={16} className={styles.hintIcon} />
            Você não escolhe a matéria: todas as aulas que você faltou dentro do período informado, em qualquer matéria,
            entram automaticamente no pedido. Cada aula é decidida individualmente pelo professor correspondente — o
            resultado pode ser parcial (algumas aulas abonadas, outras não).
          </p>

          <fieldset>
            <legend>Novo pedido</legend>
            <form onSubmit={handleSubmit}>
              {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
              <label>
                Data inicial
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
              </label>
              <label>
                Data final
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </label>
              <label>
                Categoria legal da ausência
                <select
                  value={legalCategory}
                  onChange={(event) => setLegalCategory(event.target.value as AbsenceJustificationLegalCategory)}
                  required
                >
                  {ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {LEGAL_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Descrição
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  maxLength={4000}
                  placeholder="Descreva o motivo da ausência — complementa a categoria selecionada acima."
                />
              </label>
              <label>
                Atestado ou documento comprobatório (PDF, JPEG ou PNG, até 10 MB)
                <input type="file" accept={ABSENCE_JUSTIFICATION_ATTACHMENT_ACCEPT} onChange={handleFileChange} required />
              </label>
              <p className={styles.fileHint}>
                <small>
                  Apenas o professor da matéria decide o pedido — o sistema não verifica a autenticidade do documento
                  enviado, apenas registra que foi enviado por você.
                </small>
              </p>
              {fileError && <ErrorBanner message={fileError} />}
              <button type="submit" className={styles.iconButton} disabled={!canSubmit || mutation.isPending}>
                <Send size={16} />
                {mutation.isPending ? 'Enviando…' : 'Enviar pedido'}
              </button>
            </form>
          </fieldset>
        </>
      )}

      {mutation.isSuccess && <SubmissionResult result={mutation.data} />}
    </section>
  );
}

function SubmissionResult({ result }: { result: CreateAbsenceJustificationResult }) {
  return (
    <div>
      <InfoBanner
        message={`Pedido enviado — ${result.items.length} ${result.items.length === 1 ? 'aula entrou' : 'aulas entraram'} em análise.`}
      />

      {result.items.length > 0 && (
        <>
          <h2>Aulas incluídas no pedido</h2>
          <ul className={styles.itemList}>
            {result.items.map((item) => (
              <li key={item.id} className={styles.itemRow}>
                <span>
                  Aula <code>{item.classSessionId}</code>
                </span>
                <Badge label={ITEM_STATUS_BADGE[item.status].label} tone={ITEM_STATUS_BADGE[item.status].tone} />
              </li>
            ))}
          </ul>
        </>
      )}

      {result.excluded.length > 0 && (
        <>
          <h2>Aulas do período que não entraram no pedido</h2>
          <p>
            <small>Estas aulas do intervalo informado não geraram item de justificativa, pelos motivos abaixo.</small>
          </p>
          <ul className={styles.excludedList}>
            {result.excluded.map((excluded) => (
              <li key={excluded.classSessionId} className={styles.excludedItem}>
                Aula <code>{excluded.classSessionId}</code> — {EXCLUSION_REASON_LABELS[excluded.reason]}
              </li>
            ))}
          </ul>
        </>
      )}

      <p>
        <Link to="/student/justifications">Ver meus pedidos</Link>
      </p>
    </div>
  );
}
