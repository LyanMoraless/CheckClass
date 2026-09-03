import {
  ExamEntity,
  ExamMonitoringConfigEntity,
  ExamMonitoringEventTypeEntity,
  ExamQuestionEntity,
  ExamQuestionOptionEntity,
  ExamSessionEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ExamAuthoringService } from './exam-authoring.service';

// The invariants the AddExamArea migration explicitly left to this layer,
// plus the DRAFT/PUBLISHED lifecycle confirmed on 2026-09-03.
// ExamAccessService is mocked — RULE-EXAM-16's authorization has its own
// spec, and LeadershipScopeService already has one of its own.
describe('ExamAuthoringService', () => {
  // A factory, not a shared const: publish() mutates the entity in place
  // (status/publishedAt), which is the normal TypeORM load-mutate-save
  // shape. A single shared object would carry PUBLISHED over into every
  // later test and make them assert against the "already published" guard
  // instead of the validation each one is actually about.
  function buildDraftExam(): ExamEntity {
    return {
      id: 'exam-1',
      classGroupId: 'class-group-1',
      status: 'DRAFT',
      publishedAt: null,
      availableFrom: new Date('2026-09-03T10:00:00.000Z'),
      availableUntil: new Date('2026-09-03T12:00:00.000Z'),
      durationMinutes: 60,
    } as ExamEntity;
  }

  function buildService(options: {
    exam?: ExamEntity;
    questions?: Partial<ExamQuestionEntity>[];
    options?: Partial<ExamQuestionOptionEntity>[];
    sessionCount?: number;
    monitoringConfig?: Partial<ExamMonitoringConfigEntity> | null;
  } = {}) {
    const exam = options.exam ?? buildDraftExam();
    const questions = (options.questions ?? []) as ExamQuestionEntity[];
    const questionOptions = (options.options ?? []) as ExamQuestionOptionEntity[];

    const examRepo: MockRepository = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(exam) });
    const questionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(questions),
      findOneBy: jest.fn().mockImplementation(async ({ id }: { id: string }) => questions.find((q) => q.id === id) ?? null),
    });
    const optionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(questionOptions),
      findOneBy: jest
        .fn()
        .mockImplementation(async ({ id }: { id: string }) => questionOptions.find((o) => o.id === id) ?? null),
      // count() belongs here, not on questionRepo: the only thing the
      // service counts is options-per-question, when guarding a question
      // type change (and sessions-per-exam, on sessionRepo).
      count: jest.fn().mockResolvedValue(questionOptions.length),
    });
    const configRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(
        options.monitoringConfig === undefined
          ? { id: 'config-1', examId: 'exam-1', monitoringMode: 'LOG_ONLY' }
          : options.monitoringConfig,
      ),
    });
    const eventTypeRepo: MockRepository = createMockRepository();
    const sessionRepo: MockRepository = createMockRepository({
      count: jest.fn().mockResolvedValue(options.sessionCount ?? 0),
    });

    const manager = createMockEntityManager(
      new Map([
        [ExamEntity, examRepo],
        [ExamQuestionEntity, questionRepo],
        [ExamQuestionOptionEntity, optionRepo],
        [ExamMonitoringConfigEntity, configRepo],
        [ExamMonitoringEventTypeEntity, eventTypeRepo],
        [ExamSessionEntity, sessionRepo],
      ]),
    );

    const examAccess = {
      authorizeClassGroup: jest.fn().mockResolvedValue(undefined),
      authorizeExam: jest.fn().mockResolvedValue(exam),
    };
    const service = new ExamAuthoringService(createMockTenantContext(manager) as never, examAccess as never);

    return { service, examRepo, questionRepo, optionRepo, configRepo, eventTypeRepo, sessionRepo, examAccess };
  }

  describe('create', () => {
    const input = {
      classGroupId: 'class-group-1',
      title: 'Prova 1',
      availableFrom: '2026-09-03T10:00:00.000Z',
      availableUntil: '2026-09-03T12:00:00.000Z',
      monitoringMode: 'TERMINATE' as const,
      monitoredEventTypes: ['PAGE_BLUR' as const],
    };

    // Confirmed 2026-09-03: an exam is born invisible to students.
    test('test_create_alwaysStartsAsDraftWithoutPublishedAt', async () => {
      const { service, examRepo } = buildService();

      await service.create('teacher-1', input);

      expect(examRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DRAFT', publishedAt: null, createdByPersonId: 'teacher-1' }),
      );
    });

    test('test_create_authorizesClassGroupBeforeWriting', async () => {
      const { service, examAccess } = buildService();

      await service.create('teacher-1', input);

      expect(examAccess.authorizeClassGroup).toHaveBeenCalledWith('teacher-1', 'class-group-1');
    });

    // RULE-EXAM-13: the monitoring behavior is part of creating the exam, and
    // the session snapshot depends on it existing.
    test('test_create_writesMonitoringConfigWithTheExam', async () => {
      const { service, configRepo, eventTypeRepo } = buildService();

      await service.create('teacher-1', input);

      expect(configRepo.save).toHaveBeenCalledWith(expect.objectContaining({ monitoringMode: 'TERMINATE' }));
      expect(eventTypeRepo.save).toHaveBeenCalledWith([expect.objectContaining({ eventType: 'PAGE_BLUR' })]);
    });

    test('test_create_titleIsSanitized', async () => {
      const { service, examRepo } = buildService();

      await service.create('teacher-1', { ...input, title: 'Prova <script>alert(1)</script>' });

      expect(examRepo.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Prova alert(1)' }));
    });

    test('test_create_windowEndsBeforeItStarts_rejected', async () => {
      const { service } = buildService();

      await expect(
        service.create('teacher-1', { ...input, availableUntil: '2026-09-03T09:00:00.000Z' }),
      ).rejects.toThrow(/RULE-EXAM-06/);
    });
  });

  describe('publish', () => {
    test('test_publish_examWithoutQuestions_rejected', async () => {
      const { service } = buildService({ questions: [] });

      await expect(service.publish('teacher-1', 'exam-1')).rejects.toThrow(/has no questions/);
    });

    test('test_publish_objectiveQuestionWithSingleOption_rejected', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: null }],
        options: [{ id: 'option-1', examQuestionId: 'question-1', isCorrect: false }],
      });

      await expect(service.publish('teacher-1', 'exam-1')).rejects.toThrow(/at least 2 options/);
    });

    // RULE-EXAM-14 keeps the answer key optional, so a question worth NO
    // points may legitimately have nothing marked correct.
    test('test_publish_unscoredObjectiveQuestionWithoutAnswerKey_allowed', async () => {
      const { service, examRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: null }],
        options: [
          { id: 'option-1', examQuestionId: 'question-1', isCorrect: false },
          { id: 'option-2', examQuestionId: 'question-1', isCorrect: false },
        ],
      });

      await service.publish('teacher-1', 'exam-1');

      expect(examRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED' }));
    });

    // A SCORED objective question with no key could never be graded, by
    // anyone — that is a mistake rather than a choice.
    test('test_publish_scoredObjectiveQuestionWithoutAnswerKey_rejected', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: 10 }],
        options: [
          { id: 'option-1', examQuestionId: 'question-1', isCorrect: false },
          { id: 'option-2', examQuestionId: 'question-1', isCorrect: false },
        ],
      });

      await expect(service.publish('teacher-1', 'exam-1')).rejects.toThrow(/no correct option marked/);
    });

    test('test_publish_multipleChoiceWithTwoCorrectOptions_rejected', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: 10 }],
        options: [
          { id: 'option-1', examQuestionId: 'question-1', isCorrect: true },
          { id: 'option-2', examQuestionId: 'question-1', isCorrect: true },
        ],
      });

      await expect(service.publish('teacher-1', 'exam-1')).rejects.toThrow(/more than one correct option/);
    });

    // CHECKBOXES is the type that may have several correct options
    // (RULE-EXAM-03).
    test('test_publish_checkboxesWithSeveralCorrectOptions_allowed', async () => {
      const { service, examRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'CHECKBOXES', points: 10 }],
        options: [
          { id: 'option-1', examQuestionId: 'question-1', isCorrect: true },
          { id: 'option-2', examQuestionId: 'question-1', isCorrect: true },
        ],
      });

      await service.publish('teacher-1', 'exam-1');

      expect(examRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED' }));
    });

    test('test_publish_subjectiveQuestionsOnly_needsNoOptions', async () => {
      const { service, examRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'PARAGRAPH', points: 10 }],
      });

      await service.publish('teacher-1', 'exam-1');

      expect(examRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED' }));
    });

    // publishedAt is kept in lockstep with status by a CHECK constraint.
    test('test_publish_setsPublishedAtAlongsideStatus', async () => {
      const { service, examRepo } = buildService({ questions: [{ id: 'question-1', questionType: 'SHORT_ANSWER' }] });

      await service.publish('teacher-1', 'exam-1');

      const saved = examRepo.save.mock.calls[0][0] as ExamEntity;
      expect(saved.status).toBe('PUBLISHED');
      expect(saved.publishedAt).toBeInstanceOf(Date);
    });

    test('test_publish_alreadyPublished_conflicts', async () => {
      const { service } = buildService({
        exam: { ...buildDraftExam(), status: 'PUBLISHED', publishedAt: new Date() } as ExamEntity,
      });

      await expect(service.publish('teacher-1', 'exam-1')).rejects.toThrow(/already published/);
    });

    test('test_publish_withoutMonitoringConfig_rejected', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'SHORT_ANSWER' }],
        monitoringConfig: null,
      });

      await expect(service.publish('teacher-1', 'exam-1')).rejects.toThrow(/RULE-EXAM-13/);
    });
  });

  describe('editing lock', () => {
    // Approved assumption: content and critical configuration freeze the
    // moment any student session exists — the session snapshot protects runs
    // already started, not the fairness of the exam as a whole.
    test('test_update_afterAnySessionExists_conflicts', async () => {
      const { service } = buildService({ sessionCount: 1 });

      await expect(service.update('teacher-1', 'exam-1', { title: 'New title' })).rejects.toThrow(
        /already has student sessions/,
      );
    });

    test('test_addQuestion_afterAnySessionExists_conflicts', async () => {
      const { service } = buildService({ sessionCount: 1 });

      await expect(
        service.addQuestion('teacher-1', 'exam-1', { questionType: 'SHORT_ANSWER', prompt: 'Why?', position: 0 }),
      ).rejects.toThrow(/already has student sessions/);
    });

    test('test_setMonitoringConfig_afterAnySessionExists_conflicts', async () => {
      const { service } = buildService({ sessionCount: 1 });

      await expect(service.setMonitoringConfig('teacher-1', 'exam-1', 'TERMINATE', [])).rejects.toThrow(
        /already has student sessions/,
      );
    });

    test('test_remove_afterAnySessionExists_conflicts', async () => {
      const { service } = buildService({ sessionCount: 1 });

      await expect(service.remove('teacher-1', 'exam-1')).rejects.toThrow(/already has student sessions/);
    });
  });

  describe('options', () => {
    // The migration's first application-layer invariant.
    test('test_addOption_onSubjectiveQuestion_rejected', async () => {
      const { service } = buildService({ questions: [{ id: 'question-1', questionType: 'PARAGRAPH', examId: 'exam-1' }] });

      await expect(
        service.addOption('teacher-1', 'exam-1', 'question-1', { label: 'A', position: 0 }),
      ).rejects.toThrow(/cannot have options/);
    });

    // RULE-EXAM-03: "múltipla escolha (uma resposta correta possível)".
    test('test_addOption_secondCorrectOptionOnMultipleChoice_rejected', async () => {
      const { service, optionRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', examId: 'exam-1' }],
      });
      optionRepo.find.mockResolvedValue([{ id: 'option-1', isCorrect: true }]);

      await expect(
        service.addOption('teacher-1', 'exam-1', 'question-1', { label: 'B', position: 1, isCorrect: true }),
      ).rejects.toThrow(/already has a correct option/);
    });

    test('test_addOption_secondCorrectOptionOnCheckboxes_allowed', async () => {
      const { service, optionRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'CHECKBOXES', examId: 'exam-1' }],
      });
      optionRepo.find.mockResolvedValue([{ id: 'option-1', isCorrect: true }]);

      await service.addOption('teacher-1', 'exam-1', 'question-1', { label: 'B', position: 1, isCorrect: true });

      expect(optionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isCorrect: true }));
    });

    test('test_addOption_labelIsSanitized', async () => {
      const { service, optionRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'CHECKBOXES', examId: 'exam-1' }],
      });

      await service.addOption('teacher-1', 'exam-1', 'question-1', {
        label: '<img src=x onerror=alert(1)>Option A',
        position: 0,
      });

      expect(optionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ label: 'Option A' }));
    });
  });

  describe('questions', () => {
    test('test_addQuestion_promptIsSanitizedAndPointsDefaultToNull', async () => {
      const { service, questionRepo } = buildService();

      await service.addQuestion('teacher-1', 'exam-1', {
        questionType: 'SHORT_ANSWER',
        prompt: 'Explain <b>this</b>',
        position: 0,
      });

      expect(questionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'Explain this', points: null }),
      );
    });

    // Changing the type would strand options on a question that cannot have
    // them; rejecting is clearer than deleting the teacher's work silently.
    test('test_updateQuestion_typeChangeWithExistingOptions_rejected', async () => {
      const { service, optionRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', examId: 'exam-1' }],
      });
      optionRepo.count.mockResolvedValue(2);

      await expect(
        service.updateQuestion('teacher-1', 'exam-1', 'question-1', { questionType: 'PARAGRAPH' }),
      ).rejects.toThrow(/Remove the options/);
    });

    test('test_updateQuestion_questionOfAnotherExam_notFound', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'SHORT_ANSWER', examId: 'another-exam' }],
      });

      await expect(
        service.updateQuestion('teacher-1', 'exam-1', 'question-1', { prompt: 'x' }),
      ).rejects.toThrow(/not found for exam/);
    });
  });
});
