import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import {
  ExamAnswerEntity,
  ExamAnswerSelectedOptionEntity,
  ExamQuestionEntity,
  ExamQuestionOptionEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { sanitizeOptionalExamText } from './exam-content-sanitizer';
import { ExamSessionService } from './exam-session.service';
import { isObjectiveQuestion } from './exam-vocabulary';

export interface SaveAnswerInput {
  answerText?: string | null;
  selectedOptionIds?: string[];
}

export interface StoredAnswer {
  examQuestionId: string;
  answerText: string | null;
  selectedOptionIds: string[];
  updatedAt: Date;
}

// The student's answer writes (incremental autosave, which is what the
// UNIQUE (exam_session_id, exam_question_id) constraint exists for) and the
// reads that feed their own screen back to them.
//
// Kept apart from ExamSessionService on purpose: this service writes
// ANSWERS, never session STATE. It asks ExamSessionService whether the
// session is still active and stops there — which is also where expiry gets
// revalidated on every autosave (RULE-EXAM-07).
@Injectable()
export class ExamAnswerService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly sessions: ExamSessionService,
  ) {}

  async saveAnswer(
    personId: string,
    examId: string,
    examQuestionId: string,
    input: SaveAnswerInput,
  ): Promise<StoredAnswer> {
    const { session } = await this.sessions.requireActiveSession(personId, examId);
    const manager = this.tenantContext.getManager();

    const question = await manager.getRepository(ExamQuestionEntity).findOneBy({ id: examQuestionId });
    if (!question || question.examId !== examId) {
      throw new NotFoundException(`exam_question ${examQuestionId} not found for exam ${examId}`);
    }

    const selectedOptionIds = await this.validatedSelection(question, input.selectedOptionIds ?? []);
    // A blank answer is a legitimate answer (confirmed 2026-09-03), so this
    // never rejects emptiness — it only normalizes it to NULL.
    const answerText = isObjectiveQuestion(question.questionType) ? null : sanitizeOptionalExamText(input.answerText);

    const answerRepository = manager.getRepository(ExamAnswerEntity);
    const existing = await answerRepository.findOneBy({ examSessionId: session.id, examQuestionId });

    const answer = await answerRepository.save(
      answerRepository.create({
        ...(existing ?? {}),
        tenantId: this.tenantContext.getTenantId(),
        examSessionId: session.id,
        // Denormalized owner, and the RLS ownership key — always the
        // session's own person, never anything from the request body.
        personId: session.personId,
        examQuestionId,
        answerText,
      }),
    );

    await this.replaceSelection(answer, selectedOptionIds, session.personId);

    return {
      examQuestionId,
      answerText,
      selectedOptionIds,
      updatedAt: answer.updatedAt ?? new Date(),
    };
  }

  async listAnswers(examSessionId: string): Promise<StoredAnswer[]> {
    const manager = this.tenantContext.getManager();

    const answers = await manager.getRepository(ExamAnswerEntity).find({ where: { examSessionId } });
    if (answers.length === 0) {
      return [];
    }

    const selections = await manager.getRepository(ExamAnswerSelectedOptionEntity).find({
      where: { examAnswerId: In(answers.map((answer) => answer.id)) },
    });

    return answers.map((answer) => ({
      examQuestionId: answer.examQuestionId,
      answerText: answer.answerText,
      selectedOptionIds: selections
        .filter((selection) => selection.examAnswerId === answer.id)
        .map((selection) => selection.examQuestionOptionId),
      updatedAt: answer.updatedAt,
    }));
  }

  // The answer-side half of the "options only exist on objective questions"
  // invariant the migration left to this layer, plus RULE-EXAM-03's
  // "múltipla escolha (uma resposta correta possível)" applied to the
  // student's side: at most one option checked. At most, not exactly one —
  // leaving it blank is allowed.
  private async validatedSelection(question: ExamQuestionEntity, selectedOptionIds: string[]): Promise<string[]> {
    const unique = [...new Set(selectedOptionIds)];

    if (!isObjectiveQuestion(question.questionType)) {
      if (unique.length > 0) {
        throw new BadRequestException(`Question ${question.id} is not objective and takes no selected options`);
      }
      return [];
    }

    if (question.questionType === 'MULTIPLE_CHOICE' && unique.length > 1) {
      throw new BadRequestException(`Question ${question.id} is MULTIPLE_CHOICE and accepts at most one option`);
    }
    if (unique.length === 0) {
      return [];
    }

    const options = await this.tenantContext.getManager().getRepository(ExamQuestionOptionEntity).find({
      where: { id: In(unique), examQuestionId: question.id },
    });
    if (options.length !== unique.length) {
      // Covers both a made-up id and an id belonging to another question —
      // the client must not be able to attach an arbitrary option row to an
      // answer.
      throw new BadRequestException(`One or more selected options do not belong to question ${question.id}`);
    }
    return unique;
  }

  // Replace rather than merge: autosave sends the full current selection of
  // that question every time, so the stored set must mirror it exactly —
  // including "the student unchecked everything".
  private async replaceSelection(answer: ExamAnswerEntity, optionIds: string[], personId: string): Promise<void> {
    const repository = this.tenantContext.getManager().getRepository(ExamAnswerSelectedOptionEntity);

    await repository.delete({ examAnswerId: answer.id });
    if (optionIds.length === 0) {
      return;
    }

    await repository.save(
      optionIds.map((optionId) =>
        repository.create({
          tenantId: this.tenantContext.getTenantId(),
          examAnswerId: answer.id,
          personId,
          examQuestionOptionId: optionId,
        }),
      ),
    );
  }
}
