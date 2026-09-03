import { ExamEntity, ExamQuestionEntity, ExamQuestionOptionEntity, ExamSessionEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ExamStudentService } from './exam-student.service';

// The student's read model. What matters here is what it refuses to serve
// (DRAFT exams, exams of turmas the student is not actively enrolled in, and
// anything carrying an answer key — RULE-EXAM-17) as much as what it returns.
describe('ExamStudentService', () => {
  const exam = {
    id: 'exam-1',
    classGroupId: 'class-group-1',
    title: 'Prova 1',
    description: null,
    status: 'PUBLISHED',
    availableFrom: new Date('2026-09-03T10:00:00.000Z'),
    availableUntil: new Date('2026-09-03T12:00:00.000Z'),
    durationMinutes: 60,
  } as ExamEntity;

  const session = {
    id: 'session-1',
    examId: 'exam-1',
    personId: 'student-1',
    status: 'IN_PROGRESS',
    startedAt: new Date('2026-09-03T10:05:00.000Z'),
    expiresAt: new Date('2026-09-03T11:05:00.000Z'),
    endedAt: null,
    monitoringModeSnapshot: 'LOG_ONLY',
    monitoredEventTypesSnapshot: ['PAGE_BLUR'],
  } as ExamSessionEntity;

  function buildService(options: { exams?: ExamEntity[]; classGroupIds?: string[]; session?: ExamSessionEntity | null } = {}) {
    const examRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(options.exams ?? [exam]),
      findOneBy: jest.fn().mockResolvedValue(exam),
    });
    const questionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue([
        { id: 'question-1', examId: 'exam-1', questionType: 'MULTIPLE_CHOICE', prompt: 'Which?', position: 0, points: 10 },
      ] as ExamQuestionEntity[]),
    });
    const optionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue([
        { id: 'option-1', examQuestionId: 'question-1', label: 'A', position: 0, isCorrect: true },
      ] as ExamQuestionOptionEntity[]),
    });

    const manager = createMockEntityManager(
      new Map([
        [ExamEntity, examRepo],
        [ExamQuestionEntity, questionRepo],
        [ExamQuestionOptionEntity, optionRepo],
      ]),
    );

    const availability = {
      assertExamAreaEnabled: jest.fn().mockResolvedValue(undefined),
      assertStudentVisibility: jest.fn().mockResolvedValue(undefined),
      activeEnrollmentClassGroupIds: jest.fn().mockResolvedValue(options.classGroupIds ?? ['class-group-1']),
      windowState: jest.fn().mockReturnValue('EXAM_AVAILABLE'),
    };
    const sessions = {
      findRefreshedSession: jest.fn().mockResolvedValue(options.session === undefined ? null : options.session),
      startOrResume: jest.fn().mockResolvedValue({ exam, session }),
      finish: jest.fn().mockResolvedValue({ ...session, status: 'COMPLETED', endedAt: new Date() }),
    };
    const answers = { listAnswers: jest.fn().mockResolvedValue([]) };

    const service = new ExamStudentService(
      createMockTenantContext(manager) as never,
      availability as never,
      sessions as never,
      answers as never,
    );

    return { service, examRepo, availability, sessions, answers };
  }

  describe('listMyExams', () => {
    // Confirmed 2026-09-03: DRAFT exams are invisible to students, and that
    // is a query filter rather than a post-filter so a draft never even
    // leaves the database.
    test('test_listMyExams_queriesOnlyPublishedExamsOfEnrolledClassGroups', async () => {
      const { service, examRepo } = buildService();

      await service.listMyExams('student-1');

      expect(examRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });

    test('test_listMyExams_noActiveEnrollment_returnsNothing', async () => {
      const { service, examRepo } = buildService({ classGroupIds: [] });

      await expect(service.listMyExams('student-1')).resolves.toEqual([]);
      expect(examRepo.find).not.toHaveBeenCalled();
    });

    // RULE-EXAM-02 is checked before any exam is read at all.
    test('test_listMyExams_checksInstitutionTypeFirst', async () => {
      const { service, availability } = buildService();
      availability.assertExamAreaEnabled.mockRejectedValue(new Error('RULE-EXAM-02'));

      await expect(service.listMyExams('student-1')).rejects.toThrow(/RULE-EXAM-02/);
      expect(availability.activeEnrollmentClassGroupIds).not.toHaveBeenCalled();
    });

    test('test_listMyExams_withoutSession_reportsDerivedAvailableState', async () => {
      const { service } = buildService({ session: null });

      const [summary] = await service.listMyExams('student-1');

      expect(summary.sessionState).toBe('AVAILABLE');
      expect(summary.availabilityState).toBe('EXAM_AVAILABLE');
    });

    test('test_listMyExams_withSession_reportsPersistedSessionState', async () => {
      const { service } = buildService({ session });

      const [summary] = await service.listMyExams('student-1');

      expect(summary.sessionState).toBe('IN_PROGRESS');
    });
  });

  describe('session payloads', () => {
    // RULE-EXAM-17, at the level that actually reaches the wire.
    test('test_startSession_payloadCarriesNoAnswerKeyOrPoints', async () => {
      const { service } = buildService();

      const payload = await service.startSession('student-1', 'exam-1');

      expect(JSON.stringify(payload)).not.toContain('isCorrect');
      expect(JSON.stringify(payload)).not.toContain('points');
    });

    // RULE-EXAM-11: recovery serves the SAME absolute deadline, and does not
    // start anything.
    test('test_getMySession_returnsExistingSessionWithSameDeadline', async () => {
      const { service, sessions } = buildService({ session });

      const payload = await service.getMySession('student-1', 'exam-1');

      expect(payload.session.expiresAt).toEqual(session.expiresAt);
      expect(sessions.startOrResume).not.toHaveBeenCalled();
    });

    test('test_getMySession_noSession_notFound', async () => {
      const { service } = buildService({ session: null });

      await expect(service.getMySession('student-1', 'exam-1')).rejects.toThrow(/no session for exam/);
    });

    test('test_getMySession_checksVisibilityBeforeServingAnything', async () => {
      const { service, availability } = buildService({ session });
      availability.assertStudentVisibility.mockRejectedValue(new Error('RULE-EXAM-16'));

      await expect(service.getMySession('student-1', 'exam-1')).rejects.toThrow(/RULE-EXAM-16/);
    });

    test('test_finish_returnsCompletedSessionView', async () => {
      const { service } = buildService({ session });

      const view = await service.finish('student-1', 'exam-1');

      expect(view.status).toBe('COMPLETED');
      expect(view).not.toHaveProperty('personId');
    });
  });
});
