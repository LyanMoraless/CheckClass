import { useQuery } from '@tanstack/react-query';
import { Landmark, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { formatSubjectNames } from '../../lib/subject-names';
import { listMyCoordinatedClassGroups, type CoordinatedClassGroupEntry } from './coordinated-class-groups-api';

export type LeadershipScope = 'coordinator' | 'direction';

// Coordenador de Curso and Direção/Reitoria share this one component
// (architecture item 5: "podem compartilhar o mesmo componente de
// apresentação, parametrizado por escopo, já que o backend os trata
// uniformemente") — both call the exact same
// GET /v1/me/coordinated-class-groups, which already resolves the correct
// scope (one course's turmas vs. every course's turmas) from the caller's
// identity server-side. `scope` here only changes copy, never the request.
const COPY: Record<LeadershipScope, { icon: typeof UsersRound; title: string; description: string; emptyMessage: string }> = {
  coordinator: {
    icon: UsersRound,
    title: 'Turmas do curso',
    description: 'Turmas dos cursos que você coordena — abra uma para ver a presença aluno a aluno.',
    emptyMessage: 'Você não coordena nenhum curso com turmas no momento.',
  },
  direction: {
    icon: Landmark,
    title: 'Turmas da instituição',
    description: 'Todas as turmas da instituição — abra uma para ver a presença aluno a aluno.',
    emptyMessage: 'Nenhuma turma cadastrada na instituição ainda.',
  },
};

export function LeadershipClassGroupsPage({ scope }: { scope: LeadershipScope }) {
  const copy = COPY[scope];
  const { data, isLoading, error } = useQuery({
    queryKey: ['coordinated-class-groups', scope],
    queryFn: listMyCoordinatedClassGroups,
  });

  return (
    <section>
      <PageHeader icon={copy.icon} area="portal" title={copy.title} description={copy.description} />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<CoordinatedClassGroupEntry>
          rows={data}
          getRowKey={(entry) => entry.classGroupId}
          emptyMessage={copy.emptyMessage}
          columns={[
            { header: 'Turma', cell: (entry) => entry.classGroupName },
            { header: 'Matérias', cell: (entry) => formatSubjectNames(entry.subjectNames) },
            { header: 'Curso', cell: (entry) => entry.courseName },
            {
              header: 'Presença',
              cell: (entry) => <Link to={`/portal/class-groups/${entry.classGroupId}/attendance`}>Ver presença</Link>,
            },
          ]}
        />
      )}
    </section>
  );
}
