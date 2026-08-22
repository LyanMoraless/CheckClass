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
      <h1>Class groups</h1>

      <label>
        Filter by course
        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
          <option value="">All courses</option>
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
            { header: 'Name', cell: (group) => group.name },
            { header: 'Course', cell: (group) => courseName(group.courseId) },
            { header: 'ID', cell: (group) => <code>{group.id}</code> },
            {
              header: 'Details',
              cell: (group) => <Link to={`/class-groups/${group.id}`}>Enrollments &amp; sessions</Link>,
            },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>New class group</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Course
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
              <option value="" disabled>
                Select a course
              </option>
              {courses?.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          <button type="submit" disabled={mutation.isPending || !courseId}>
            {mutation.isPending ? 'Creating…' : 'Create class group'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
