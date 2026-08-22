import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { errorMessage } from '../../lib/api-client';
import {
  getClassGroupSummary,
  getPersonHistory,
  getSessionRegister,
  type ClassGroupSummaryEntry,
  type PersonHistoryEntry,
  type SessionRegisterEntry,
} from './attendance-register-api';

// Read-only views over VIEW_ATTENDANCE_REGISTER. There's no list endpoint
// for "all sessions/people/class-groups I can see" — ids are copy-pasted in
// from the screens that create them (class group detail page shows both
// its own id and its sessions' ids; enrollments show personId).
export function AttendanceRegisterPage() {
  return (
    <section>
      <h1>Attendance register</h1>
      <SessionRegisterLookup />
      <PersonHistoryLookup />
      <ClassGroupSummaryLookup />
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
    <div>
      <h2>Session roster</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Class session ID
          <input type="text" value={classSessionId} onChange={(event) => setClassSessionId(event.target.value)} required />
        </label>
        <button type="submit">Look up</button>
      </form>
      {isFetching && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<SessionRegisterEntry>
          rows={data}
          getRowKey={(entry) => entry.personId}
          emptyMessage="No enrolled students found for this session."
          columns={[
            { header: 'Student', cell: (entry) => entry.fullName },
            { header: 'Status', cell: (entry) => entry.status ?? 'not yet evaluated' },
            { header: 'Attendance %', cell: (entry) => entry.attendancePercentage ?? '—' },
            { header: 'Presence minutes', cell: (entry) => entry.totalPresenceMinutes ?? '—' },
            { header: 'Pending reason', cell: (entry) => entry.pendingReason ?? '—' },
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
    <div>
      <h2>Person history</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Person ID
          <input type="text" value={personId} onChange={(event) => setPersonId(event.target.value)} required />
        </label>
        <label>
          Class group ID (optional filter)
          <input type="text" value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)} />
        </label>
        <button type="submit">Look up</button>
      </form>
      {isFetching && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<PersonHistoryEntry>
          rows={data}
          getRowKey={(entry) => entry.classSessionId}
          emptyMessage="No consolidated sessions found for this person."
          columns={[
            { header: 'Session start', cell: (entry) => new Date(entry.scheduledStart).toLocaleString() },
            { header: 'Session end', cell: (entry) => new Date(entry.scheduledEnd).toLocaleString() },
            { header: 'Status', cell: (entry) => entry.status },
            { header: 'Attendance %', cell: (entry) => entry.attendancePercentage },
            { header: 'Pending reason', cell: (entry) => entry.pendingReason ?? '—' },
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
    <div>
      <h2>Class group summary</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Class group ID
          <input type="text" value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)} required />
        </label>
        <button type="submit">Look up</button>
      </form>
      {isFetching && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<ClassGroupSummaryEntry>
          rows={data}
          getRowKey={(entry) => entry.personId}
          emptyMessage="No enrolled students found for this class group."
          columns={[
            { header: 'Student', cell: (entry) => entry.fullName },
            { header: 'Sessions evaluated', cell: (entry) => entry.sessionsEvaluated },
            { header: 'Present', cell: (entry) => entry.presentCount },
            { header: 'Absent', cell: (entry) => entry.absentCount },
            { header: 'Pending', cell: (entry) => entry.pendingCount },
            { header: 'Attendance rate', cell: (entry) => (entry.attendanceRate === null ? '—' : `${entry.attendanceRate.toFixed(1)}%`) },
          ]}
        />
      )}
    </div>
  );
}
