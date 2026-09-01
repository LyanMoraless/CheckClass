import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import {
  getClassGroupSummary,
  getPersonHistory,
  getSessionRegister,
  type ClassGroupSummaryEntry,
  type PersonHistoryEntry,
  type SessionRegisterEntry,
} from './attendance-register-api';
import styles from './attendance-register-page.module.css';

type AttendanceStatus = 'present' | 'absent' | 'pending';

// Shared status vocabulary for both lookups below that carry a per-person
// status column. `null` only ever comes from the session register (a
// session the rules engine hasn't evaluated yet), never from person
// history — see the comment on SessionRegisterEntry.status in the api file.
function statusBadge(status: AttendanceStatus | null) {
  switch (status) {
    case 'present':
      return <Badge label="Presente" tone="success" />;
    case 'absent':
      return <Badge label="Ausente" tone="danger" />;
    case 'pending':
      return <Badge label="Pendente" tone="warning" />;
    default:
      return <Badge label="Ainda não avaliado" tone="neutral" />;
  }
}

// Read-only views over VIEW_ATTENDANCE_REGISTER. There's no list endpoint
// for "all sessions/people/class-groups I can see" — ids are copy-pasted in
// from the screens that create them (class group detail page shows both
// its own id and its sessions' ids; enrollments show personId).
export function AttendanceRegisterPage() {
  return (
    <section>
      <PageHeader
        icon={ClipboardCheck}
        area="core"
        title="Registro de presença"
        description="Consulte a lista de presença de uma aula, o histórico de uma pessoa ou o resumo consolidado de uma turma."
      />
      <div className={styles.stack}>
        <SessionRegisterLookup />
        <PersonHistoryLookup />
        <ClassGroupSummaryLookup />
      </div>
    </section>
  );
}

function SessionRegisterLookup() {
  const [classSessionId, setClassSessionId] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const { data, isFetching, error } = useQuery({
    queryKey: ['session-register', submittedId],
    queryFn: () => getSessionRegister(submittedId!),
    enabled: Boolean(submittedId),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmittedId(classSessionId);
  }

  return (
    <div className={styles.card}>
      <h2>Lista de presença da aula</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          ID da aula
          <input type="text" value={classSessionId} onChange={(event) => setClassSessionId(event.target.value)} required />
        </label>
        <button type="submit" className={styles.iconButton}>
          <Search size={16} />
          Consultar
        </button>
      </form>
      {isFetching && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<SessionRegisterEntry>
          rows={data}
          getRowKey={(entry) => entry.personId}
          emptyMessage="Nenhum aluno matriculado encontrado para esta aula."
          columns={[
            { header: 'Aluno', cell: (entry) => entry.fullName },
            { header: 'Status', cell: (entry) => statusBadge(entry.status) },
            { header: '% de presença', cell: (entry) => entry.attendancePercentage ?? '—' },
            { header: 'Minutos de presença', cell: (entry) => entry.totalPresenceMinutes ?? '—' },
            { header: 'Motivo pendente', cell: (entry) => entry.pendingReason ?? '—' },
          ]}
        />
      )}
    </div>
  );
}

function PersonHistoryLookup() {
  const [personId, setPersonId] = useState('');
  const [classGroupId, setClassGroupId] = useState('');
  const [submitted, setSubmitted] = useState<{ personId: string; classGroupId: string } | null>(null);
  const { data, isFetching, error } = useQuery({
    queryKey: ['person-history', submitted],
    queryFn: () => getPersonHistory(submitted!.personId, submitted!.classGroupId || undefined),
    enabled: Boolean(submitted),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted({ personId, classGroupId });
  }

  return (
    <div className={styles.card}>
      <h2>Histórico da pessoa</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          ID da pessoa
          <input type="text" value={personId} onChange={(event) => setPersonId(event.target.value)} required />
        </label>
        <label>
          ID da turma (filtro opcional)
          <input type="text" value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)} />
        </label>
        <button type="submit" className={styles.iconButton}>
          <Search size={16} />
          Consultar
        </button>
      </form>
      {isFetching && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<PersonHistoryEntry>
          rows={data}
          getRowKey={(entry) => entry.classSessionId}
          emptyMessage="Nenhuma aula consolidada encontrada para esta pessoa."
          columns={[
            { header: 'Início da aula', cell: (entry) => new Date(entry.scheduledStart).toLocaleString() },
            { header: 'Fim da aula', cell: (entry) => new Date(entry.scheduledEnd).toLocaleString() },
            { header: 'Status', cell: (entry) => statusBadge(entry.status) },
            { header: '% de presença', cell: (entry) => entry.attendancePercentage },
            { header: 'Motivo pendente', cell: (entry) => entry.pendingReason ?? '—' },
          ]}
        />
      )}
    </div>
  );
}

function ClassGroupSummaryLookup() {
  const [classGroupId, setClassGroupId] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const { data, isFetching, error } = useQuery({
    queryKey: ['class-group-summary', submittedId],
    queryFn: () => getClassGroupSummary(submittedId!),
    enabled: Boolean(submittedId),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmittedId(classGroupId);
  }

  return (
    <div className={styles.card}>
      <h2>Resumo da turma</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          ID da turma
          <input type="text" value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)} required />
        </label>
        <button type="submit" className={styles.iconButton}>
          <Search size={16} />
          Consultar
        </button>
      </form>
      {isFetching && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<ClassGroupSummaryEntry>
          rows={data}
          getRowKey={(entry) => entry.personId}
          emptyMessage="Nenhum aluno matriculado encontrado para esta turma."
          columns={[
            { header: 'Aluno', cell: (entry) => entry.fullName },
            { header: 'Aulas avaliadas', cell: (entry) => entry.sessionsEvaluated },
            { header: 'Presente', cell: (entry) => entry.presentCount },
            { header: 'Ausente', cell: (entry) => entry.absentCount },
            { header: 'Pendente', cell: (entry) => entry.pendingCount },
            { header: 'Taxa de presença', cell: (entry) => (entry.attendanceRate === null ? '—' : `${entry.attendanceRate.toFixed(1)}%`) },
          ]}
        />
      )}
    </div>
  );
}
