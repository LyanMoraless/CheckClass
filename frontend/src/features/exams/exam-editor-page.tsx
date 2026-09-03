import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import {
  addOption,
  addQuestion,
  deleteOption,
  deleteQuestion,
  getExamDetail,
  isObjectiveQuestion,
  publishExam,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  updateOption,
  type ExamQuestion,
  type QuestionType,
} from './exams-api';
import styles from './exam-editor-page.module.css';

// Teacher's authoring screen (RULE-EXAM-03/13/14). The answer key IS shown
// here — RULE-EXAM-17 restricts what the student is served, not the teacher.
export function ExamEditorPage() {
  const { examId = '' } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => getExamDetail(examId),
    enabled: Boolean(examId),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['exam', examId] });
  }

  const publishMutation = useMutation({ mutationFn: () => publishExam(examId), onSuccess: refresh });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBanner message={errorMessage(error)} />;
  if (!data) return null;

  const { exam, questions } = data;
  const isPublished = exam.status === 'PUBLISHED';

  return (
    <section className={styles.page}>
      <PageHeader
        icon={FileText}
        area="portal"
        title={exam.title}
        description={
          isPublished
            ? 'Prova publicada — os alunos da turma já conseguem vê-la e realizá-la dentro da janela.'
            : 'Rascunho. Os alunos não veem esta prova até você publicá-la.'
        }
        actions={
          isPublished ? (
            <Badge tone="success" label="Publicada" />
          ) : (
            <button type="button" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              <CheckCircle2 size={16} />
              {publishMutation.isPending ? 'Publicando…' : 'Publicar'}
            </button>
          )
        }
      />

      {publishMutation.error && <ErrorBanner message={errorMessage(publishMutation.error)} />}

      {/* The single attempt (confirmed 2026-09-03) is what makes premature
          exposure unrecoverable, so it is stated here rather than buried in
          a tooltip. */}
      {isPublished && (
        <InfoBanner message="Cada aluno tem uma única tentativa. Alterações de conteúdo ficam bloqueadas assim que alguém iniciar a prova." />
      )}

      <div className={styles.questions}>
        {questions.length === 0 && <p>Nenhuma pergunta ainda. Adicione pelo menos uma para conseguir publicar.</p>}
        {questions.map((question) => (
          <QuestionCard key={question.id} examId={examId} question={question} onChanged={refresh} />
        ))}
      </div>

      <AddQuestionForm examId={examId} nextPosition={questions.length + 1} onAdded={refresh} />
    </section>
  );
}

function QuestionCard({
  examId,
  question,
  onChanged,
}: {
  examId: string;
  question: ExamQuestion;
  onChanged: () => void;
}) {
  const [optionLabel, setOptionLabel] = useState('');

  const removeQuestion = useMutation({
    mutationFn: () => deleteQuestion(examId, question.id),
    onSuccess: onChanged,
  });
  const createOption = useMutation({
    mutationFn: () =>
      addOption(examId, question.id, {
        label: optionLabel,
        position: question.options.length + 1,
        isCorrect: false,
      }),
    onSuccess: () => {
      setOptionLabel('');
      onChanged();
    },
  });
  const toggleCorrect = useMutation({
    mutationFn: (option: { id: string; isCorrect: boolean }) =>
      updateOption(examId, question.id, option.id, { isCorrect: !option.isCorrect }),
    onSuccess: onChanged,
  });
  const removeOption = useMutation({
    mutationFn: (optionId: string) => deleteOption(examId, question.id, optionId),
    onSuccess: onChanged,
  });

  const objective = isObjectiveQuestion(question.questionType);
  const mutationError =
    removeQuestion.error ?? createOption.error ?? toggleCorrect.error ?? removeOption.error ?? null;

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <span className={styles.questionType}>{QUESTION_TYPE_LABELS[question.questionType]}</span>
          <p className={styles.prompt}>{question.prompt}</p>
        </div>
        <div className={styles.cardHeaderRight}>
          <span className={styles.points}>{question.points === null ? 'Sem pontuação' : `${question.points} pts`}</span>
          <button
            type="button"
            className="secondary"
            onClick={() => removeQuestion.mutate()}
            disabled={removeQuestion.isPending}
            aria-label="Remover pergunta"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      {mutationError && <ErrorBanner message={errorMessage(mutationError)} />}

      {/* Options only exist for objective types — the invariant the migration
          left to the application layer, mirrored in the UI so the teacher is
          never offered an action the server will reject. */}
      {objective && (
        <div className={styles.options}>
          {question.options.map((option) => (
            <div key={option.id} className={styles.option}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={option.isCorrect}
                  onChange={() => toggleCorrect.mutate({ id: option.id, isCorrect: option.isCorrect })}
                />
                {option.label}
              </label>
              {option.isCorrect && <Badge tone="success" label="Correta" />}
              <button
                type="button"
                className="secondary"
                onClick={() => removeOption.mutate(option.id)}
                aria-label="Remover opção"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <form
            className={styles.inlineForm}
            onSubmit={(event) => {
              event.preventDefault();
              createOption.mutate();
            }}
          >
            <input
              value={optionLabel}
              onChange={(event) => setOptionLabel(event.target.value)}
              placeholder="Nova alternativa"
              required
            />
            <button type="submit" className="secondary" disabled={createOption.isPending}>
              <Plus size={14} />
              Adicionar
            </button>
          </form>

          {question.questionType === 'MULTIPLE_CHOICE' && question.options.filter((o) => o.isCorrect).length > 1 && (
            <ErrorBanner message="Múltipla escolha aceita apenas uma alternativa correta — desmarque as demais antes de publicar." />
          )}
        </div>
      )}
    </article>
  );
}

function AddQuestionForm({
  examId,
  nextPosition,
  onAdded,
}: {
  examId: string;
  nextPosition: number;
  onAdded: () => void;
}) {
  const [questionType, setQuestionType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [prompt, setPrompt] = useState('');
  const [hasPoints, setHasPoints] = useState(true);
  const [points, setPoints] = useState(1);

  const mutation = useMutation({
    mutationFn: () =>
      addQuestion(examId, {
        questionType,
        prompt,
        position: nextPosition,
        points: hasPoints ? points : null,
      }),
    onSuccess: () => {
      setPrompt('');
      onAdded();
    },
  });

  return (
    <form
      className={styles.addForm}
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <h3>Nova pergunta</h3>
      {mutation.error && <ErrorBanner message={errorMessage(mutation.error)} />}

      <div className={styles.fieldRow}>
        <label>
          Tipo
          <select value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)}>
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pontuação
          <div className={styles.pointsField}>
            <input
              type="checkbox"
              checked={hasPoints}
              onChange={(event) => setHasPoints(event.target.checked)}
              aria-label="Esta pergunta vale pontos"
            />
            <input
              type="number"
              min={0}
              step="0.5"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              disabled={!hasPoints}
            />
          </div>
        </label>
      </div>

      <label>
        Enunciado
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} required />
      </label>

      <div className={styles.formActions}>
        <button type="submit" disabled={mutation.isPending}>
          <Plus size={16} />
          {mutation.isPending ? 'Adicionando…' : 'Adicionar pergunta'}
        </button>
      </div>
    </form>
  );
}
