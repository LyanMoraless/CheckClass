import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import {
  ExamEntity,
  ExamMonitoringConfigEntity,
  ExamMonitoringEventTypeEntity,
  ExamQuestionEntity,
  ExamQuestionOptionEntity,
  ExamSessionEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ExamAccessService } from './exam-access.service';
import { sanitizeExamText, sanitizeOptionalExamText } from './exam-content-sanitizer';
import {
  EXAM_STATUSES,
  isObjectiveQuestion,
  MonitorableEventType,
  MonitoringMode,
  QuestionType,
} from './exam-vocabulary';

const MIN_OBJECTIVE_OPTIONS = 2;

export interface CreateExamInput {
  classGroupId: string;
  title: string;
  description?: string | null;
  availableFrom: string;
  availableUntil: string;
  durationMinutes?: number | null;
  monitoringMode: MonitoringMode;
  monitoredEventTypes: MonitorableEventType[];
}

export interface UpdateExamInput {
  title?: string;
  description?: string | null;
  availableFrom?: string;
  availableUntil?: string;
  durationMinutes?: number | null;
}

export interface QuestionInput {
  questionType: QuestionType;
  prompt: string;
  position: number;
  points?: number | null;
}

export interface OptionInput {
  label: string;
  position: number;
  isCorrect?: boolean;
}

