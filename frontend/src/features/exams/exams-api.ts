import { api } from '../../lib/api-client';

// Mirrors backend/src/modules/exam/exam-vocabulary.ts, which is the single
// source of these value sets on the server (each one backed by a CHECK
// constraint or a RULE-EXAM-* rule). Duplicated here rather than imported
// because the two apps don't share a package — kept as `as const` arrays so
// a value that drifts shows up as a type error at the call site, not as a
// silent 400 at runtime.
export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'SHORT_ANSWER', 'PARAGRAPH'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const OBJECTIVE_QUESTION_TYPES: readonly QuestionType[] = ['MULTIPLE_CHOICE', 'CHECKBOXES'];

export function isObjectiveQuestion(questionType: QuestionType): boolean {
  return OBJECTIVE_QUESTION_TYPES.includes(questionType);
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Múltipla escolha',
  CHECKBOXES: 'Caixas de seleção',
  SHORT_ANSWER: 'Resposta curta',
  PARAGRAPH: 'Dissertação',
};

// RULE-EXAM-04's two reaction modes.
export const MONITORING_MODES = ['TERMINATE', 'LOG_ONLY'] as const;
export type MonitoringMode = (typeof MONITORING_MODES)[number];

export const MONITORING_MODE_LABELS: Record<MonitoringMode, string> = {
  TERMINATE: 'Encerrar a prova automaticamente',
  LOG_ONLY: 'Apenas registrar a ocorrência',
};

