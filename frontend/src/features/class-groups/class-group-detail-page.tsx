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
import { ClassSessionsSection } from '../class-schedule/class-sessions-section';
import { ScheduleSlotsSection } from '../class-schedule/schedule-slots-section';
import { listRooms } from '../rooms/rooms-api';
import { enrollPerson, listClassGroups, listEnrollments, type Enrollment } from './class-groups-api';

export function ClassGroupDetailPage() {
  const { classGroupId } = useParams<{ classGroupId: string }>();
  if (!classGroupId) {
    return <ErrorBanner message="ID da turma ausente na URL" />;
  }
  // Hooks below this point live in a child component, never here — calling
  // them after the guard above would violate the rules of hooks (a
  // conditional early return ahead of them in the same function body).
  return <ClassGroupDetailContent classGroupId={classGroupId} />;
}

function ClassGroupDetailContent({ classGroupId }: { classGroupId: string }) {
  // No GET /v1/class-groups/:id endpoint exists — resolved from the list,
  // same lookup-from-list pattern already used by class-groups-page.tsx.
  const { data: classGroups } = useQuery({ queryKey: ['class-groups'], queryFn: () => listClassGroups() });
  const classGroup = classGroups?.find((group) => group.id === classGroupId);
  const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: listRooms });

  // RULE-INST-06: the room already assigned to the turma must be visible
  // directly on this operational screen (Cronograma de aulas, detalhe de
  // turma), not only inside Configurações/Salas.
  const roomLabel = classGroup?.roomId
    ? (rooms?.find((room) => room.id === classGroup.roomId)?.name ?? classGroup.roomId)
    : 'Nenhuma sala definida';
  const termLabel =
    classGroup?.termStartDate && classGroup?.termEndDate
      ? `${new Date(`${classGroup.termStartDate}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} — ${new Date(`${classGroup.termEndDate}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
      : 'Período letivo não definido';

  return (
    <section>
      <p>
        <Link to="/class-groups">&larr; Voltar para turmas</Link>
      </p>
      <h1>{classGroup ? classGroup.name : 'Detalhes da turma'}</h1>
      <p>
        Sala: {roomLabel} · Período letivo: {termLabel}
      </p>
      <p>
        <small>
          ID da turma: <code>{classGroupId}</code>
        </small>
      </p>
      <EnrollmentsSection classGroupId={classGroupId} />
      <ScheduleSlotsSection classGroupId={classGroupId} classGroup={classGroup} />
      <ClassSessionsSection classGroupId={classGroupId} rooms={rooms} classGroupRoomId={classGroup?.roomId} />
      <p>
        <small>
          Copie um ID de aula na lista de aulas acima para consultá-lo em <Link to="/register">Registro de presença</Link>.
        </small>
      </p>
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
