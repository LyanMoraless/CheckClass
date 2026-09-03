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
import { ExamGradingService } from './exam-grading.service';

// RULE-EXAM-14's two paths: automatic for the objective types, manual for the
// subjective ones, both bounded by the question's own `points`.
describe('ExamGradingService', () => {
  const session = { id: 'session-1', examId: 'exam-1', personId: 'student-1' } as ExamSessionEntity;

  function buildService(options: {
    questions?: Partial<ExamQuestionEntity>[];
    options?: Partial<ExamQuestionOptionEntity>[];
    answers?: Partial<ExamAnswerEntity>[];
    selections?: Partial<ExamAnswerSelectedOptionEntity>[];
    session?: ExamSessionEntity | null;
  } = {}) {
    const questions = (options.questions ?? []) as ExamQuestionEntity[];
    const answers = (options.answers ?? []) as ExamAnswerEntity[];

    const questionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(questions),
      findOneBy: jest.fn().mockImplementation(async ({ id }: { id: string }) => questions.find((q) => q.id === id) ?? null),
    });
    const optionRepo: MockRepository = createMockRepository({ find: jest.fn().mockResolvedValue(options.options ?? []) });
    const answerRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(answers),
      findOneBy: jest.fn().mockImplementation(async ({ id }: { id: string }) => answers.find((a) => a.id === id) ?? null),
    });
    const selectionRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue(options.selections ?? []),
    });
    const sessionRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.session === undefined ? session : options.session),
    });

    const manager = createMockEntityManager(
      new Map([
        [ExamQuestionEntity, questionRepo],
        [ExamQuestionOptionEntity, optionRepo],
        [ExamAnswerEntity, answerRepo],
        [ExamAnswerSelectedOptionEntity, selectionRepo],
        [ExamSessionEntity, sessionRepo],
      ]),
    );

    const examAccess = { authorizeExam: jest.fn().mockResolvedValue({ id: 'exam-1' }) };
    const service = new ExamGradingService(createMockTenantContext(manager) as never, examAccess as never);

    return { service, answerRepo, examAccess };
  }

  describe('gradeObjectiveAnswers', () => {
    const multipleChoice = { id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: 10 };
    const optionsOfQuestion = [
      { id: 'option-1', examQuestionId: 'question-1', isCorrect: true },
      { id: 'option-2', examQuestionId: 'question-1', isCorrect: false },
    ];

    test('test_gradeObjectiveAnswers_correctSelection_awardsFullPoints', async () => {
      const { service, answerRepo } = buildService({
        questions: [multipleChoice],
        options: optionsOfQuestion,
        answers: [{ id: 'answer-1', examQuestionId: 'question-1' }],
        selections: [{ examAnswerId: 'answer-1', examQuestionOptionId: 'option-1' }],
      });

      await service.gradeObjectiveAnswers(session);

      expect(answerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ awardedPoints: 10 }));
    });

    test('test_gradeObjectiveAnswers_wrongSelection_awardsZero', async () => {
      const { service, answerRepo } = buildService({
        questions: [multipleChoice],
        options: optionsOfQuestion,
        answers: [{ id: 'answer-1', examQuestionId: 'question-1' }],
        selections: [{ examAnswerId: 'answer-1', examQuestionOptionId: 'option-2' }],
      });

      await service.gradeObjectiveAnswers(session);

      expect(answerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ awardedPoints: 0 }));
    });

    // All-or-nothing, the Google Forms quiz behavior RULE-EXAM-14 points at.
    // Partial credit is not specified by the rule and is deliberately not
    // invented.
    test('test_gradeObjectiveAnswers_partiallyCorrectCheckboxes_awardsZero', async () => {
      const { service, answerRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'CHECKBOXES', points: 10 }],
        options: [
          { id: 'option-1', examQuestionId: 'question-1', isCorrect: true },
          { id: 'option-2', examQuestionId: 'question-1', isCorrect: true },
        ],
        answers: [{ id: 'answer-1', examQuestionId: 'question-1' }],
        selections: [{ examAnswerId: 'answer-1', examQuestionOptionId: 'option-1' }],
      });

      await service.gradeObjectiveAnswers(session);

      expect(answerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ awardedPoints: 0 }));
    });

    test('test_gradeObjectiveAnswers_allCorrectCheckboxes_awardsFullPoints', async () => {
      const { service, answerRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'CHECKBOXES', points: 10 }],
        options: [
          { id: 'option-1', examQuestionId: 'question-1', isCorrect: true },
          { id: 'option-2', examQuestionId: 'question-1', isCorrect: true },
        ],
        answers: [{ id: 'answer-1', examQuestionId: 'question-1' }],
        selections: [
          { examAnswerId: 'answer-1', examQuestionOptionId: 'option-1' },
          { examAnswerId: 'answer-1', examQuestionOptionId: 'option-2' },
        ],
      });

      await service.gradeObjectiveAnswers(session);

      expect(answerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ awardedPoints: 10 }));
    });

    // RULE-EXAM-14: an exam with no answer key behaves as a plain form —
    // NULL points means the question carries no score at all.
    test('test_gradeObjectiveAnswers_unscoredQuestion_leavesAnswerUngraded', async () => {
      const { service, answerRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: null }],
        options: optionsOfQuestion,
        answers: [{ id: 'answer-1', examQuestionId: 'question-1' }],
        selections: [{ examAnswerId: 'answer-1', examQuestionOptionId: 'option-1' }],
      });

      await service.gradeObjectiveAnswers(session);

      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    // Subjective answers wait for the teacher — the automatic pass must not
    // zero them out.
    test('test_gradeObjectiveAnswers_subjectiveQuestion_untouched', async () => {
      const { service, answerRepo } = buildService({
        questions: [{ id: 'question-1', questionType: 'PARAGRAPH', points: 10 }],
        answers: [{ id: 'answer-1', examQuestionId: 'question-1', answerText: 'my essay' }],
      });

      await service.gradeObjectiveAnswers(session);

      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    // Every question is optional (confirmed 2026-09-03): a question with no
    // answer row is simply not scored, never an error.
    test('test_gradeObjectiveAnswers_unansweredQuestion_skipped', async () => {
      const { service, answerRepo } = buildService({
        questions: [multipleChoice, { id: 'question-2', questionType: 'MULTIPLE_CHOICE', points: 5 }],
        options: optionsOfQuestion,
        answers: [{ id: 'answer-1', examQuestionId: 'question-1' }],
        selections: [{ examAnswerId: 'answer-1', examQuestionOptionId: 'option-1' }],
      });

      await service.gradeObjectiveAnswers(session);

      expect(answerRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('gradeAnswer', () => {
    const gradeInput = {
      personId: 'teacher-1',
      examId: 'exam-1',
      examSessionId: 'session-1',
      answerId: 'answer-1',
      awardedPoints: 7,
    };

    test('test_gradeAnswer_subjectiveAnswerWithinMaximum_saved', async () => {
      const { service, answerRepo, examAccess } = buildService({
        questions: [{ id: 'question-1', questionType: 'PARAGRAPH', points: 10 }],
        answers: [{ id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1' }],
      });

      await service.gradeAnswer(gradeInput);

      expect(examAccess.authorizeExam).toHaveBeenCalledWith('teacher-1', 'exam-1');
      expect(answerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ awardedPoints: 7 }));
    });

    test('test_gradeAnswer_objectiveQuestion_rejected', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'MULTIPLE_CHOICE', points: 10 }],
        answers: [{ id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1' }],
      });

      await expect(service.gradeAnswer(gradeInput)).rejects.toThrow(/graded automatically/);
    });

    test('test_gradeAnswer_aboveQuestionMaximum_rejected', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'PARAGRAPH', points: 5 }],
        answers: [{ id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1' }],
      });

      await expect(service.gradeAnswer(gradeInput)).rejects.toThrow(/exceeds/);
    });

    test('test_gradeAnswer_unscoredQuestion_rejected', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'PARAGRAPH', points: null }],
        answers: [{ id: 'answer-1', examSessionId: 'session-1', examQuestionId: 'question-1' }],
      });

      await expect(service.gradeAnswer(gradeInput)).rejects.toThrow(/carries no score/);
    });

    // The session must belong to the exam the caller was authorized for —
    // otherwise an authorized teacher of exam A could grade exam B.
    test('test_gradeAnswer_sessionOfAnotherExam_notFound', async () => {
      const { service } = buildService({
        session: { id: 'session-1', examId: 'another-exam', personId: 'student-1' } as ExamSessionEntity,
      });

      await expect(service.gradeAnswer(gradeInput)).rejects.toThrow(/not found for exam/);
    });

    test('test_gradeAnswer_answerOfAnotherSession_notFound', async () => {
      const { service } = buildService({
        questions: [{ id: 'question-1', questionType: 'PARAGRAPH', points: 10 }],
        answers: [{ id: 'answer-1', examSessionId: 'another-session', examQuestionId: 'question-1' }],
      });

      await expect(service.gradeAnswer(gradeInput)).rejects.toThrow(/not found for session/);
    });
  });
});
