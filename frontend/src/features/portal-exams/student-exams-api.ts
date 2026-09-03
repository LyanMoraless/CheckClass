import { api } from '../../lib/api-client';
import type { MonitorableEventType, MonitoringMode, QuestionType } from '../exams/exams-api';

// Everything here mirrors the allow-list views in
// backend/src/modules/exam/exam-student-view.ts. Note what is absent and
// must stay absent: no isCorrect on options, no points on questions, no
// score anywhere (RULE-EXAM-17). If a field shows up in a payload that has
// no home in these types, that is the signal something leaked server-side.
export interface StudentExamSummary {
  examId: string;
  title: string;
  description: string | null;
  availableFrom: string;
  availableUntil: string;
  durationMinutes: number | null;
  availabilityState: 'EXAM_NOT_AVAILABLE' | 'EXAM_AVAILABLE' | 'EXAM_CLOSED';
  sessionState: 'NOT_STARTED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'TERMINATED' | 'EXPIRED' | 'ABANDONED';
}

export interface StudentOption {
  id: string;
  label: string;
  position: number;
}

export interface StudentQuestion {
  id: string;
  questionType: QuestionType;
  prompt: string;
  position: number;
  options: StudentOption[];
}

export interface StudentSession {
  id: string;
  examId: string;
  status: string;
  startedAt: string;
  // The one absolute deadline the countdown renders from — identical on
  // start and on every reload (RULE-EXAM-07/11). The client never decides
  // expiry from it; the server revalidates on every write.
  expiresAt: string | null;
  endedAt: string | null;
  monitoringMode: MonitoringMode;
  monitoredEventTypes: MonitorableEventType[];
}

export interface StudentAnswer {
  examQuestionId: string;
  answerText: string | null;
  selectedOptionIds: string[];
}

export interface StudentSessionPayload {
  session: StudentSession;
  questions: StudentQuestion[];
  answers: StudentAnswer[];
}

export interface ReportEventResult {
  recorded: boolean;
  treatedAsViolation: boolean;
  action: string | null;
  sessionStatus: string;
}

export async function listMyExams(): Promise<StudentExamSummary[]> {
  return api.get('/v1/me/exams');
}

// Start OR recover — one endpoint, because which one it is depends on server
// state, not on what the client claims. Refreshing never consumes the single
// attempt (RULE-EXAM-11).
export async function startExamSession(examId: string): Promise<StudentSessionPayload> {
  return api.post(`/v1/me/exams/${examId}/session`, {});
}

// Pure read — never creates a session.
export async function getMyExamSession(examId: string): Promise<StudentSessionPayload> {
  return api.get(`/v1/me/exams/${examId}/session`);
}

export async function saveAnswer(
  examId: string,
  questionId: string,
  input: { answerText?: string; selectedOptionIds?: string[] },
): Promise<StudentAnswer> {
  return api.put(`/v1/me/exams/${examId}/answers/${questionId}`, input);
}

export async function reportMonitoringEvent(
  examId: string,
  eventType: MonitorableEventType,
  details?: Record<string, string>,
): Promise<ReportEventResult> {
  return api.post(`/v1/me/exams/${examId}/events`, { eventType, details });
}

export async function submitExam(examId: string): Promise<StudentSession> {
  return api.post(`/v1/me/exams/${examId}/submit`, {});
}
