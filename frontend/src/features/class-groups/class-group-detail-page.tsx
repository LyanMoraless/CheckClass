import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { PersonIdField } from '../../components/person-id-field';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { ClassSessionsSection } from '../class-schedule/class-sessions-section';
import { ScheduleSlotsSection } from '../class-schedule/schedule-slots-section';
import { listRooms } from '../rooms/rooms-api';
import { listSubjects } from '../subjects/subjects-api';
import {
  addClassGroupSubject,
  enrollPerson,
  listClassGroupSubjects,
  listClassGroups,
  listEnrollments,
  removeClassGroupSubject,
  type ClassGroup,
  type ClassGroupSubject,
  type Enrollment,
} from './class-groups-api';
import styles from './class-group-detail-page.module.css';

// Same Portuguese labels already used in the "Matricular pessoa" form's own
// <option> text below — just avoids showing the raw 'student'/'teacher'
// value in the table.
const ROLE_LABELS: Record<Enrollment['role'], string> = {
  student: 'Aluno',
  teacher: 'Professor',
};

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
    <section className={styles.page}>
      <Link to="/class-groups" className={styles.backLink}>
        <ArrowLeft size={16} />
        Voltar para turmas
      </Link>
      <PageHeader
        icon={Users}
        area="registry"
        title={classGroup ? classGroup.name : 'Detalhes da turma'}
        description={`Sala: ${roomLabel} · Período letivo: ${termLabel}`}
      />
      <p className={styles.idLine}>
        <small>
          ID da turma: <code>{classGroupId}</code>
        </small>
      </p>
      <EnrollmentsSection classGroupId={classGroupId} />
      <SubjectsSection classGroupId={classGroupId} classGroup={classGroup} />
      <ScheduleSlotsSection classGroupId={classGroupId} classGroup={classGroup} />
      <ClassSessionsSection
        classGroupId={classGroupId}
        rooms={rooms}
        classGroupRoomId={classGroup?.roomId}
        classGroupCourseId={classGroup?.courseId}
      />
      <p className={styles.footerHint}>
        <small>
          Copie um ID de aula na lista de aulas acima para consultá-lo em <Link to="/register">Registro de presença</Link>.
        </small>
      </p>
    </section>
  );
}

// RULE-INST-14: a turma studies N matérias, and the set is editable here —
// including all the way down to zero, which the backend accepts on purpose
// (RULE-INST-08 addendum): the turma survives empty, keeping matrículas and
// histórico, waiting for a new matéria.
function SubjectsSection({ classGroupId, classGroup }: { classGroupId: string; classGroup: ClassGroup | undefined }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const {
    data: classGroupSubjects,
    isLoading,
    error,
  } = useQuery({ queryKey: ['class-group-subjects', classGroupId], queryFn: () => listClassGroupSubjects(classGroupId) });

  // Only the course's own matérias can be linked (RULE-INST-14) — same
  // constraint the creation form applies, enforced server-side either way.
  const { data: subjectsForCourse } = useQuery({
    queryKey: ['subjects', 'by-course', classGroup?.courseId],
    queryFn: () => listSubjects(classGroup?.courseId),
    enabled: Boolean(classGroup?.courseId),
  });

  const [subjectId, setSubjectId] = useState('');

  function invalidateEverythingScopedToTheSubjectSet() {
    queryClient.invalidateQueries({ queryKey: ['class-group-subjects', classGroupId] });
    // The turma list carries subjectIds inline, and removing a matéria also
    // removes its slots and aulas server-side — all three views go stale.
    queryClient.invalidateQueries({ queryKey: ['class-groups'] });
    queryClient.invalidateQueries({ queryKey: ['schedule-slots', classGroupId] });
    queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] });
  }

  const addMutation = useMutation({
    mutationFn: () => addClassGroupSubject(classGroupId, subjectId),
    onSuccess: () => {
      invalidateEverythingScopedToTheSubjectSet();
      setSubjectId('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeClassGroupSubject(classGroupId, id),
    onSuccess: invalidateEverythingScopedToTheSubjectSet,
  });

  function subjectName(id: string): string {
    return subjectsForCourse?.find((subject) => subject.id === id)?.name ?? id;
  }

  const linkedIds = new Set(classGroupSubjects?.map((link) => link.subjectId));
  const linkableSubjects = subjectsForCourse?.filter((subject) => !linkedIds.has(subject.id)) ?? [];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    addMutation.mutate();
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <BookOpen size={18} />
        <h2>Matérias da turma</h2>
      </div>
      <p>
        <small>
          Remover uma matéria apaga os slots e as aulas dela nesta turma — a turma continua existindo, mesmo se ficar sem
          nenhuma matéria. A remoção é bloqueada se as aulas dessa matéria já tiverem presença registrada.
        </small>
      </p>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {removeMutation.isError && <ErrorBanner message={errorMessage(removeMutation.error)} />}
      {classGroupSubjects && (
        <DataTable<ClassGroupSubject>
          rows={classGroupSubjects}
          getRowKey={(link) => link.id}
          emptyMessage="Esta turma ainda não tem nenhuma matéria."
          columns={[
            { header: 'Matéria', cell: (link) => subjectName(link.subjectId) },
            { header: 'ID da matéria', cell: (link) => <code>{link.subjectId}</code> },
            {
              header: 'Ações',
              cell: (link) => (
                <button
                  type="button"
                  className={`danger ${styles.iconButton}`}
                  disabled={!canManage || removeMutation.isPending}
                  onClick={() => removeMutation.mutate(link.subjectId)}
                >
                  <Trash2 size={14} />
                  Remover
                </button>
              ),
            },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Adicionar matéria</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {addMutation.isError && <ErrorBanner message={errorMessage(addMutation.error)} />}
          <label>
            Matéria do curso da turma
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required>
              <option value="" disabled>
                {linkableSubjects.length > 0 ? 'Selecione uma matéria' : 'Nenhuma matéria disponível'}
              </option>
              {linkableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={addMutation.isPending || !subjectId} className={styles.iconButton}>
            <Plus size={16} />
            {addMutation.isPending ? 'Adicionando…' : 'Adicionar matéria'}
          </button>
        </form>
      </fieldset>
    </div>
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
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <UserPlus size={18} />
        <h2>Matrículas</h2>
      </div>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {enrollments && (
        <DataTable<Enrollment>
          rows={enrollments}
          getRowKey={(enrollment) => enrollment.id}
          columns={[
            { header: 'ID da pessoa', cell: (enrollment) => <code>{enrollment.personId}</code> },
            { header: 'Papel', cell: (enrollment) => ROLE_LABELS[enrollment.role] },
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
          <button type="submit" disabled={mutation.isPending || !personId} className={styles.iconButton}>
            <Plus size={16} />
            {mutation.isPending ? 'Matriculando…' : 'Matricular'}
          </button>
        </form>
      </fieldset>
    </div>
  );
}
