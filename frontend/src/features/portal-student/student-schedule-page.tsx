import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { Badge, type BadgeTone } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { listMySchedule, type StudentScheduleEntry, type StudentScheduleSessionStatus } from './student-schedule-api';

// Same vocabulary/tone mapping as the admin cronograma screen
// (class-sessions-section.tsx) — a cancelled session must never look like a
// normal one here (AC-2, Frente 03 QA finding).
const STATUS_LABELS: Record<StudentScheduleSessionStatus, string> = {
  scheduled: 'Programada',
  edited: 'Editada pontualmente',
  cancelled: 'Cancelada',
};

const STATUS_TONES: Record<StudentScheduleSessionStatus, BadgeTone> = {
  scheduled: 'info',
  edited: 'warning',
  cancelled: 'danger',
};

// Aluno-only screen (roleContext.isStudent) — a student with no active
// matrícula gets the DataTable's empty message below rather than an error,
// since "no scheduled sessions" is an expected, not exceptional, state.
export function StudentSchedulePage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['student-schedule'], queryFn: listMySchedule });

  return (
    <section>
      <PageHeader
        icon={CalendarClock}
        area="portal"
        title="Meu cronograma"
        description="Aulas das turmas em que você está matriculado."
      />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<StudentScheduleEntry>
          rows={data}
          getRowKey={(entry) => entry.classSessionId}
          emptyMessage="Nenhuma aula agendada — você não está matriculado em nenhuma turma no momento."
          columns={[
            { header: 'Matéria', cell: (entry) => entry.subjectName },
            { header: 'Turma', cell: (entry) => entry.classGroupName },
            { header: 'Sala', cell: (entry) => entry.roomName ?? 'Nenhuma sala definida' },
            { header: 'Início', cell: (entry) => new Date(entry.scheduledStart).toLocaleString('pt-BR') },
            { header: 'Fim', cell: (entry) => new Date(entry.scheduledEnd).toLocaleString('pt-BR') },
            {
              header: 'Status',
              cell: (entry) => <Badge label={STATUS_LABELS[entry.status]} tone={STATUS_TONES[entry.status]} />,
            },
          ]}
        />
      )}
    </section>
  );
}