// RULE-EXAM-05's vocabulary as confirmed on 2026-09-03: nova aba and nova
// janela are ONE value, because the browser cannot reliably tell them apart.
export const MONITORABLE_EVENT_TYPES = [
  'PAGE_BLUR',
  'PAGE_VISIBILITY_CHANGED',
  'NEW_TAB_OR_WINDOW_ATTEMPT',
  'EXTERNAL_NAVIGATION_ATTEMPT',
  'KEYBOARD_RESTRICTION_TRIGGERED',
  'PAGE_RELOAD',
] as const;
export type MonitorableEventType = (typeof MONITORABLE_EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<string, string> = {
  PAGE_BLUR: 'Perda de foco da página',
  PAGE_VISIBILITY_CHANGED: 'Página ficou oculta',
  NEW_TAB_OR_WINDOW_ATTEMPT: 'Tentativa de abrir nova aba/janela',
  EXTERNAL_NAVIGATION_ATTEMPT: 'Tentativa de navegar para fora',
  KEYBOARD_RESTRICTION_TRIGGERED: 'Atalho de teclado bloqueado',
  PAGE_RELOAD: 'Atualização da página',
  EXAM_SESSION_STARTED: 'Prova iniciada',
  EXAM_TIME_EXPIRED: 'Tempo esgotado',
  EXAM_SESSION_COMPLETED: 'Prova entregue',
  EXAM_SESSION_TERMINATED: 'Prova encerrada por violação',
  EXAM_SESSION_ABANDONED: 'Prova abandonada (janela fechou)',
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  AVAILABLE: 'Disponível',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Entregue',
  TERMINATED: 'Encerrada por violação',
  EXPIRED: 'Tempo esgotado',
  ABANDONED: 'Abandonada',
};

export const AVAILABILITY_STATE_LABELS: Record<string, string> = {
  EXAM_NOT_AVAILABLE: 'Ainda não disponível',
  EXAM_AVAILABLE: 'Disponível',
  EXAM_CLOSED: 'Encerrada',
};

export interface ExamSummary {
  id: string;
  classGroupId: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  availableFrom: string;
  availableUntil: string;
  durationMinutes: number | null;
}

export interface ExamOption {
  id: string;
  label: string;
  position: number;
  isCorrect: boolean;
}

export interface ExamQuestion {
  id: string;
  questionType: QuestionType;
  prompt: string;
  position: number;
  points: number | null;
  options: ExamOption[];
}

export interface ExamMonitoringConfig {
  monitoringMode: MonitoringMode;
  monitoredEventTypes: MonitorableEventType[];
}

// The teacher's full view — answer key included. RULE-EXAM-17 restricts what
// the STUDENT is served, never the teacher.
export interface ExamDetail {
  exam: ExamSummary;
  questions: ExamQuestion[];
  monitoringConfig: ExamMonitoringConfig | null;
}

export interface CreateExamInput {
  classGroupId: string;
  title: string;
  description?: string;
  availableFrom: string;
  availableUntil: string;
  durationMinutes?: number | null;
  monitoringMode: MonitoringMode;
  monitoredEventTypes: MonitorableEventType[];
}

export async function listExams(classGroupId: string): Promise<ExamSummary[]> {
  return api.get(`/v1/exams?classGroupId=${encodeURIComponent(classGroupId)}`);
}

export async function getExamDetail(examId: string): Promise<ExamDetail> {
  return api.get(`/v1/exams/${examId}`);
}

export async function createExam(input: CreateExamInput): Promise<ExamSummary> {
  return api.post('/v1/exams', input);
}

export async function updateExam(examId: string, input: Partial<CreateExamInput>): Promise<ExamSummary> {
  return api.patch(`/v1/exams/${examId}`, input);
}

export async function deleteExam(examId: string): Promise<void> {
  await api.delete(`/v1/exams/${examId}`);
}

// The single act that makes an exam visible to students (confirmed
// 2026-09-03). Its own endpoint precisely because opening the availability
// window must NOT have that effect.
export async function publishExam(examId: string): Promise<ExamSummary> {
  return api.post(`/v1/exams/${examId}/publish`, {});
}

export interface QuestionInput {
  questionType: QuestionType;
  prompt: string;
  position: number;
  points?: number | null;
}

export async function addQuestion(examId: string, input: QuestionInput): Promise<ExamQuestion> {
  return api.post(`/v1/exams/${examId}/questions`, input);
}

export async function updateQuestion(
  examId: string,
  questionId: string,
  input: Partial<QuestionInput>,
): Promise<ExamQuestion> {
  return api.patch(`/v1/exams/${examId}/questions/${questionId}`, input);
}

export async function deleteQuestion(examId: string, questionId: string): Promise<void> {
  await api.delete(`/v1/exams/${examId}/questions/${questionId}`);
}

export interface OptionInput {
  label: string;
  position: number;
  isCorrect: boolean;
}

export async function addOption(examId: string, questionId: string, input: OptionInput): Promise<ExamOption> {
  return api.post(`/v1/exams/${examId}/questions/${questionId}/options`, input);
}

export async function updateOption(
  examId: string,
  questionId: string,
  optionId: string,
  input: Partial<OptionInput>,
): Promise<ExamOption> {
  return api.patch(`/v1/exams/${examId}/questions/${questionId}/options/${optionId}`, input);
}

export async function deleteOption(examId: string, questionId: string, optionId: string): Promise<void> {
  await api.delete(`/v1/exams/${examId}/questions/${questionId}/options/${optionId}`);
}

// PUT, not PATCH: the checkbox screen submits the COMPLETE set of enabled
// event types and the stored list is replaced by it (RULE-EXAM-13).
export async function setMonitoringConfig(examId: string, input: ExamMonitoringConfig): Promise<ExamMonitoringConfig> {
  return api.put(`/v1/exams/${examId}/monitoring-config`, input);
}

export interface ExamSessionRow {
  sessionId: string;
  personId: string;
  personName: string;
  status: string;
  startedAt: string;
  expiresAt: string | null;
  endedAt: string | null;
  violationCount: number;
  automaticScore: number | null;
  pendingManualGrading: number;
}

export interface ExamSessionEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  treatedAsViolation: boolean;
  details: Record<string, unknown> | null;
}

export interface ExamSessionAnswer {
  answerId: string;
  examQuestionId: string;
  questionType: QuestionType;
  prompt: string;
  points: number | null;
  answerText: string | null;
  selectedOptionIds: string[];
  awardedPoints: number | null;
}

export interface ExamSessionDetail {
  session: ExamSessionRow;
  answers: ExamSessionAnswer[];
  events: ExamSessionEvent[];
}

export async function listExamSessions(examId: string): Promise<ExamSessionRow[]> {
  return api.get(`/v1/exams/${examId}/sessions`);
}

export async function getExamSessionDetail(examId: string, sessionId: string): Promise<ExamSessionDetail> {
  return api.get(`/v1/exams/${examId}/sessions/${sessionId}`);
}

// RULE-EXAM-14's manual half. Objective questions are graded by the server
// when the session ends and are rejected here.
export async function gradeAnswer(
  examId: string,
  sessionId: string,
  answerId: string,
  awardedPoints: number,
): Promise<ExamSessionAnswer> {
  return api.patch(`/v1/exams/${examId}/sessions/${sessionId}/answers/${answerId}/grade`, { awardedPoints });
}
