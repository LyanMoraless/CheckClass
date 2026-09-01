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
  // populate the "filter by subject" select and to resolve subject/course
  // names in the table, independent of which course a given class group's
  // subject happens to belong to.
  const { data: allSubjects } = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() });

  const [subjectFilter, setSubjectFilter] = useState('');
  const {
    data: classGroups,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['class-groups', subjectFilter],
    queryFn: () => listClassGroups(subjectFilter || undefined),
  });

  const [name, setName] = useState('');
  const [createCourseId, setCreateCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [termStartDate, setTermStartDate] = useState('');
  const [termEndDate, setTermEndDate] = useState('');

  // Second select of the Curso -> Matéria cascade in the creation form: only
  // the subjects belonging to the chosen course are offered, so this select
  // stays disabled until a course is picked. There's no cascading-select
  // precedent elsewhere in the project, so this follows the simplest viable
  // shape: two controlled selects, the second gated on the first.
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
      setRoomId('');
      setTermStartDate('');
      setTermEndDate('');
    },
  });

  function handleCreateCourseChange(value: string) {
    setCreateCourseId(value);
    setSubjectId('');
  }

  function subjectName(id: string): string {
    return allSubjects?.find((subject) => subject.id === id)?.name ?? id;
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

  // Curso is no longer stored on the class group itself — it's derived by
  // looking up the class group's subject and, from there, that subject's
  // course.
  function courseNameForSubject(id: string): string {
    const subject = allSubjects?.find((item) => item.id === id);
    if (!subject) {
      return '—';
    }
    return courses?.find((course) => course.id === subject.courseId)?.name ?? subject.courseId;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      subjectId,
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
        description="Cada turma reúne matrículas, grade recorrente e aulas geradas a partir dela."
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
            { header: 'Matéria', cell: (group) => subjectName(group.subjectId) },
            { header: 'Curso', cell: (group) => courseNameForSubject(group.subjectId) },
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
          <label>
            Matéria
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              required
              disabled={!createCourseId}
            >
              <option value="" disabled>
                {createCourseId ? 'Selecione uma matéria' : 'Selecione um curso primeiro'}
              </option>
              {subjectsForCourse?.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
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
          <button type="submit" disabled={mutation.isPending || !subjectId} className={styles.iconButton}>
            <Plus size={16} />
            {mutation.isPending ? 'Criando…' : 'Criar turma'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
