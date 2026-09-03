import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { AVAILABILITY_STATE_LABELS, SESSION_STATUS_LABELS } from '../exams/exams-api';
import { listMyExams, type StudentExamSummary } from './student-exams-api';

// Only PUBLISHED exams of turmas where the student has an ACTIVE enrollment
// ever reach this list — both filters live server-side (RULE-EXAM-16 and the
// draft decision of 2026-09-03), so there is nothing to hide here.
export function StudentExamsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['my-exams'], queryFn: listMyExams });

  return (
    <section>
      <PageHeader
        icon={FileText}
        area="portal"
        title="Minhas provas"
        description="Provas das suas turmas. Você tem uma única tentativa em cada uma."
      />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<StudentExamSummary>
          rows={data}
          getRowKey={(exam) => exam.examId}
          emptyMessage="Nenhuma prova disponível para você no momento."
          columns={[
            { header: 'Prova', cell: (exam) => exam.title },
            {
              header: 'Janela',
              cell: (exam) =>
                `${new Date(exam.availableFrom).toLocaleString('pt-BR')} — ${new Date(exam.availableUntil).toLocaleString('pt-BR')}`,
            },
            { header: 'Duração', cell: (exam) => (exam.durationMinutes ? `${exam.durationMinutes} min` : 'Sem limite') },
            {
              header: 'Situação',
              cell: (exam) => <Badge tone={sessionTone(exam)} label={sessionLabel(exam)} />,
            },
            {
              header: 'Ação',
              cell: (exam) =>
                canEnter(exam) ? (
                  <Link to={`/student/exams/${exam.examId}`}>
                    {exam.sessionState === 'IN_PROGRESS' ? 'Continuar' : 'Iniciar prova'}
                  </Link>
                ) : (
                  <span>—</span>
                ),
            },
          ]}
        />
      )}
    </section>
  );
}

// A student may enter only while the window is open and the session has not
// reached a terminal state — the same conditions the server enforces, worth
// mirroring so we don't offer a link that is going to 403.
function canEnter(exam: StudentExamSummary): boolean {
  if (exam.availabilityState !== 'EXAM_AVAILABLE') {
    return false;
  }
  return exam.sessionState === 'AVAILABLE' || exam.sessionState === 'IN_PROGRESS' || exam.sessionState === 'NOT_STARTED';
}

function sessionLabel(exam: StudentExamSummary): string {
  // Before the student has a session, what matters is the window; after, the
  // session's own state is the more specific truth.
  if (exam.sessionState === 'NOT_STARTED' || exam.sessionState === 'AVAILABLE') {
    return AVAILABILITY_STATE_LABELS[exam.availabilityState] ?? exam.availabilityState;
  }
  return SESSION_STATUS_LABELS[exam.sessionState] ?? exam.sessionState;
}

function sessionTone(exam: StudentExamSummary): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (exam.sessionState) {
    case 'IN_PROGRESS':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'TERMINATED':
      return 'danger';
    case 'EXPIRED':
    case 'ABANDONED':
      return 'warning';
    default:
      return exam.availabilityState === 'EXAM_AVAILABLE' ? 'success' : 'neutral';
  }
}
