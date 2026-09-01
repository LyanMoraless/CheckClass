import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listCourses } from '../courses/courses-api';
import { createSubject, listSubjects, type Subject } from './subjects-api';

export function SubjectsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => listCourses() });
  const [courseFilter, setCourseFilter] = useState('');
  const {
    data: subjects,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['subjects', courseFilter],
    queryFn: () => listSubjects(courseFilter || undefined),
  });

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [courseId, setCourseId] = useState('');
  const mutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setName('');
      setCode('');
    },
  });

  function courseName(id: string): string {
    return courses?.find((course) => course.id === id)?.name ?? id;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ courseId, name, code: code || undefined });
  }

  return (
    <section>
      <h1>Matérias</h1>

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
      {subjects && (
        <DataTable<Subject>
          rows={subjects}
          getRowKey={(subject) => subject.id}
          columns={[
            { header: 'Nome', cell: (subject) => subject.name },
            { header: 'Código', cell: (subject) => subject.code ?? '—' },
            { header: 'Curso', cell: (subject) => courseName(subject.courseId) },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Nova matéria</legend>
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
          <label>
            Código (opcional)
            <input type="text" value={code} onChange={(event) => setCode(event.target.value)} maxLength={50} />
          </label>
          <button type="submit" disabled={mutation.isPending || !courseId}>
            {mutation.isPending ? 'Criando…' : 'Criar matéria'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
