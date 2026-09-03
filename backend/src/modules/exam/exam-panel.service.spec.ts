import {
  ExamAnswerEntity,
  ExamAnswerSelectedOptionEntity,
  ExamEntity,
  ExamMonitoringConfigEntity,
  ExamMonitoringEventTypeEntity,
  ExamQuestionEntity,
  ExamQuestionOptionEntity,
  ExamSessionEntity,
  PersonEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ExamPanelService } from './exam-panel.service';

// The teacher's read model (RULE-EXAM-16's management/audit access). Unlike
// the student's, it DOES carry the answer key and the scores — the two
// models are separate files precisely so that asymmetry is explicit.
describe('ExamPanelService', () => {
  const exam = { id: 'exam-1', classGroupId: 'class-group-1', status: 'PUBLISHED' } as ExamEntity;
  const session = {
    id: 'session-1',
    examId: 'exam-1',
    personId: 'student-1',
    status: 'IN_PROGRESS',
    startedAt: new Date('2026-09-03T10:00:00.000Z'),
    expiresAt: null,
    endedAt: null,
  } as ExamSessionEntity;

  function buildService(options: {
    questions?: Partial<ExamQuestionEntity>[];
    answers?: Partial<ExamAnswerEntity>[];
    sessions?: ExamSessionEntity[];
  } = {}) {
    const questionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(options.questions ?? []),
    });
    const optionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue([
        { id: 'option-1', examQuestionId: 'question-1', label: 'A', position: 0, isCorrect: true },
      ]),
    });
    const answerRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(options.answers ?? []),
    });
    const selectionRepo: MockRepository = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
    const configRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'config-1', monitoringMode: 'TERMINATE' }),
    });
    const eventTypeRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue([{ eventType: 'PAGE_BLUR' }]),
    });
    const personRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue([{ id: 'student-1', fullName: 'Ana Souza' }] as PersonEntity[]),
    });

    const manager = createMockEntityManager(
      new Map([
        [ExamQuestionEntity, questionRepo],
        [ExamQuestionOptionEntity, optionRepo],
        [ExamAnswerEntity, answerRepo],
        [ExamAnswerSelectedOptionEntity, selectionRepo],
        [ExamMonitoringConfigEntity, configRepo],
        [ExamMonitoringEventTypeEntity, eventTypeRepo],
        [PersonEntity, personRepo],
      ]),
    );

    const examAccess = { authorizeExam: jest.fn().mockResolvedValue(exam) };
    const sessions = {
      listRefreshedForExam: jest.fn().mockResolvedValue(options.sessions ?? [session]),
      getRefreshedSessionForExam: jest.fn().mockResolvedValue(session),
    };
    const audit = {
      statsBySession: jest
        .fn()
        .mockResolvedValue(
          new Map([['session-1', { examSessionId: 'session-1', eventCount: 4, violationCount: 3, lastEventAt: null }]]),
        ),
      timeline: jest.fn().mockResolvedValue([]),
    };

    const service = new ExamPanelService(
      createMockTenantContext(manager) as never,
      examAccess as never,
      sessions as never,
      audit as never,
    );

    return { service, examAccess, sessions, audit };
  }

  test('test_examDetail_teacherPayloadIncludesAnswerKeyAndPoints', async () => {
    const { service } = buildService({
      questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', prompt: 'Which?', position: 0, points: 10 }],
    });

    const detail = await service.examDetail('teacher-1', 'exam-1');

    expect(detail.questions[0].points).toBe(10);
    expect(detail.questions[0].options[0].isCorrect).toBe(true);
    expect(detail.monitoringMode).toBe('TERMINATE');
    expect(detail.monitoredEventTypes).toEqual(['PAGE_BLUR']);
  });

  test('test_examDetail_authorizesBeforeReading', async () => {
    const { service, examAccess } = buildService();
    examAccess.authorizeExam.mockRejectedValue(new Error('RULE-EXAM-16'));

    await expect(service.examDetail('stranger-1', 'exam-1')).rejects.toThrow(/RULE-EXAM-16/);
  });

  // The 5-second poll: sessions are refreshed on read (which is what turns a
  // closed window into ABANDONED) and violation counts come aggregated.
  test('test_sessionPanel_returnsRefreshedSessionsWithViolationCounts', async () => {
    const { service, sessions } = buildService();

    const panel = await service.sessionPanel('teacher-1', 'exam-1');

    expect(sessions.listRefreshedForExam).toHaveBeenCalledWith(exam);
    expect(panel[0]).toEqual(
      expect.objectContaining({ examSessionId: 'session-1', personName: 'Ana Souza', violationCount: 3, eventCount: 4 }),
    );
  });

  test('test_sessionPanel_noSessions_returnsEmptyWithoutQueryingStats', async () => {
    const { service, audit } = buildService({ sessions: [] });

    await expect(service.sessionPanel('teacher-1', 'exam-1')).resolves.toEqual([]);
    expect(audit.statsBySession).not.toHaveBeenCalled();
  });

  describe('sessionDetail', () => {
    test('test_sessionDetail_totalsCountEveryQuestionNotOnlyTheAnsweredOnes', async () => {
      const { service } = buildService({
        questions: [
          { id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: 10 },
          { id: 'question-2', questionType: 'PARAGRAPH', points: 5 },
        ],
        answers: [{ id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1', awardedPoints: 10 }],
      });

      const detail = await service.sessionDetail('teacher-1', 'exam-1', 'session-1');

      expect(detail.totalAwardedPoints).toBe(10);
      // The unanswered question still counts against the total — it is
      // simply worth zero (confirmed 2026-09-03).
      expect(detail.totalPossiblePoints).toBe(15);
    });

    // RULE-EXAM-14: only subjective answers ever wait for a human.
    test('test_sessionDetail_ungradedSubjectiveAnswer_flaggedForManualGrading', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'PARAGRAPH', points: 5 }],
        answers: [
          { id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1', answerText: 'x', awardedPoints: null },
        ],
      });

      const detail = await service.sessionDetail('teacher-1', 'exam-1', 'session-1');

      expect(detail.answers[0].awaitingManualGrading).toBe(true);
    });

    test('test_sessionDetail_objectiveAnswer_neverFlaggedForManualGrading', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: 5 }],
        answers: [
          { id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1', awardedPoints: null },
        ],
      });

      const detail = await service.sessionDetail('teacher-1', 'exam-1', 'session-1');

      expect(detail.answers[0].awaitingManualGrading).toBe(false);
    });

    test('test_sessionDetail_includesTheViolationTimeline', async () => {
      const { service, audit } = buildService();

      await service.sessionDetail('teacher-1', 'exam-1', 'session-1');

      expect(audit.timeline).toHaveBeenCalledWith('session-1');
    });
  });
});
