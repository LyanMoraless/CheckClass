import { useQuery } from '@tanstack/react-query';
import { FileCheck2, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { LEGAL_CATEGORY_LABELS, listMyAbsenceJustifications, type AbsenceJustificationSubmission } from './absence-justification-api';
import styles from './absence-justification-page.module.css';

// "YYYY-MM-DD" -> "DD/MM/AAAA" read as plain numbers, never through
// `new Date(...)` — same reasoning/precedent as student-warnings-page.tsx's
// formatDateOnly (start_date/end_date are DATE columns, no time component).
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

// Aluno-only screen — RULE-JUST-06: a submission has NO aggregate status
// column on purpose ("aprovado"/"rejeitado" são estados do ITEM, não do
// envio), so this list only shows submission-level facts (período,
// categoria, descrição, quando foi enviado). Per-item status only appears
// once the student opens a specific pedido's detail page.
export function MyJustificationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['my-justifications'], queryFn: listMyAbsenceJustifications });

  return (
    <section>
      <PageHeader
        icon={FileCheck2}
        area="portal"
        title="Meus pedidos de justificativa"
        description="Todo pedido enviado, mais recente primeiro. Abra um pedido para ver o status de cada aula e cancelar, se ainda possível."
        actions={
          <button type="button" className={styles.iconButton} onClick={() => navigate('/student/justifications/new')}>
            <Plus size={16} />
            Novo pedido
          </button>
        }
      />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && data.length === 0 && <p className={styles.empty}>Você ainda não enviou nenhum pedido de justificativa.</p>}
      {data && data.length > 0 && (
        <ul className={styles.cardList}>
          {data.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SubmissionCard({ submission }: { submission: AbsenceJustificationSubmission }) {
  const rangeLabel =
    submission.startDate === submission.endDate
      ? formatDateOnly(submission.startDate)
      : `${formatDateOnly(submission.startDate)} a ${formatDateOnly(submission.endDate)}`;

  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardDates}>{rangeLabel}</span>
        <Link to={`/student/justifications/${submission.id}`}>Ver detalhes</Link>
      </div>
      <p className={styles.cardMeta}>{LEGAL_CATEGORY_LABELS[submission.legalCategory]}</p>
      <p className={styles.cardDescription}>{submission.description}</p>
      <p className={styles.cardMeta}>
        <small>Enviado em {new Date(submission.createdAt).toLocaleString('pt-BR')}</small>
      </p>
    </li>
  );
}
