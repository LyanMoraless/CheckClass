import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { PersonIdField } from '../../components/person-id-field';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listRooms } from '../rooms/rooms-api';
import {
  createClassSession,
  enrollPerson,
  listClassSessions,
  listEnrollments,
  type ClassSession,
  type Enrollment,
} from './class-groups-api';

export function ClassGroupDetailPage() {
  const { classGroupId } = useParams<{ classGroupId: string }>();
  if (!classGroupId) {
    return <ErrorBanner message="Missing class group id in the URL" />;
  }

  return (
    <section>
      <p>
        <Link to="/class-groups">&larr; Back to class groups</Link>
      </p>
      <h1>Class group detail</h1>
      <p>
        Class group ID: <code>{classGroupId}</code>
      </p>
      <EnrollmentsSection classGroupId={classGroupId} />
      <SessionsSection classGroupId={classGroupId} />
    </section>
  );
}

function EnrollmentsSection({ classGroupId }: { classGroupId: string }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const {
    data: enrollments,
    isLoading,
    error,
  } = useQuery({ queryKey: ['enrollments', classGroupId], queryFn: () => listEnrollments(classGroupId) });

  const [personId, setPersonId] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const mutation = useMutation({
    mutationFn: () => enrollPerson(classGroupId, { personId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', classGroupId] });
      setPersonId('');
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div>
      <h2>Enrollments</h2>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {enrollments && (
        <DataTable<Enrollment>
          rows={enrollments}
          getRowKey={(enrollment) => enrollment.id}
          columns={[
            { header: 'Person ID', cell: (enrollment) => enrollment.personId },
            { header: 'Role', cell: (enrollment) => enrollment.role },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Enroll a person</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <PersonIdField label="Person" value={personId} onChange={setPersonId} required />
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value as 'student' | 'teacher')}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </label>
          <button type="submit" disabled={mutation.isPending || !personId}>
            {mutation.isPending ? 'Enrolling…' : 'Enroll'}
          </button>
        </form>
      </fieldset>
    </div>
  );
}

function SessionsSection({ classGroupId }: { classGroupId: string }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: listRooms });
  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({ queryKey: ['class-sessions', classGroupId], queryFn: () => listClassSessions(classGroupId) });

  const [roomId, setRoomId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      createClassSession({
        classGroupId,
        roomId,
        scheduledStart: new Date(scheduledStart).toISOString(),
        scheduledEnd: new Date(scheduledEnd).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] });
      setScheduledStart('');
      setScheduledEnd('');
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  function roomName(id: string): string {
    return rooms?.find((room) => room.id === id)?.name ?? id;
  }

  return (
    <div>
      <h2>Sessions</h2>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {sessions && (
        <DataTable<ClassSession>
          rows={sessions}
          getRowKey={(session) => session.id}
          columns={[
            { header: 'Room', cell: (session) => roomName(session.roomId) },
            { header: 'Start', cell: (session) => new Date(session.scheduledStart).toLocaleString() },
            { header: 'End', cell: (session) => new Date(session.scheduledEnd).toLocaleString() },
            { header: 'Session ID', cell: (session) => <code>{session.id}</code> },
          ]}
        />
      )}
      <p>
        <small>
          Copy a session ID above to look it up in <Link to="/register">Attendance register</Link>.
        </small>
      </p>

      <fieldset disabled={!canManage}>
        <legend>New session</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Room
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required>
              <option value="" disabled>
                Select a room
              </option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scheduled start
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
              required
            />
          </label>
          <label>
            Scheduled end
            <input type="datetime-local" value={scheduledEnd} onChange={(event) => setScheduledEnd(event.target.value)} required />
          </label>
          <button type="submit" disabled={mutation.isPending || !roomId}>
            {mutation.isPending ? 'Creating…' : 'Create session'}
          </button>
        </form>
      </fieldset>
    </div>
  );
}
