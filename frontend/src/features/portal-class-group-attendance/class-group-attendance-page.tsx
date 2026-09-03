import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { getClassGroupAttendance, type ClassGroupAttendanceEntry } from './class-group-attendance-api';
import styles from './class-group-attendance-page.module.css';

// Shared by all three authority-scoped nav groups that can reach a turma's
// attendance (Professor via /teacher/class-groups, Coordenador via
// /coordinator/class-groups, Direção via /direction/class-groups) — the
// backend already treats them uniformly (LeadershipScopeService), so one
// route/component serves all three rather than three near-identical copies.
// "Voltar" goes to browser history instead of a fixed link, since the
// correct back-target depends on which of the three lists sent the person
// here.
export function ClassGroupAttendancePage() {
  const { classGroupId } = useParams<{ classGroupId: string }>();
  const navigate = useNavigate();

  if (!classGroupId) {
    return <ErrorBanner message="ID da turma ausente na URL" />;
  }

  return <ClassGroupAttendanceContent classGroupId={classGroupId} onBack={() => navigate(-1)} />;
}

function ClassGroupAttendanceContent({ classGroupId, onBack }: { classGroupId: string; onBack: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['class-group-attendance', classGroupId],
    queryFn: () => getClassGroupAttendance(classGroupId),
  });

  return (
    <section className={styles.page}>
      <button type="button" className={`secondary ${styles.backLink}`} onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar
      </button>
      <PageHeader
        icon={ClipboardCheck}
        area="portal"
        title="Presença da turma"
        description="Resumo de presença de cada aluno matriculado nesta turma."
      />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<ClassGroupAttendanceEntry>
          rows={data}
          getRowKey={(entry) => entry.personId}
          emptyMessage="Nenhum aluno matriculado nesta turma ainda."
          columns={[
            { header: 'Aluno', cell: (entry) => entry.fullName },
            { header: 'Aulas avaliadas', cell: (entry) => entry.sessionsEvaluated },
            { header: 'Presente', cell: (entry) => entry.presentCount },
            { header: 'Ausente', cell: (entry) => entry.absentCount },
            { header: 'Pendente', cell: (entry) => entry.pendingCount },
            {
              header: 'Taxa de presença',
              cell: (entry) => (entry.attendanceRate === null ? '—' : `${entry.attendanceRate.toFixed(1)}%`),
            },
          ]}
        />
      )}
    </section>
  );
}
