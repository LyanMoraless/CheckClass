import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import {
  ExamAnswerEntity,
  ExamAnswerSelectedOptionEntity,
  ExamQuestionEntity,
  ExamQuestionOptionEntity,
  ExamSessionEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ExamAccessService } from './exam-access.service';
import { isObjectiveQuestion } from './exam-vocabulary';

// RULE-EXAM-14's two grading paths, kept in one place because they share the
// same ceiling (exam_question.points) and the same "NULL points = the
// question carries no score at all" semantics:
//   - objective questions are graded by the server the moment the session
//     ends, against exam_question_option.is_correct;
//   - subjective questions wait for the teacher, who assigns a value up to
//     that same maximum.
//
// Nothing in this service is ever served to a student (RULE-EXAM-17) — the
// student-facing mappers in exam-student-view.ts do not have a field for any
// of it.
@Injectable()
export class ExamGradingService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly examAccess: ExamAccessService,
  ) {}

  // Called by ExamSessionService whenever a session ends, whatever ended it
  // (finished, expired, terminated, abandoned) — a terminated or expired
  // exam still keeps and grades the answers already synchronized
  // (RULE-EXAM-04's "preservar todas as respostas já sincronizadas").
  async gradeObjectiveAnswers(session: ExamSessionEntity): Promise<void> {
    const manager = this.tenantContext.getManager();

    const answers = await manager.getRepository(ExamAnswerEntity).find({ where: { examSessionId: session.id } });
    if (answers.length === 0) {
      return;
    }

    const questions = await manager.getRepository(ExamQuestionEntity).find({ where: { examId: session.examId } });
    const objectiveQuestions = questions.filter(
      (question) => isObjectiveQuestion(question.questionType) && question.points !== null,
    );
    if (objectiveQuestions.length === 0) {
      return;
    }

    const options = await manager.getRepository(ExamQuestionOptionEntity).find({
      where: { examQuestionId: In(objectiveQuestions.map((question) => question.id)) },
    });
    const selections = await manager.getRepository(ExamAnswerSelectedOptionEntity).find({
      where: { examAnswerId: In(answers.map((answer) => answer.id)) },
    });

    const answerRepository = manager.getRepository(ExamAnswerEntity);
    for (const question of objectiveQuestions) {
      const answer = answers.find((candidate) => candidate.examQuestionId === question.id);
      if (!answer) {
        // Unanswered, and every question is optional (confirmed
        // 2026-09-03) — no row to score, and no penalty beyond the points
        // simply not being earned.
        continue;
      }

      const correctIds = options
        .filter((option) => option.examQuestionId === question.id && option.isCorrect)
        .map((option) => option.id);
      const selectedIds = selections
        .filter((selection) => selection.examAnswerId === answer.id)
        .map((selection) => selection.examQuestionOptionId);

      answer.awardedPoints = this.matchesAnswerKey(correctIds, selectedIds) ? Number(question.points) : 0;
      await answerRepository.save(answer);
    }
  }

  // All-or-nothing, the same behavior as the Google Forms "modo Quiz"
  // RULE-EXAM-14 points at. Partial credit for a partially-correct CHECKBOXES
  // answer is NOT specified by the rule, so it is deliberately not invented
  // here.
  private matchesAnswerKey(correctIds: string[], selectedIds: string[]): boolean {
    if (correctIds.length === 0 || correctIds.length !== selectedIds.length) {
      return false;
    }
    const selected = new Set(selectedIds);
    return correctIds.every((id) => selected.has(id));
  }

  // Teacher-side manual grading of a subjective answer (RULE-EXAM-14).
  // Authorization is the module's single leadership-scope path, which also
  // opens the RLS management scope needed to see another person's answer row
  // at all.
  async gradeAnswer(input: {
    personId: string;
    examId: string;
    examSessionId: string;
    answerId: string;
    awardedPoints: number;
  }): Promise<ExamAnswerEntity> {
    await this.examAccess.authorizeExam(input.personId, input.examId);
    const manager = this.tenantContext.getManager();

    const session = await manager.getRepository(ExamSessionEntity).findOneBy({ id: input.examSessionId });
    if (!session || session.examId !== input.examId) {
      throw new NotFoundException(`exam_session ${input.examSessionId} not found for exam ${input.examId}`);
    }

    const answer = await manager.getRepository(ExamAnswerEntity).findOneBy({ id: input.answerId });
    if (!answer || answer.examSessionId !== session.id) {
      throw new NotFoundException(`exam_answer ${input.answerId} not found for session ${input.examSessionId}`);
    }

    const question = await manager.getRepository(ExamQuestionEntity).findOneBy({ id: answer.examQuestionId });
    if (!question) {
      throw new NotFoundException(`exam_question ${answer.examQuestionId} not found`);
    }
    if (isObjectiveQuestion(question.questionType)) {
      throw new BadRequestException(
        `Question ${question.id} is objective and is graded automatically against its answer key (RULE-EXAM-14)`,
      );
    }
    if (question.points === null) {
      throw new BadRequestException(`Question ${question.id} carries no score, so it cannot be graded`);
    }
    // numeric columns come back from the driver as strings — compare as
    // numbers, or "10" > "9" would silently pass.
    if (input.awardedPoints > Number(question.points)) {
      throw new BadRequestException(
        `awardedPoints ${input.awardedPoints} exceeds the ${question.points} points question ${question.id} is worth`,
      );
    }

    answer.awardedPoints = input.awardedPoints;
    return manager.getRepository(ExamAnswerEntity).save(answer);
  }
}
