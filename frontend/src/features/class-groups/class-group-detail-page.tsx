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
    return <ErrorBanner message="ID da turma ausente na URL" />;
  }

  return (
    <section>
      <p>
        <Link to="/class-groups">&larr; Voltar para turmas</Link>
      </p>
      <h1>Detalhes da turma</h1>
      <p>
        ID da turma: <code>{classGroupId}</code>
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
      <h2>Matrículas</h2>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {enrollments && (
        <DataTable<Enrollment>
          rows={enrollments}
          getRowKey={(enrollment) => enrollment.id}
          columns={[
            { header: 'ID da pessoa', cell: (enrollment) => enrollment.personId },
            { header: 'Papel', cell: (enrollment) => enrollment.role },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Matricular pessoa</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <PersonIdField label="Pessoa" value={personId} onChange={setPersonId} required />
          <label>
            Papel
            <select value={role} onChange={(event) => setRole(event.target.value as 'student' | 'teacher')}>
              <option value="student">Aluno</option>
              <option value="teacher">Professor</option>
            </select>
          </label>
          <button type="submit" disabled={mutation.isPending || !personId}>
            {mutation.isPending ? 'Matriculando…' : 'Matricular'}
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
      <h2>Aulas</h2>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {sessions && (
        <DataTable<ClassSession>
          rows={sessions}
          getRowKey={(session) => session.id}
          columns={[
            { header: 'Sala', cell: (session) => roomName(session.roomId) },
            { header: 'Início', cell: (session) => new Date(session.scheduledStart).toLocaleString() },
            { header: 'Fim', cell: (session) => new Date(session.scheduledEnd).toLocaleString() },
            { header: 'ID da aula', cell: (session) => <code>{session.id}</code> },
          ]}
        />
      )}
      <p>
        <small>
          Copie um ID de aula acima para consultá-lo em <Link to="/register">Registro de presença</Link>.
        </small>
      </p>

      <fieldset disabled={!canManage}>
        <legend>Nova aula</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Sala
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required>
              <option value="" disabled>
                Selecione uma sala
              </option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início programado
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
              required
            />
          </label>
          <label>
            Fim programado
            <input type="datetime-local" value={scheduledEnd} onChange={(event) => setScheduledEnd(event.target.value)} required />
          </label>
          <button type="submit" disabled={mutation.isPending || !roomId}>
            {mutation.isPending ? 'Criando…' : 'Criar aula'}
          </button>
        </form>
      </fieldset>
    </div>
  );
}
