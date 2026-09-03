import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { PersonIdField } from '../../components/person-id-field';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listCourses } from '../courses/courses-api';
import {
  createCourseCoordinatorAssignment,
  listCourseCoordinatorAssignments,
  revokeCourseCoordinatorAssignment,
  type CourseCoordinatorAssignment,
} from './course-coordinator-assignments-api';
import styles from './course-coordinator-assignments-page.module.css';

// Administrative CRUD (not a self-service portal screen — see the comment
// on this nav entry in app-shell.tsx). Gated on manage_institution_structure,
// same permission already used for the rest of "Cadastro de informações"
// (Cursos/Matérias/Turmas), since assigning a Coordenador de Curso is
// institution-structure work, not a distinct permission of its own.
export function CourseCoordinatorAssignmentsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => listCourses() });
  const {
    data: assignments,
    isLoading,
    error,
  } = useQuery({ queryKey: ['course-coordinator-assignments'], queryFn: listCourseCoordinatorAssignments });

  const [personId, setPersonId] = useState('');
  const [courseId, setCourseId] = useState('');
  const createMutation = useMutation({
    mutationFn: createCourseCoordinatorAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-coordinator-assignments'] });
      setPersonId('');
      setCourseId('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeCourseCoordinatorAssignment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-coordinator-assignments'] }),
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({ personId, courseId });
  }

  return (
    <section className={styles.page}>
      <PageHeader
        icon={UserCog}
        area="registry"
        title="Coordenadores de curso"
        description="Atribua ou revogue a autoridade de Coordenador de Curso (RULE-INST-09) de uma pessoa sobre um curso."
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {revokeMutation.isError && <ErrorBanner message={errorMessage(revokeMutation.error)} />}
      {assignments && (
        <DataTable<CourseCoordinatorAssignment>
          rows={assignments}
          getRowKey={(assignment) => assignment.id}
          emptyMessage="Nenhum coordenador de curso atribuído ainda."
          columns={[
            { header: 'Pessoa', cell: (assignment) => assignment.personFullName },
            { header: 'Curso', cell: (assignment) => assignment.courseName },
            {
              header: 'Ações',
              cell: (assignment) => (
                <button
                  type="button"
                  className={`danger ${styles.iconButton}`}
                  disabled={!canManage || revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(assignment.id)}
                >
                  <X size={16} />
                  Revogar
                </button>
              ),
            },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Nova atribuição</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
          <PersonIdField label="Pessoa" value={personId} onChange={setPersonId} required />
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
          <button type="submit" disabled={createMutation.isPending || !personId || !courseId} className={styles.iconButton}>
            <Plus size={16} />
            {createMutation.isPending ? 'Atribuindo…' : 'Atribuir coordenador'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
