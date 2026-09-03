import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import {
  EVENT_TYPE_LABELS,
  getExamSessionDetail,
  gradeAnswer,
  isObjectiveQuestion,
  listExamSessions,
  QUESTION_TYPE_LABELS,
  SESSION_STATUS_LABELS,
  type ExamSessionAnswer,
  type ExamSessionRow,
} from './exams-api';
import styles from './exam-panel-page.module.css';

// Polling, not realtime — the approved technology decision. Five seconds is
// what that decision fixed, on the reasoning that violations move at human
// pace and the project has no realtime infrastructure anywhere else.
const POLL_INTERVAL_MS = 5000;

export function ExamPanelPage() {
  const { examId = '' } = useParams();
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam-sessions', examId],
    queryFn: () => listExamSessions(examId),
    enabled: Boolean(examId),
    refetchInterval: POLL_INTERVAL_MS,
  });

  return (
    <section className={styles.page}>
      <PageHeader
        icon={Activity}
        area="portal"
        title="Acompanhamento da prova"
        description="Sessões dos alunos e ocorrências de monitoramento, atualizadas automaticamente a cada 5 segundos."
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<ExamSessionRow>
          rows={data}
          getRowKey={(row) => row.sessionId}
          emptyMessage="Nenhum aluno iniciou esta prova ainda."
          columns={[
            { header: 'Aluno', cell: (row) => row.personName },
            {
              header: 'Situação',
              cell: (row) => <Badge tone={statusTone(row.status)} label={SESSION_STATUS_LABELS[row.status] ?? row.status} />,
            },
            {
              header: 'Ocorrências',
              cell: (row) =>
                row.violationCount > 0 ? (
                  <span className={styles.violationCount}>
                    <ShieldAlert size={14} />
                    {row.violationCount}
                  </span>
                ) : (
                  <span className={styles.noViolation}>—</span>
                ),
            },
            {
              header: 'Nota automática',
              cell: (row) => (row.automaticScore === null ? '—' : row.automaticScore),
            },
            {
              header: 'A corrigir',
              cell: (row) => (row.pendingManualGrading > 0 ? `${row.pendingManualGrading} questão(ões)` : '—'),
            },
            {
              header: 'Detalhe',
              cell: (row) => (
                <button type="button" className="secondary" onClick={() => setOpenSessionId(row.sessionId)}>
                  Abrir
                </button>
              ),
            },
          ]}
        />
      )}

      {openSessionId && <SessionDetail examId={examId} sessionId={openSessionId} onClose={() => setOpenSessionId(null)} />}
    </section>
  );
}

function SessionDetail({ examId, sessionId, onClose }: { examId: string; sessionId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['exam-session-detail', examId, sessionId],
    queryFn: () => getExamSessionDetail(examId, sessionId),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBanner message={errorMessage(error)} />;
  if (!data) return null;

  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2>{data.session.personName}</h2>
        <button type="button" className="secondary" onClick={onClose}>
          Fechar
        </button>
      </header>

      <div className={styles.detailColumns}>
        <div>
          <h3>Respostas</h3>
          {data.answers.map((answer) => (
            <AnswerCard
              key={answer.answerId}
              examId={examId}
              sessionId={sessionId}
              answer={answer}
              onGraded={() =>
                void queryClient.invalidateQueries({ queryKey: ['exam-session-detail', examId, sessionId] })
              }
            />
          ))}
          {data.answers.length === 0 && <p>Este aluno não respondeu nenhuma questão.</p>}
        </div>

        <div>
          {/* RULE-EXAM-12's audit trail. Append-only and immutable at the
              database level, so what is shown here is what happened. */}
          <h3>Linha do tempo</h3>
          <ol className={styles.timeline}>
            {data.events.map((event) => (
              <li key={event.id} className={event.treatedAsViolation ? styles.violationEvent : undefined}>
                <span className={styles.eventTime}>{new Date(event.occurredAt).toLocaleTimeString('pt-BR')}</span>
                <span>{EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}</span>
                {event.treatedAsViolation && <Badge tone="danger" label="Violação" />}
              </li>
            ))}
          </ol>
          {data.events.length === 0 && <p>Nenhum evento registrado.</p>}
        </div>
      </div>
    </div>
  );
}

function AnswerCard({
  examId,
  sessionId,
  answer,
  onGraded,
}: {
  examId: string;
  sessionId: string;
  answer: ExamSessionAnswer;
  onGraded: () => void;
}) {
  const [points, setPoints] = useState(answer.awardedPoints ?? 0);
  const mutation = useMutation({
    mutationFn: () => gradeAnswer(examId, sessionId, answer.answerId, points),
    onSuccess: onGraded,
  });

  // Objective questions are scored by the server against the answer key when
  // the session ends (RULE-EXAM-14) and the grading endpoint rejects them —
  // so no input is offered for those.
  const manuallyGradable = !isObjectiveQuestion(answer.questionType);

  return (
    <article className={styles.answerCard}>
      <span className={styles.answerType}>{QUESTION_TYPE_LABELS[answer.questionType]}</span>
      <p className={styles.answerPrompt}>{answer.prompt}</p>
      <p className={styles.answerBody}>
        {answer.answerText?.trim()
          ? answer.answerText
          : answer.selectedOptionIds.length > 0
            ? `${answer.selectedOptionIds.length} alternativa(s) marcada(s)`
            : 'Em branco'}
      </p>

      <footer className={styles.answerFooter}>
        <span className={styles.answerScore}>
          {answer.awardedPoints === null ? 'Sem nota' : `${answer.awardedPoints}`}
          {answer.points !== null && ` / ${answer.points}`}
        </span>
        {manuallyGradable && (
          <form
            className={styles.gradeForm}
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <input
              type="number"
              min={0}
              max={answer.points ?? undefined}
              step="0.5"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              aria-label="Pontos atribuídos"
            />
            <button type="submit" className="secondary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando…' : 'Atribuir'}
            </button>
          </form>
        )}
      </footer>
      {mutation.error && <ErrorBanner message={errorMessage(mutation.error)} />}
    </article>
  );
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'IN_PROGRESS':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'TERMINATED':
      return 'danger';
    case 'EXPIRED':
    case 'ABANDONED':
      return 'warning';
    default:
      return 'neutral';
  }
}
