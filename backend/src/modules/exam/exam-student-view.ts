import { ExamEntity, ExamQuestionEntity, ExamQuestionOptionEntity, ExamSessionEntity } from '../../database/entities';
import { StoredAnswer } from './exam-answer.service';
import { AvailabilityState, SessionStatus } from './exam-vocabulary';

// RULE-EXAM-17 implemented as a hard boundary: everything a student is ever
// served is BUILT here, field by field, from an explicit allow-list.
//
// Written as constructors rather than as "take the entity and delete the
// sensitive keys" on purpose — a deletion list silently stops being correct
// the moment a column is added (a new `answer_key_hint` column would start
// leaking with no code change at all), whereas an allow-list silently stops
// exposing, which is the failure direction we want. exam_question.points and
// exam_question_option.is_correct simply have no field to land in below.

export interface StudentOptionView {
  id: string;
  label: string;
  position: number;
}

export interface StudentQuestionView {
  id: string;
  questionType: string;
  prompt: string;
  position: number;
  options: StudentOptionView[];
}

export interface StudentSessionView {
  id: string;
  examId: string;
  status: string;
  startedAt: Date;
  // The one absolute deadline the frontend renders a countdown from —
  // identical on start and on every reload (RULE-EXAM-07/11).
  expiresAt: Date | null;
  endedAt: Date | null;
  // Not secret, and the browser needs both: the monitoring mode to warn the
  // student what happens on a violation (RULE-EXAM-04 is a deterrent, which
  // only works if it is known), and the event list to know which listeners
  // to attach at all (RULE-EXAM-05).
  monitoringMode: string;
  monitoredEventTypes: string[];
}

export interface StudentAnswerView {
  examQuestionId: string;
  answerText: string | null;
  selectedOptionIds: string[];
}

export interface StudentExamSummary {
  examId: string;
  title: string;
  description: string | null;
  availableFrom: Date;
  availableUntil: Date;
  durationMinutes: number | null;
  availabilityState: AvailabilityState;
  // RULE-EXAM-12's full seven-state vocabulary as the student sees it: the
  // five persisted ones plus NOT_STARTED/AVAILABLE, which are derived from
  // the window and never stored.
  sessionState: SessionStatus | 'NOT_STARTED' | 'AVAILABLE';
}

export function studentSessionState(
  availabilityState: AvailabilityState,
  session: ExamSessionEntity | null,
): SessionStatus | 'NOT_STARTED' | 'AVAILABLE' {
  if (session) {
    return session.status as SessionStatus;
  }
  return availabilityState === 'EXAM_AVAILABLE' ? 'AVAILABLE' : 'NOT_STARTED';
}

export function toStudentExamSummary(
  exam: ExamEntity,
  availabilityState: AvailabilityState,
  session: ExamSessionEntity | null,
): StudentExamSummary {
  return {
    examId: exam.id,
    title: exam.title,
    description: exam.description,
    availableFrom: exam.availableFrom,
    availableUntil: exam.availableUntil,
    durationMinutes: exam.durationMinutes,
    availabilityState,
    sessionState: studentSessionState(availabilityState, session),
  };
}

export function toStudentSessionView(session: ExamSessionEntity): StudentSessionView {
  return {
    id: session.id,
    examId: session.examId,
    status: session.status,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    endedAt: session.endedAt,
    monitoringMode: session.monitoringModeSnapshot,
    monitoredEventTypes: session.monitoredEventTypesSnapshot,
  };
}

export function toStudentQuestionViews(
  questions: ExamQuestionEntity[],
  options: ExamQuestionOptionEntity[],
): StudentQuestionView[] {
  return [...questions]
    .sort((first, second) => first.position - second.position)
    .map((question) => ({
      id: question.id,
      questionType: question.questionType,
      prompt: question.prompt,
      position: question.position,
      options: options
        .filter((option) => option.examQuestionId === question.id)
        .sort((first, second) => first.position - second.position)
        .map((option) => ({ id: option.id, label: option.label, position: option.position })),
    }));
}

export function toStudentAnswerViews(answers: StoredAnswer[]): StudentAnswerView[] {
  return answers.map((answer) => ({
    examQuestionId: answer.examQuestionId,
    answerText: answer.answerText,
    selectedOptionIds: answer.selectedOptionIds,
  }));
}
