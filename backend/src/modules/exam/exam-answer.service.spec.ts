import {
  ExamAnswerEntity,
  ExamAnswerSelectedOptionEntity,
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
import { ExamAnswerService } from './exam-answer.service';

// Incremental autosave (RULE-EXAM-07 revalidates the deadline on every save)
// and the answer-side invariants the migration left to the application:
// options only on objective questions, at most one on MULTIPLE_CHOICE, and
// options that really belong to the question being answered.
describe('ExamAnswerService', () => {
  const session = {
    id: 'session-1',
    examId: 'exam-1',
    personId: 'student-1',
    status: 'IN_PROGRESS',
  } as ExamSessionEntity;

  function buildService(options: {
    question?: Partial<ExamQuestionEntity> | null;
    existingAnswer?: Partial<ExamAnswerEntity> | null;
    knownOptions?: Partial<ExamQuestionOptionEntity>[];
  } = {}) {
    const question =
      options.question === undefined
        ? ({ id: 'question-1', examId: 'exam-1', questionType: 'PARAGRAPH' } as ExamQuestionEntity)
        : (options.question as ExamQuestionEntity | null);

    const questionRepo: MockRepository = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(question) });
    const optionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(options.knownOptions ?? []),
    });
    const answerRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.existingAnswer ?? null),
      save: jest.fn().mockImplementation(async (entity: ExamAnswerEntity) => ({ ...entity, id: entity.id ?? 'answer-1' })),
    });
    const selectionRepo: MockRepository = createMockRepository();

    const manager = createMockEntityManager(
      new Map([
        [ExamQuestionEntity, questionRepo],
        [ExamQuestionOptionEntity, optionRepo],
        [ExamAnswerEntity, answerRepo],
        [ExamAnswerSelectedOptionEntity, selectionRepo],
      ]),
    );

    const sessions = {
      requireActiveSession: jest.fn().mockResolvedValue({ exam: { id: 'exam-1' }, session }),
    };
    const service = new ExamAnswerService(createMockTenantContext(manager) as never, sessions as never);

    return { service, answerRepo, selectionRepo, sessions };
  }

  test('test_saveAnswer_writtenAnswer_sanitizedAndOwnedBySessionPerson', async () => {
    const { service, answerRepo } = buildService();

    await service.saveAnswer('student-1', 'exam-1', 'question-1', { answerText: 'My <b>answer</b>' });

    expect(answerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ answerText: 'My answer', personId: 'student-1', examSessionId: 'session-1' }),
    );
  });

  // Blank is a valid answer (confirmed 2026-09-03) and is normalized to NULL
  // so that "answered with nothing" and "not answered" are one state.
  test('test_saveAnswer_blankText_storedAsNull', async () => {
    const { service, answerRepo } = buildService();

    await service.saveAnswer('student-1', 'exam-1', 'question-1', { answerText: '   ' });

    expect(answerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ answerText: null }));
  });

  // RULE-EXAM-07: every write revalidates the session first, so an expired
  // session cannot accept one more answer.
  test('test_saveAnswer_inactiveSession_rejectedBeforeWriting', async () => {
    const { service, answerRepo, sessions } = buildService();
    sessions.requireActiveSession.mockRejectedValue(new Error('session is EXPIRED'));

    await expect(service.saveAnswer('student-1', 'exam-1', 'question-1', { answerText: 'x' })).rejects.toThrow(
      /EXPIRED/,
    );
    expect(answerRepo.save).not.toHaveBeenCalled();
  });

  test('test_saveAnswer_questionOfAnotherExam_notFound', async () => {
    const { service } = buildService({
      question: { id: 'question-1', examId: 'another-exam', questionType: 'PARAGRAPH' },
    });

    await expect(service.saveAnswer('student-1', 'exam-1', 'question-1', {})).rejects.toThrow(/not found for exam/);
  });

  test('test_saveAnswer_optionsOnSubjectiveQuestion_rejected', async () => {
    const { service } = buildService();

    await expect(
      service.saveAnswer('student-1', 'exam-1', 'question-1', { selectedOptionIds: ['option-1'] }),
    ).rejects.toThrow(/takes no selected options/);
  });

  test('test_saveAnswer_twoOptionsOnMultipleChoice_rejected', async () => {
    const { service } = buildService({
      question: { id: 'question-1', examId: 'exam-1', questionType: 'MULTIPLE_CHOICE' },
    });

    await expect(
      service.saveAnswer('student-1', 'exam-1', 'question-1', { selectedOptionIds: ['option-1', 'option-2'] }),
    ).rejects.toThrow(/at most one option/);
  });

  // A client must not be able to attach an arbitrary option row (possibly of
  // another question, or of another exam) to its answer.
  test('test_saveAnswer_optionNotBelongingToQuestion_rejected', async () => {
    const { service } = buildService({
      question: { id: 'question-1', examId: 'exam-1', questionType: 'CHECKBOXES' },
      knownOptions: [],
    });

    await expect(
      service.saveAnswer('student-1', 'exam-1', 'question-1', { selectedOptionIds: ['option-from-elsewhere'] }),
    ).rejects.toThrow(/do not belong to question/);
  });

  // Autosave sends the full current selection, so the stored set mirrors it
  // — including the student unchecking everything.
  test('test_saveAnswer_replacesPreviousSelection', async () => {
    const { service, selectionRepo } = buildService({
      question: { id: 'question-1', examId: 'exam-1', questionType: 'CHECKBOXES' },
      knownOptions: [{ id: 'option-1' }, { id: 'option-2' }],
    });

    await service.saveAnswer('student-1', 'exam-1', 'question-1', { selectedOptionIds: ['option-1', 'option-2'] });

    expect(selectionRepo.delete).toHaveBeenCalledWith({ examAnswerId: 'answer-1' });
    expect(selectionRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ examQuestionOptionId: 'option-1', personId: 'student-1' }),
      expect.objectContaining({ examQuestionOptionId: 'option-2', personId: 'student-1' }),
    ]);
  });

  test('test_saveAnswer_emptySelection_clearsWithoutReinserting', async () => {
    const { service, selectionRepo } = buildService({
      question: { id: 'question-1', examId: 'exam-1', questionType: 'CHECKBOXES' },
    });

    await service.saveAnswer('student-1', 'exam-1', 'question-1', { selectedOptionIds: [] });

    expect(selectionRepo.delete).toHaveBeenCalled();
    expect(selectionRepo.save).not.toHaveBeenCalled();
  });

  // The UNIQUE (session, question) constraint is what makes autosave an
  // upsert rather than an append.
  test('test_saveAnswer_existingAnswer_updatedInPlace', async () => {
    const { service, answerRepo } = buildService({
      existingAnswer: { id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1', answerText: 'old' },
    });

    await service.saveAnswer('student-1', 'exam-1', 'question-1', { answerText: 'new' });

    expect(answerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'answer-1', answerText: 'new' }));
  });
});
