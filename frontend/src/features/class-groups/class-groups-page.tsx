import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listCourses } from '../courses/courses-api';
import { listRooms } from '../rooms/rooms-api';
import { listSubjects } from '../subjects/subjects-api';
import { createClassGroup, listClassGroups, type ClassGroup } from './class-groups-api';
import styles from './class-groups-page.module.css';

export function ClassGroupsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => listCourses() });
  const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: () => listRooms() });
  // Unfiltered list of every subject, regardless of course — used to
  // populate the "filter by subject" select and to resolve the names of the
  // matérias each turma studies (RULE-INST-14), independent of course.
  const { data: allSubjects } = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() });

  const [subjectFilter, setSubjectFilter] = useState('');
  const {
    data: classGroups,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['class-groups', subjectFilter],
    queryFn: () => listClassGroups({ subjectId: subjectFilter || undefined }),
  });

  const [name, setName] = useState('');
  const [createCourseId, setCreateCourseId] = useState('');
  // RULE-INST-14: the turma studies a SET of matérias — several can be picked
  // here at creation time, and the set stays editable afterwards on the
  // turma's own screen (including down to zero).
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [roomId, setRoomId] = useState('');
  const [termStartDate, setTermStartDate] = useState('');
  const [termEndDate, setTermEndDate] = useState('');

  // Second step of the Curso -> Matérias cascade in the creation form: only
  // the subjects belonging to the chosen course are offered (RULE-INST-14
  // requires every matéria of a turma to belong to the turma's course), so
  // this block stays hidden until a course is picked.
  const { data: subjectsForCourse } = useQuery({
    queryKey: ['subjects', 'by-course', createCourseId],
    queryFn: () => listSubjects(createCourseId),
    enabled: Boolean(createCourseId),
  });

  const mutation = useMutation({
    mutationFn: createClassGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-groups'] });
      setName('');
      setSubjectIds([]);
      setRoomId('');
      setTermStartDate('');
      setTermEndDate('');
    },
  });

  function handleCreateCourseChange(value: string) {
    setCreateCourseId(value);
    // The previously picked matérias belong to the previous course — keeping
    // them would build a turma the backend rejects (RULE-INST-14).
    setSubjectIds([]);
  }

  function toggleSubject(id: string) {
    setSubjectIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function subjectName(id: string): string {
    return allSubjects?.find((subject) => subject.id === id)?.name ?? id;
  }

  function subjectNames(ids: string[]): string {
    // A turma with no matéria is a valid state (RULE-INST-08 addendum) — it
    // shows as a dash instead of an empty cell, so it reads as deliberate.
    return ids.length === 0 ? '—' : ids.map(subjectName).join(', ');
  }

  // RULE-INST-06: the room already assigned to a turma must be visible
  // directly on the operational screen showing that turma, not only inside
  // Configurações/Salas.
  function roomName(id: string | null): string {
    if (!id) {
      return '—';
    }
    return rooms?.find((room) => room.id === id)?.name ?? id;
  }

  // RULE-INST-14: the curso is the turma's own field again — no longer
  // derived through a single matéria, which a turma no longer has.
  function courseName(id: string): string {
    return courses?.find((course) => course.id === id)?.name ?? id;
  }

  function courseNameForSubject(id: string): string {
    const subject = allSubjects?.find((item) => item.id === id);
    return subject ? courseName(subject.courseId) : '—';
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      courseId: createCourseId,
      subjectIds: subjectIds.length > 0 ? subjectIds : undefined,
      name,
      roomId: roomId || undefined,
      termStartDate: termStartDate || undefined,
      termEndDate: termEndDate || undefined,
    });
  }

  return (
    <section className={styles.page}>
      <PageHeader
        icon={Users}
        area="registry"
        title="Turmas"
        description="Cada turma reúne matrículas, matérias, grade recorrente e aulas geradas a partir dela."
      />

      <label className={styles.filter}>
        Filtrar por matéria
        <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
          <option value="">Todas as matérias</option>
          {allSubjects?.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name} ({courseNameForSubject(subject.id)})
            </option>
          ))}
        </select>
      </label>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {classGroups && (
        <DataTable<ClassGroup>
          rows={classGroups}
          getRowKey={(group) => group.id}
          columns={[
            { header: 'Nome', cell: (group) => group.name },
            { header: 'Matérias', cell: (group) => subjectNames(group.subjectIds) },
            { header: 'Curso', cell: (group) => courseName(group.courseId) },
            { header: 'Sala', cell: (group) => roomName(group.roomId) },
            { header: 'ID', cell: (group) => <code>{group.id}</code> },
            {
              header: 'Detalhes',
              cell: (group) => <Link to={`/class-groups/${group.id}`}>Matrículas e cronograma</Link>,
            },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Nova turma</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Curso
            <select value={createCourseId} onChange={(event) => handleCreateCourseChange(event.target.value)} required>
              <option value="" disabled>
                Selecione um curso
              </option>
              {courses?.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={styles.subjectPicker}>
            <legend>Matérias da turma (opcional)</legend>
            <p>
              <small>
                Marque quantas matérias a turma cursa. Pode deixar em branco agora e montar depois, na tela da turma.
              </small>
            </p>
            {!createCourseId && <p>Selecione um curso primeiro.</p>}
            {createCourseId && subjectsForCourse?.length === 0 && <p>Este curso ainda não tem matérias cadastradas.</p>}
            {subjectsForCourse?.map((subject) => (
              <label key={subject.id} className={styles.subjectOption}>
                <input
                  type="checkbox"
                  checked={subjectIds.includes(subject.id)}
                  onChange={() => toggleSubject(subject.id)}
                />
                {subject.name}
              </label>
            ))}
          </fieldset>
          <label>
            Nome
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          <label>
            Sala (opcional)
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">Sem sala definida</option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início do período letivo (opcional)
            <input type="date" value={termStartDate} onChange={(event) => setTermStartDate(event.target.value)} />
          </label>
          <label>
            Fim do período letivo (opcional)
            <input type="date" value={termEndDate} onChange={(event) => setTermEndDate(event.target.value)} />
          </label>
          <button type="submit" disabled={mutation.isPending || !createCourseId} className={styles.iconButton}>
            <Plus size={16} />
            {mutation.isPending ? 'Criando…' : 'Criar turma'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
