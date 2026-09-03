// Single source of the Exam Area's fixed value sets. Every one of these
// mirrors a CHECK constraint in the AddExamArea migration or a value list
// fixed by RULE-EXAM-03/04/05/06/12 — they live here (and not spread across
// DTOs and services) so that a value can never drift between the validation
// layer, the service layer and the database.

// RULE-EXAM-13 + confirmed 2026-09-03: an exam is born DRAFT and is
// invisible to students until explicitly published. Opening the availability
// window is NOT what exposes it.
export const EXAM_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

// RULE-EXAM-03, definitive set (the extra Google-Forms-style types were
// removed from the product radar on 2026-09-02, not merely postponed).
export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'SHORT_ANSWER', 'PARAGRAPH'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// RULE-EXAM-14: the automatic-grading half of the type set. Options only
// exist for these two, and only these two are graded against an answer key —
// SHORT_ANSWER/PARAGRAPH always wait for the teacher.
export const OBJECTIVE_QUESTION_TYPES: readonly QuestionType[] = ['MULTIPLE_CHOICE', 'CHECKBOXES'];

export function isObjectiveQuestion(questionType: string): boolean {
  return OBJECTIVE_QUESTION_TYPES.includes(questionType as QuestionType);
}

// RULE-EXAM-04's two reaction modes.
export const MONITORING_MODES = ['TERMINATE', 'LOG_ONLY'] as const;
export type MonitoringMode = (typeof MONITORING_MODES)[number];

// RULE-EXAM-05's event vocabulary, as confirmed on 2026-09-03:
// NEW_TAB_OR_WINDOW_ATTEMPT is one single value for "new tab" and "new
// window" (the browser cannot reliably tell them apart), and
// EXTERNAL_APPLICATION_FOCUS is absent because it needs a desktop agent that
// is out of scope this round.
//
// This is ALSO the allow-list of what a client may report (Security control
// 4): anything outside this list is rejected at the DTO and re-checked in
// ExamMonitoringService, so a client can never inject a server-generated
// event type through the reporting endpoint.
export const MONITORABLE_EVENT_TYPES = [
  'PAGE_BLUR',
  'PAGE_VISIBILITY_CHANGED',
  'NEW_TAB_OR_WINDOW_ATTEMPT',
  'EXTERNAL_NAVIGATION_ATTEMPT',
  'KEYBOARD_RESTRICTION_TRIGGERED',
  'PAGE_RELOAD',
] as const;
export type MonitorableEventType = (typeof MONITORABLE_EVENT_TYPES)[number];

// RULE-EXAM-11 treats page reload differently from every other type: it is
// ALWAYS written to the audit trail, enabled or not, and only the
// "counts as a violation" part is conditional on being enabled.
export const PAGE_RELOAD_EVENT_TYPE: MonitorableEventType = 'PAGE_RELOAD';

// The other half of Security control 4: event types only the SERVER may
// ever write. Kept disjoint from MONITORABLE_EVENT_TYPES on purpose — the
// two write paths of ExamAuditService each validate against their own list,
// so no client payload can fabricate a lifecycle event.
export const SERVER_EVENT_TYPES = [
  'EXAM_SESSION_STARTED',
  'EXAM_TIME_EXPIRED',
  'EXAM_SESSION_COMPLETED',
  'EXAM_SESSION_TERMINATED',
  'EXAM_SESSION_ABANDONED',
] as const;
export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];

// RULE-EXAM-12 lists seven states, but only these five are ever persisted:
// NOT_STARTED and AVAILABLE are derived from the availability window and
// have no row (see ExamAvailabilityService), which the migration's CHECK
// also enforces.
export const SESSION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'TERMINATED', 'EXPIRED', 'ABANDONED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// RULE-EXAM-06's three window states, in the English technical vocabulary
// the rule itself fixes (PROVA_* -> EXAM_*).
export const AVAILABILITY_STATES = ['EXAM_NOT_AVAILABLE', 'EXAM_AVAILABLE', 'EXAM_CLOSED'] as const;
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

// RULE-EXAM-16 routes student eligibility through an ACTIVE enrollment —
// same value as ENROLLMENT_STATUSES[0] in class-group.service.ts
// (RULE-INST-11), named here so the eligibility check reads as a rule
// instead of a bare string literal.
export const ACTIVE_ENROLLMENT_STATUS = 'active';
