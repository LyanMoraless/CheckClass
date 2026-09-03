import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { SESSION_STATUS_LABELS, type MonitorableEventType } from '../exams/exams-api';
import {
  reportMonitoringEvent,
  saveAnswer,
  startExamSession,
  submitExam,
  type StudentQuestion,
  type StudentSessionPayload,
} from './student-exams-api';
import { useExamMonitoring } from './use-exam-monitoring';
import styles from './take-exam-page.module.css';

function formatRemaining(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function TakeExamPage() {
  const { examId = '' } = useParams();
  const queryClient = useQueryClient();

  // POST, not GET: this is the start-or-recover endpoint. Running it on mount
  // is what makes a page refresh resume the same session with the same
  // absolute deadline instead of starting a new one (RULE-EXAM-11) — the
  // single attempt is protected server-side, not by us avoiding the call.
  const { data, isLoading, error } = useQuery<StudentSessionPayload>({
    queryKey: ['exam-session', examId],
    queryFn: () => startExamSession(examId),
    enabled: Boolean(examId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const session = data?.session;
  const isActive = session?.status === 'IN_PROGRESS';

  function refreshSession() {
    void queryClient.invalidateQueries({ queryKey: ['exam-session', examId] });
  }

  useExamMonitoring({
    enabledEventTypes: session?.monitoredEventTypes ?? [],
    active: Boolean(isActive),
    onEventReported: refreshSession,
    report: (eventType: MonitorableEventType, details?: Record<string, string>) =>
      reportMonitoringEvent(examId, eventType, details),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBanner message={errorMessage(error)} />;
  if (!data || !session) return null;

  return (
    <section className={styles.page}>
      <PageHeader
        icon={FileText}
        area="portal"
        title="Prova em andamento"
        description={
          isActive
            ? 'Suas respostas são salvas automaticamente conforme você preenche.'
            : `Esta prova está ${(SESSION_STATUS_LABELS[session.status] ?? session.status).toLowerCase()}.`
        }
        actions={session.expiresAt && isActive ? <CountdownTimer expiresAt={session.expiresAt} onExpired={refreshSession} /> : undefined}
      />

      {session.monitoringMode === 'TERMINATE' && isActive && (
        <InfoBanner message="Esta prova encerra automaticamente se uma ocorrência de monitoramento for detectada. Evite sair da aba ou da janela." />
      )}

      {!isActive && <SessionClosedNotice status={session.status} />}

      <div className={styles.questions}>
        {data.questions.map((question) => (
          <QuestionField
            key={question.id}
            examId={examId}
            question={question}
            initialAnswer={data.answers.find((answer) => answer.examQuestionId === question.id)}
            disabled={!isActive}
          />
        ))}
      </div>

      {isActive && <SubmitSection examId={examId} onSubmitted={refreshSession} />}
    </section>
  );
}

// Renders a countdown from the server's absolute expiresAt. Purely a display:
// when it reaches zero it asks the server what actually happened rather than
// declaring the session over itself (RULE-EXAM-07).
function CountdownTimer({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const deadline = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const next = deadline - Date.now();
      setRemaining(next);
      if (next <= 0) {
        clearInterval(interval);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  const isUrgent = remaining <= 5 * 60 * 1000;

  return (
    <span className={`${styles.timer} ${isUrgent ? styles.timerUrgent : ''}`} role="timer" aria-live="off">
      {formatRemaining(remaining)}
    </span>
  );
}

function SessionClosedNotice({ status }: { status: string }) {
  const message =
    status === 'TERMINATED'
      ? 'Sua prova foi encerrada automaticamente por uma ocorrência de monitoramento. As respostas já salvas foram preservadas.'
      : status === 'EXPIRED'
        ? 'O tempo da sua prova acabou. As respostas salvas até o momento foram preservadas.'
        : status === 'ABANDONED'
          ? 'A janela de disponibilidade desta prova fechou antes da entrega. As respostas salvas foram preservadas.'
          : 'Prova entregue. O resultado fica com o professor.';

  return (
    <p className={styles.closedNotice}>
      <AlertTriangle size={16} />
      {message}
    </p>
  );
}

function QuestionField({
  examId,
  question,
  initialAnswer,
  disabled,
}: {
  examId: string;
  question: StudentQuestion;
  initialAnswer?: { answerText: string | null; selectedOptionIds: string[] };
  disabled: boolean;
}) {
  const [answerText, setAnswerText] = useState(initialAnswer?.answerText ?? '');
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(initialAnswer?.selectedOptionIds ?? []);

  const mutation = useMutation({
    mutationFn: (input: { answerText?: string; selectedOptionIds?: string[] }) =>
      saveAnswer(examId, question.id, input),
  });

  // Text answers autosave on blur rather than on every keystroke: one request
  // per finished thought instead of per character, and the exam-session
  // throttle is a shared budget with monitoring events.
  function persistText(value: string) {
    mutation.mutate({ answerText: value });
  }

  function toggleOption(optionId: string) {
    const next =
      question.questionType === 'MULTIPLE_CHOICE'
        ? [optionId]
        : selectedOptionIds.includes(optionId)
          ? selectedOptionIds.filter((id) => id !== optionId)
          : [...selectedOptionIds, optionId];
    setSelectedOptionIds(next);
    mutation.mutate({ selectedOptionIds: next });
  }

  const isObjective = question.questionType === 'MULTIPLE_CHOICE' || question.questionType === 'CHECKBOXES';

  return (
    <article className={styles.question}>
      <p className={styles.prompt}>
        <span className={styles.position}>{question.position}.</span> {question.prompt}
      </p>

      {isObjective ? (
        <div className={styles.options}>
          {question.options.map((option) => (
            <label key={option.id} className={styles.optionLabel}>
              <input
                type={question.questionType === 'MULTIPLE_CHOICE' ? 'radio' : 'checkbox'}
                name={question.id}
                checked={selectedOptionIds.includes(option.id)}
                onChange={() => toggleOption(option.id)}
                disabled={disabled}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={answerText}
          onChange={(event) => setAnswerText(event.target.value)}
          onBlur={(event) => persistText(event.target.value)}
          rows={question.questionType === 'PARAGRAPH' ? 6 : 2}
          disabled={disabled}
          placeholder="Sua resposta"
        />
      )}

      {mutation.error && <ErrorBanner message={errorMessage(mutation.error)} />}
      {mutation.isPending && <span className={styles.savingHint}>Salvando…</span>}
    </article>
  );
}

function SubmitSection({ examId, onSubmitted }: { examId: string; onSubmitted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({ mutationFn: () => submitExam(examId), onSuccess: onSubmitted });

  return (
    <div className={styles.submitSection}>
      {mutation.error && <ErrorBanner message={errorMessage(mutation.error)} />}
      {/* Never blocked by unanswered questions (confirmed 2026-09-03) —
          blank simply scores zero, and automatic submission on expiry has to
          be able to deliver an incomplete exam anyway. */}
      {confirming ? (
        <div className={styles.confirmRow}>
          <span>Entregar a prova? Você não poderá voltar a respondê-la.</span>
          <button type="button" className="secondary" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
          <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Entregando…' : 'Confirmar entrega'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          <Send size={16} />
          Entregar prova
        </button>
      )}
    </div>
  );
}
