import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listCourses } from '../courses/courses-api';
import { createClassGroup, listClassGroups, type ClassGroup } from './class-groups-api';

export function ClassGroupsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => listCourses() });
  const [courseFilter, setCourseFilter] = useState('');
  const {
    data: classGroups,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['class-groups', courseFilter],
    queryFn: () => listClassGroups(courseFilter || undefined),
  });

  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const mutation = useMutation({
    mutationFn: createClassGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-groups'] });
      setName('');
    },
  });

  function courseName(id: string): string {
    return courses?.find((course) => course.id === id)?.name ?? id;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ courseId, name });
  }

  return (
    <section>
      <h1>Turmas</h1>

      <label>
        Filtrar por curso
        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
          <option value="">Todos os cursos</option>
          {courses?.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
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
            { header: 'Curso', cell: (group) => courseName(group.courseId) },
            { header: 'ID', cell: (group) => <code>{group.id}</code> },
            {
              header: 'Detalhes',
              cell: (group) => <Link to={`/class-groups/${group.id}`}>Matrículas e aulas</Link>,
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
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
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
            Nome
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          <button type="submit" disabled={mutation.isPending || !courseId}>
            {mutation.isPending ? 'Criando…' : 'Criar turma'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
