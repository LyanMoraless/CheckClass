import { useQuery } from '@tanstack/react-query';
import { Presentation, ScanEye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { formatSubjectNames } from '../../lib/subject-names';
import { listMySchedule, type StudentScheduleEntry } from '../portal-student/student-schedule-api';
import { HeadcountAlertModal } from './headcount-alert-modal';
import { listMyTeachingClassGroups, type TeachingClassGroupEntry } from './teaching-class-groups-api';

// GET /v1/me/schedule is deliberately role-agnostic on the backend
// (my-schedule.service.ts: "Professor doesn't get a 'meu cronograma' screen
// this round... but that's the Portal frontend simply not calling this
// endpoint yet — the backend contract shouldn't need to change again if/when
// it does"). This is that "if/when" — reused here (not a copy: same
// StudentScheduleEntry shape, same endpoint, same cross-feature import
// precedent already set by student-warnings-page.tsx importing from
// portal-student) purely to resolve, client-side, whether a turma has a
// session in andamento right now, so the RULE-PRES-10/11 headcount-alert
// button below can be scoped to a real classSessionId. No new backend
// route was added for this — see the Frontend Implementation Summary.
function isSessionInProgress(session: StudentScheduleEntry, now: Date): boolean {
  if (session.status === 'cancelled') {
    return false;
  }
  const start = new Date(session.scheduledStart);
  const end = new Date(session.scheduledEnd);
  return start <= now && now < end;
}

// Professor-only screen (roleContext.teaching.length > 0). No "meu
// cronograma" here by design — item 8 of "Gaps resolvidos — segunda rodada
// (2026-09-02)" confirms the professor only gets turmas + their attendance
// this round, not a personal schedule view like the Aluno portal has.
//
// RULE-PRES-10/11 (Bloco 4, Fluxo de Chamada Redesenhado): the "Aula agora"
// column below is this round's addition — reuses this same screen (the
// professor's own primary landing page) instead of opening a new isolated
// nav entry, per the architecture's explicit instruction to reuse an
// existing surface rather than stand up a disconnected one. See the
// Frontend Implementation Summary for the UX rationale (why here, and why
// not the pending-reviews queue).
export function TeachingClassGroupsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['teaching-class-groups'], queryFn: listMyTeachingClassGroups });
  const { data: schedule } = useQuery({ queryKey: ['teacher-schedule'], queryFn: listMySchedule });

  const [alertSession, setAlertSession] = useState<{ classSessionId: string; classGroupName: string } | null>(null);

  // classGroupId -> the one in-progress session for it right now (if any).
  // Recomputed on every render (cheap — a handful of rows) rather than
  // memoized against a ticking clock: this page doesn't otherwise poll, so
  // "now" only actually changes on a refetch/remount, same staleness budget
  // as the rest of this screen.
  const inProgressSessionByClassGroupId = useMemo(() => {
    const now = new Date();
    const map = new Map<string, StudentScheduleEntry>();
    for (const session of schedule ?? []) {
      if (!map.has(session.classGroupId) && isSessionInProgress(session, now)) {
        map.set(session.classGroupId, session);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

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
            { header: 'Matérias', cell: (entry) => formatSubjectNames(entry.subjectNames) },
            { header: 'Curso', cell: (entry) => entry.courseName },
            {
              header: 'Presença',
              cell: (entry) => <Link to={`/portal/class-groups/${entry.classGroupId}/attendance`}>Ver presença</Link>,
            },
            {
              header: 'Provas',
              cell: (entry) => <Link to={`/class-groups/${entry.classGroupId}/exams`}>Ver provas</Link>,
            },
            {
              header: 'Aula agora',
              cell: (entry) => {
                const inProgress = inProgressSessionByClassGroupId.get(entry.classGroupId);
                if (!inProgress) {
                  return '—';
                }
                return (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setAlertSession({ classSessionId: inProgress.classSessionId, classGroupName: entry.classGroupName })
                    }
                  >
                    <ScanEye size={14} />
                    Ver contagem
                  </button>
                );
              },
            },
          ]}
        />
      )}
      {alertSession && (
        <HeadcountAlertModal
          classSessionId={alertSession.classSessionId}
          classGroupName={alertSession.classGroupName}
          onClose={() => setAlertSession(null)}
        />
      )}
    </section>
  );
}
