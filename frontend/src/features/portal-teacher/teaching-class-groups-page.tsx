import { useQuery } from '@tanstack/react-query';
import { Presentation } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { listMyTeachingClassGroups, type TeachingClassGroupEntry } from './teaching-class-groups-api';

// Professor-only screen (roleContext.teaching.length > 0). No "meu
// cronograma" here by design — item 8 of "Gaps resolvidos — segunda rodada
// (2026-09-02)" confirms the professor only gets turmas + their attendance
// this round, not a personal schedule view like the Aluno portal has.
export function TeachingClassGroupsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['teaching-class-groups'], queryFn: listMyTeachingClassGroups });

  return (
    <section>
      <PageHeader
        icon={Presentation}
        area="portal"
        title="Minhas turmas"
        description="Turmas em que você leciona — abra uma para ver a presença aluno a aluno."
      />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<TeachingClassGroupEntry>
          rows={data}
          getRowKey={(entry) => entry.classGroupId}
          emptyMessage="Você não leciona em nenhuma turma no momento."
          columns={[
            { header: 'Turma', cell: (entry) => entry.classGroupName },
            { header: 'Matéria', cell: (entry) => entry.subjectName },
            { header: 'Curso', cell: (entry) => entry.courseName },
            {
              header: 'Presença',
              cell: (entry) => <Link to={`/portal/class-groups/${entry.classGroupId}/attendance`}>Ver presença</Link>,
            },
            {
              header: 'Provas',
              cell: (entry) => <Link to={`/class-groups/${entry.classGroupId}/exams`}>Ver provas</Link>,
            },
          ]}
        />
      )}
    </section>
  );
}