// The teacher's authoring side: the exam itself, its questions and options,
// its monitoring configuration (RULE-EXAM-13) and its publication.
//
// It carries the invariants the AddExamArea migration explicitly left to the
// application layer, because SQL could only express them with triggers the
// approved model does not justify:
//   - options exist only on objective questions;
//   - MULTIPLE_CHOICE has at most one correct option, CHECKBOXES may have
//     several;
//   - publishing needs at least one question, and at least two options on
//     every objective question;
//   - content and critical configuration freeze as soon as any student
//     session exists.
//
// Every method starts at ExamAccessService, which is both the RULE-EXAM-16
// authorization and what opens the RLS management scope — no method here
// reaches a row before that has happened.
@Injectable()
export class ExamAuthoringService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly examAccess: ExamAccessService,
  ) {}

  // Confirmed 2026-09-03: an exam is born DRAFT, with no publishedAt.
  // Setting an availability window does NOT expose it — publish() does.
  async create(personId: string, input: CreateExamInput): Promise<ExamEntity> {
    await this.examAccess.authorizeClassGroup(personId, input.classGroupId);

    const availableFrom = new Date(input.availableFrom);
    const availableUntil = new Date(input.availableUntil);
    this.assertWindow(availableFrom, availableUntil);

    const manager = this.tenantContext.getManager();
    const examRepository = manager.getRepository(ExamEntity);
    const exam = await examRepository.save(
      examRepository.create({
        tenantId: this.tenantContext.getTenantId(),
        classGroupId: input.classGroupId,
        // Authorship metadata only — authorization never derives from it
        // (RULE-EXAM-16 routes that through the class group).
        createdByPersonId: personId,
        title: sanitizeExamText(input.title),
        description: sanitizeOptionalExamText(input.description),
        status: EXAM_STATUSES[0],
        publishedAt: null,
        availableFrom,
        availableUntil,
        durationMinutes: input.durationMinutes ?? null,
      }),
    );

    // RULE-EXAM-13 makes the monitoring behavior an explicit choice, and the
    // session snapshot needs it to exist — so it is created with the exam,
    // never lazily.
    await this.writeMonitoringConfig(exam, input.monitoringMode, input.monitoredEventTypes);
    return exam;
  }

  async update(personId: string, examId: string, input: UpdateExamInput): Promise<ExamEntity> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);

    if (input.title !== undefined) {
      exam.title = sanitizeExamText(input.title);
    }
    if (input.description !== undefined) {
      exam.description = sanitizeOptionalExamText(input.description);
    }
    if (input.availableFrom !== undefined) {
      exam.availableFrom = new Date(input.availableFrom);
    }
    if (input.availableUntil !== undefined) {
      exam.availableUntil = new Date(input.availableUntil);
    }
    if (input.durationMinutes !== undefined) {
      exam.durationMinutes = input.durationMinutes;
    }
    this.assertWindow(new Date(exam.availableFrom), new Date(exam.availableUntil));

    return this.tenantContext.getManager().getRepository(ExamEntity).save(exam);
  }

  async listByClassGroup(personId: string, classGroupId: string): Promise<ExamEntity[]> {
    await this.examAccess.authorizeClassGroup(personId, classGroupId);
    return this.tenantContext.getManager().getRepository(ExamEntity).find({
      where: { classGroupId },
      order: { availableFrom: 'ASC' },
    });
  }

  // Hard delete, and only while the exam has no history: once a student has
  // a session, the exam is graded material and its audit trail (which cannot
  // be deleted at all — see the append-only trigger) must keep referring to
  // something.
  async remove(personId: string, examId: string): Promise<void> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);
    const manager = this.tenantContext.getManager();

    const questions = await manager.getRepository(ExamQuestionEntity).find({ where: { examId } });
    if (questions.length > 0) {
      await manager.getRepository(ExamQuestionOptionEntity).delete({
        examQuestionId: In(questions.map((question) => question.id)),
      });
      await manager.getRepository(ExamQuestionEntity).delete({ examId });
    }

    const config = await manager.getRepository(ExamMonitoringConfigEntity).findOneBy({ examId });
    if (config) {
      await manager.getRepository(ExamMonitoringEventTypeEntity).delete({ examMonitoringConfigId: config.id });
      await manager.getRepository(ExamMonitoringConfigEntity).delete({ id: config.id });
    }

    await manager.getRepository(ExamEntity).delete({ id: examId });
  }

  // The single act that makes an exam visible to students. Everything it
  // validates is unrecoverable-if-wrong: a student who opens a half-built
  // exam has already burned their one attempt.
  async publish(personId: string, examId: string): Promise<ExamEntity> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    if (exam.status === EXAM_STATUSES[1]) {
      throw new ConflictException(`exam ${examId} is already published`);
    }

    const manager = this.tenantContext.getManager();
    const questions = await manager.getRepository(ExamQuestionEntity).find({ where: { examId } });
    if (questions.length === 0) {
      throw new BadRequestException(`exam ${examId} has no questions and cannot be published`);
    }

    const objectiveQuestions = questions.filter((question) => isObjectiveQuestion(question.questionType));
    if (objectiveQuestions.length > 0) {
      const options = await manager.getRepository(ExamQuestionOptionEntity).find({
        where: { examQuestionId: In(objectiveQuestions.map((question) => question.id)) },
      });
      for (const question of objectiveQuestions) {
        this.assertPublishableObjectiveQuestion(
          question,
          options.filter((option) => option.examQuestionId === question.id),
        );
      }
    }

    if (!(await manager.getRepository(ExamMonitoringConfigEntity).findOneBy({ examId }))) {
      throw new BadRequestException(`exam ${examId} has no monitoring configuration (RULE-EXAM-13)`);
    }

    exam.status = EXAM_STATUSES[1];
    // Kept in lockstep with status by a CHECK constraint — publishing
    // without a timestamp would be a silent audit gap on graded material.
    exam.publishedAt = new Date();
    return manager.getRepository(ExamEntity).save(exam);
  }

  async addQuestion(personId: string, examId: string, input: QuestionInput): Promise<ExamQuestionEntity> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);

    const repository = this.tenantContext.getManager().getRepository(ExamQuestionEntity);
    return repository.save(
      repository.create({
        tenantId: this.tenantContext.getTenantId(),
        examId,
        questionType: input.questionType,
        prompt: sanitizeExamText(input.prompt),
        position: input.position,
        // NULL = the question carries no score at all, which is what makes
        // RULE-EXAM-14's "exam with no answer key behaves like a plain form"
        // possible.
        points: input.points ?? null,
      }),
    );
  }

  async updateQuestion(
    personId: string,
    examId: string,
    questionId: string,
    input: Partial<QuestionInput>,
  ): Promise<ExamQuestionEntity> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);
    const question = await this.requireQuestion(examId, questionId);

    if (input.questionType !== undefined && input.questionType !== question.questionType) {
      // Changing the type would leave options attached to a subjective
      // question (or a MULTIPLE_CHOICE with several correct options) —
      // rejecting is clearer than silently deleting the teacher's work.
      const optionCount = await this.tenantContext
        .getManager()
        .getRepository(ExamQuestionOptionEntity)
        .count({ where: { examQuestionId: questionId } });
      if (optionCount > 0) {
        throw new BadRequestException(`Remove the options of question ${questionId} before changing its type`);
      }
      question.questionType = input.questionType;
    }
    if (input.prompt !== undefined) {
      question.prompt = sanitizeExamText(input.prompt);
    }
    if (input.position !== undefined) {
      question.position = input.position;
    }
    if (input.points !== undefined) {
      question.points = input.points;
    }

    return this.tenantContext.getManager().getRepository(ExamQuestionEntity).save(question);
  }

  async removeQuestion(personId: string, examId: string, questionId: string): Promise<void> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);
    await this.requireQuestion(examId, questionId);

    const manager = this.tenantContext.getManager();
    await manager.getRepository(ExamQuestionOptionEntity).delete({ examQuestionId: questionId });
    await manager.getRepository(ExamQuestionEntity).delete({ id: questionId });
  }

  async addOption(
    personId: string,
    examId: string,
    questionId: string,
    input: OptionInput,
  ): Promise<ExamQuestionOptionEntity> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);
    const question = await this.requireObjectiveQuestion(examId, questionId);

    if (input.isCorrect) {
      await this.assertSingleCorrectAllowed(question, null);
    }

    const repository = this.tenantContext.getManager().getRepository(ExamQuestionOptionEntity);
    return repository.save(
      repository.create({
        tenantId: this.tenantContext.getTenantId(),
        examQuestionId: questionId,
        label: sanitizeExamText(input.label),
        position: input.position,
        isCorrect: input.isCorrect ?? false,
      }),
    );
  }

  async updateOption(
    personId: string,
    examId: string,
    questionId: string,
    optionId: string,
    input: Partial<OptionInput>,
  ): Promise<ExamQuestionOptionEntity> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);
    const question = await this.requireObjectiveQuestion(examId, questionId);

    const repository = this.tenantContext.getManager().getRepository(ExamQuestionOptionEntity);
    const option = await repository.findOneBy({ id: optionId });
    if (!option || option.examQuestionId !== questionId) {
      throw new NotFoundException(`exam_question_option ${optionId} not found for question ${questionId}`);
    }

    if (input.isCorrect === true && !option.isCorrect) {
      await this.assertSingleCorrectAllowed(question, optionId);
    }
    if (input.label !== undefined) {
      option.label = sanitizeExamText(input.label);
    }
    if (input.position !== undefined) {
      option.position = input.position;
    }
    if (input.isCorrect !== undefined) {
      option.isCorrect = input.isCorrect;
    }

    return repository.save(option);
  }

  async removeOption(personId: string, examId: string, questionId: string, optionId: string): Promise<void> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);
    await this.requireObjectiveQuestion(examId, questionId);

    await this.tenantContext.getManager().getRepository(ExamQuestionOptionEntity).delete({ id: optionId });
  }

  // RULE-EXAM-13's monitoring block, replaced wholesale rather than patched:
  // the enabled-type list is a set, and "these are the types now" is what the
  // checkbox screen actually sends.
  async setMonitoringConfig(
    personId: string,
    examId: string,
    monitoringMode: MonitoringMode,
    monitoredEventTypes: MonitorableEventType[],
  ): Promise<ExamMonitoringConfigEntity> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    await this.assertEditable(exam);
    return this.writeMonitoringConfig(exam, monitoringMode, monitoredEventTypes);
  }

  private async writeMonitoringConfig(
    exam: ExamEntity,
    monitoringMode: MonitoringMode,
    monitoredEventTypes: MonitorableEventType[],
  ): Promise<ExamMonitoringConfigEntity> {
    const manager = this.tenantContext.getManager();
    const configRepository = manager.getRepository(ExamMonitoringConfigEntity);
    const eventTypeRepository = manager.getRepository(ExamMonitoringEventTypeEntity);

    const existing = await configRepository.findOneBy({ examId: exam.id });
    const config = await configRepository.save(
      configRepository.create({
        ...(existing ?? {}),
        tenantId: this.tenantContext.getTenantId(),
        examId: exam.id,
        monitoringMode,
      }),
    );

    await eventTypeRepository.delete({ examMonitoringConfigId: config.id });
    const uniqueTypes = [...new Set(monitoredEventTypes)];
    if (uniqueTypes.length > 0) {
      await eventTypeRepository.save(
        uniqueTypes.map((eventType) =>
          eventTypeRepository.create({
            tenantId: this.tenantContext.getTenantId(),
            examMonitoringConfigId: config.id,
            eventType,
          }),
        ),
      );
    }
    return config;
  }

  // The freeze recorded as an approved assumption: once ANY student session
  // exists, content and critical configuration are locked. Changing the
  // duration or the questions under someone who is mid-exam (or has already
  // been graded) would rewrite the terms of a run that already happened —
  // and the session snapshot only protects runs already started, not the
  // fairness of the exam as a whole.
  private async assertEditable(exam: ExamEntity): Promise<void> {
    const sessionCount = await this.tenantContext
      .getManager()
      .getRepository(ExamSessionEntity)
      .count({ where: { examId: exam.id } });

    if (sessionCount > 0) {
      throw new ConflictException(
        `exam ${exam.id} already has student sessions and can no longer have its content or configuration changed`,
      );
    }
  }

  private assertWindow(availableFrom: Date, availableUntil: Date): void {
    if (availableUntil <= availableFrom) {
      throw new BadRequestException('availableUntil must be after availableFrom (RULE-EXAM-06)');
    }
  }

  // RULE-EXAM-03: "múltipla escolha (uma resposta correta possível)". At
  // MOST one, not exactly one — RULE-EXAM-14 makes the answer key optional,
  // so zero correct options is a legitimate "this question is not graded
  // automatically" state. CHECKBOXES may have several by definition.
  private async assertSingleCorrectAllowed(question: ExamQuestionEntity, ignoreOptionId: string | null): Promise<void> {
    if (question.questionType !== 'MULTIPLE_CHOICE') {
      return;
    }

    const options = await this.tenantContext
      .getManager()
      .getRepository(ExamQuestionOptionEntity)
      .find({ where: { examQuestionId: question.id, isCorrect: true } });

    if (options.some((option) => option.id !== ignoreOptionId)) {
      throw new BadRequestException(
        `Question ${question.id} is MULTIPLE_CHOICE and already has a correct option (RULE-EXAM-03)`,
      );
    }
  }

  private assertPublishableObjectiveQuestion(
    question: ExamQuestionEntity,
    options: ExamQuestionOptionEntity[],
  ): void {
    if (options.length < MIN_OBJECTIVE_OPTIONS) {
      throw new BadRequestException(
        `Question ${question.id} is objective and needs at least ${MIN_OBJECTIVE_OPTIONS} options to be published`,
      );
    }

    // Only a SCORED question needs an answer key: RULE-EXAM-14 explicitly
    // allows an exam with no key at all, which then behaves as a plain form.
    // But a question worth points with nothing marked correct could never be
    // graded automatically nor manually (it is objective), so it would
    // silently score zero for everyone — that one is a mistake, not a
    // choice.
    if (question.points === null) {
      return;
    }
    const correctCount = options.filter((option) => option.isCorrect).length;
    if (correctCount === 0) {
      throw new BadRequestException(
        `Question ${question.id} is worth points but has no correct option marked (RULE-EXAM-14)`,
      );
    }
    if (question.questionType === 'MULTIPLE_CHOICE' && correctCount > 1) {
      throw new BadRequestException(`Question ${question.id} is MULTIPLE_CHOICE and has more than one correct option`);
    }
  }

  private async requireQuestion(examId: string, questionId: string): Promise<ExamQuestionEntity> {
    const question = await this.tenantContext
      .getManager()
      .getRepository(ExamQuestionEntity)
      .findOneBy({ id: questionId });

    if (!question || question.examId !== examId) {
      throw new NotFoundException(`exam_question ${questionId} not found for exam ${examId}`);
    }
    return question;
  }

  // The migration's first application-layer invariant: options exist only on
  // MULTIPLE_CHOICE/CHECKBOXES.
  private async requireObjectiveQuestion(examId: string, questionId: string): Promise<ExamQuestionEntity> {
    const question = await this.requireQuestion(examId, questionId);
    if (!isObjectiveQuestion(question.questionType)) {
      throw new BadRequestException(
        `Question ${questionId} is ${question.questionType} and cannot have options (RULE-EXAM-03)`,
      );
    }
    return question;
  }
}
