import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { listMySchedule } from './student-schedule-api';
import { listMyAttendance, type StudentAttendanceEntry } from './student-attendance-api';
import styles from './student-attendance-page.module.css';

// Same status vocabulary/tone mapping as attendance-register-page.tsx's
// statusBadge — kept local rather than imported since that one also handles
// the session-register's extra `null` ("not evaluated yet") case, which
// never applies to this self-scoped, already-consolidated view.
function statusBadge(status: StudentAttendanceEntry['status']) {
  switch (status) {
    case 'present':
      return <Badge label="Presente" tone="success" />;
    case 'absent':
      return <Badge label="Ausente" tone="danger" />;
    case 'pending':
      return <Badge label="Pendente" tone="warning" />;
  }
}

// Aluno-only screen (roleContext.isStudent). classGroupId filter is optional
// — left blank shows every turma's history at once, same default as the
// admin-facing PersonHistoryLookup this mirrors. The turma options come from
// the student's own schedule (already fetched by the sibling cronograma
// screen) instead of asking the student to type a UUID they have no way to
// know (QA finding, Frente 03: AC-4 was technically satisfied but
// unusable).
export function StudentAttendancePage() {
  const [classGroupId, setClassGroupId] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-attendance', classGroupId],
    queryFn: () => listMyAttendance(classGroupId || undefined),
  });
  const { data: schedule } = useQuery({ queryKey: ['student-schedule'], queryFn: listMySchedule });
  const classGroupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of schedule ?? []) {
      seen.set(entry.classGroupId, entry.classGroupName);
    }
    return [...seen.entries()];
  }, [schedule]);

  return (
    <section>
      <PageHeader
        icon={ClipboardCheck}
        area="portal"
        title="Minhas faltas"
        description="Seu histórico de presença consolidado, aula a aula."
      />
      <label className={styles.filter}>
        Turma (filtro opcional)
        <select value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)}>
          <option value="">Todas as turmas</option>
          {classGroupOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<StudentAttendanceEntry>
          rows={data}
          getRowKey={(entry) => entry.classSessionId}
          emptyMessage="Nenhuma aula consolidada ainda."
          columns={[
            { header: 'Início da aula', cell: (entry) => new Date(entry.scheduledStart).toLocaleString('pt-BR') },
            { header: 'Fim da aula', cell: (entry) => new Date(entry.scheduledEnd).toLocaleString('pt-BR') },
            { header: 'Status', cell: (entry) => statusBadge(entry.status) },
            { header: '% de presença', cell: (entry) => `${entry.attendancePercentage.toFixed(1)}%` },
            { header: 'Motivo pendente', cell: (entry) => entry.pendingReason ?? '—' },
          ]}
        />
      )}
    </section>
  );
}
