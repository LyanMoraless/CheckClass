import { ExamEntity, ExamQuestionEntity, ExamQuestionOptionEntity, ExamSessionEntity } from '../../database/entities';
import {
  studentSessionState,
  toStudentAnswerViews,
  toStudentExamSummary,
  toStudentQuestionViews,
  toStudentSessionView,
} from './exam-student-view';

// RULE-EXAM-17: no payload served to a student, during or after the exam,
// may carry the answer key (is_correct) or any score. These tests exist
// because that guarantee is only as strong as the allow-list — a leak here
// would be silent in every other test in the module.
describe('examStudentView', () => {
  const question = {
    id: 'question-1',
    examId: 'exam-1',
    questionType: 'MULTIPLE_CHOICE',
    prompt: 'Which one?',
    position: 1,
    points: 10,
  } as ExamQuestionEntity;

  const options = [
    { id: 'option-2', examQuestionId: 'question-1', label: 'Wrong', position: 2, isCorrect: false },
    { id: 'option-1', examQuestionId: 'question-1', label: 'Right', position: 1, isCorrect: true },
  ] as ExamQuestionOptionEntity[];

  test('test_toStudentQuestionViews_neverExposesPointsOrAnswerKey', () => {
    const views = toStudentQuestionViews([question], options);

    expect(views).toHaveLength(1);
    expect(views[0]).not.toHaveProperty('points');
    for (const option of views[0].options) {
      expect(option).not.toHaveProperty('isCorrect');
    }
    // Serialized shape too — the payload is what actually reaches the
    // student, not the object's own keys.
    expect(JSON.stringify(views)).not.toContain('isCorrect');
    expect(JSON.stringify(views)).not.toContain('points');
  });

  test('test_toStudentQuestionViews_sortsQuestionsAndOptionsByPosition', () => {
    const second = { ...question, id: 'question-2', position: 0 } as ExamQuestionEntity;
    const views = toStudentQuestionViews([question, second], options);

    expect(views.map((view) => view.id)).toEqual(['question-2', 'question-1']);
    expect(views[1].options.map((option) => option.id)).toEqual(['option-1', 'option-2']);
  });

  test('test_toStudentAnswerViews_neverExposesAwardedPoints', () => {
    const views = toStudentAnswerViews([
      { examQuestionId: 'question-1', answerText: 'my answer', selectedOptionIds: ['option-1'], updatedAt: new Date() },
    ]);

    expect(views[0]).not.toHaveProperty('awardedPoints');
    expect(JSON.stringify(views)).not.toContain('awardedPoints');
  });

  test('test_toStudentSessionView_exposesAbsoluteDeadlineAndMonitoringContext', () => {
    const session = {
      id: 'session-1',
      examId: 'exam-1',
      personId: 'student-1',
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-09-03T10:00:00.000Z'),
      expiresAt: new Date('2026-09-03T11:00:00.000Z'),
      endedAt: null,
      monitoringModeSnapshot: 'TERMINATE',
      monitoredEventTypesSnapshot: ['PAGE_BLUR'],
    } as ExamSessionEntity;

    const view = toStudentSessionView(session);

    expect(view.expiresAt).toEqual(new Date('2026-09-03T11:00:00.000Z'));
    expect(view.monitoringMode).toBe('TERMINATE');
    expect(view.monitoredEventTypes).toEqual(['PAGE_BLUR']);
    // personId is not echoed back: it came from the JWT, and the student has
    // no use for it.
    expect(view).not.toHaveProperty('personId');
  });

  // RULE-EXAM-12's seven states as the student sees them: the five persisted
  // ones, plus NOT_STARTED/AVAILABLE derived from the window.
  describe('studentSessionState', () => {
    test('test_studentSessionState_noSessionWindowOpen_available', () => {
      expect(studentSessionState('EXAM_AVAILABLE', null)).toBe('AVAILABLE');
    });

    test('test_studentSessionState_noSessionWindowNotOpenYet_notStarted', () => {
      expect(studentSessionState('EXAM_NOT_AVAILABLE', null)).toBe('NOT_STARTED');
    });

    test('test_studentSessionState_noSessionWindowClosed_notStarted', () => {
      expect(studentSessionState('EXAM_CLOSED', null)).toBe('NOT_STARTED');
    });

    test('test_studentSessionState_existingSession_usesPersistedStatus', () => {
      expect(studentSessionState('EXAM_AVAILABLE', { status: 'TERMINATED' } as ExamSessionEntity)).toBe('TERMINATED');
    });
  });

  test('test_toStudentExamSummary_carriesWindowAndStateWithoutInternals', () => {
    const exam = {
      id: 'exam-1',
      title: 'Prova 1',
      description: null,
      classGroupId: 'class-group-1',
      createdByPersonId: 'teacher-1',
      status: 'PUBLISHED',
      availableFrom: new Date('2026-09-03T10:00:00.000Z'),
      availableUntil: new Date('2026-09-03T12:00:00.000Z'),
      durationMinutes: 60,
    } as ExamEntity;

    const summary = toStudentExamSummary(exam, 'EXAM_AVAILABLE', null);

    expect(summary.examId).toBe('exam-1');
    expect(summary.sessionState).toBe('AVAILABLE');
    expect(summary).not.toHaveProperty('createdByPersonId');
    expect(summary).not.toHaveProperty('status');
  });
});
