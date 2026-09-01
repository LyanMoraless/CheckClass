import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { useAuth } from '../auth/auth-context';
import { errorMessage } from '../../lib/api-client';
import { createCourse, listCourses, type Course } from './courses-api';
import styles from './courses-page.module.css';

export function CoursesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();
  const { data: courses, isLoading, error } = useQuery({ queryKey: ['courses'], queryFn: listCourses });

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const mutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setName('');
      setCode('');
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ name, code: code || undefined });
  }

  return (
    <section className={styles.page}>
      <PageHeader
        icon={BookOpen}
        area="registry"
        title="Cursos"
        description="Cursos oferecidos pela instituição — base para organizar matérias e turmas."
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {courses && (
        <DataTable<Course>
          rows={courses}
          getRowKey={(course) => course.id}
          columns={[
            { header: 'Nome', cell: (course) => course.name },
            { header: 'Código', cell: (course) => course.code ?? '—' },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Novo curso</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Nome
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          <label>
            Código (opcional)
            <input type="text" value={code} onChange={(event) => setCode(event.target.value)} maxLength={50} />
          </label>
          <button type="submit" disabled={mutation.isPending} className={styles.iconButton}>
            <Plus size={16} />
            {mutation.isPending ? 'Criando…' : 'Criar curso'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
