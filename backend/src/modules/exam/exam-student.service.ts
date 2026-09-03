import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { ExamEntity, ExamQuestionEntity, ExamQuestionOptionEntity, ExamSessionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ExamAnswerService } from './exam-answer.service';
import { ExamAvailabilityService } from './exam-availability.service';
import { ExamSessionService } from './exam-session.service';
import {
  StudentAnswerView,
  StudentExamSummary,
  StudentQuestionView,
  StudentSessionView,
  toStudentAnswerViews,
  toStudentExamSummary,
  toStudentQuestionViews,
  toStudentSessionView,
} from './exam-student-view';
import { EXAM_STATUSES } from './exam-vocabulary';

export interface StudentSessionPayload {
  session: StudentSessionView;
  questions: StudentQuestionView[];
  answers: StudentAnswerView[];
}

// Read model of the student's side. It owns no rules: eligibility comes from
// ExamAvailabilityService, state from ExamSessionService, and every payload
// is built by the allow-list mappers in exam-student-view.ts (RULE-EXAM-17).
// Its whole job is assembling those into the three payloads the student's
// screens need, so the controller stays a routing layer.
@Injectable()
export class ExamStudentService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly availability: ExamAvailabilityService,
    private readonly sessions: ExamSessionService,
    private readonly answers: ExamAnswerService,
  ) {}

  async listMyExams(personId: string): Promise<StudentExamSummary[]> {
    await this.availability.assertExamAreaEnabled();
    const now = new Date();

    const classGroupIds = await this.availability.activeEnrollmentClassGroupIds(personId);
    if (classGroupIds.length === 0) {
      return [];
    }

    const exams = await this.tenantContext.getManager().getRepository(ExamEntity).find({
      // Confirmed 2026-09-03: a DRAFT exam does not exist for a student, no
      // matter what its availability window says.
      where: { classGroupId: In(classGroupIds), status: EXAM_STATUSES[1] },
      order: { availableFrom: 'ASC' },
    });

    const summaries: StudentExamSummary[] = [];
    for (const exam of exams) {
      // One lookup per exam rather than one batched query: it also REFRESHES
      // each session, which is where a window that closed while the student
      // was away becomes ABANDONED (no scheduler exists to do it, see
      // ExamSessionService). A student's published exam list is small enough
      // that the extra round trips are not worth losing that.
      const session = await this.sessions.findRefreshedSession(personId, exam.id, exam);
      summaries.push(toStudentExamSummary(exam, this.availability.windowState(exam, now), session));
    }
    return summaries;
  }

  async startSession(personId: string, examId: string): Promise<StudentSessionPayload> {
    const { exam, session } = await this.sessions.startOrResume(personId, examId);
    return this.payload(exam, session);
  }

  // RULE-EXAM-11's recovery path: same session, same absolute expiresAt,
  // never a new exam period. The reload EVENT itself is reported separately
  // by the browser to the monitoring endpoint — this is only the recovery.
  async getMySession(personId: string, examId: string): Promise<StudentSessionPayload> {
    const exam = await this.requireExam(examId);
    await this.availability.assertStudentVisibility(personId, exam);

    const session = await this.sessions.findRefreshedSession(personId, examId, exam);
    if (!session) {
      throw new NotFoundException(`You have no session for exam ${examId}`);
    }
    return this.payload(exam, session);
  }

  async finish(personId: string, examId: string): Promise<StudentSessionView> {
    return toStudentSessionView(await this.sessions.finish(personId, examId));
  }

  private async payload(exam: ExamEntity, session: ExamSessionEntity): Promise<StudentSessionPayload> {
    const manager = this.tenantContext.getManager();

    const questions = await manager.getRepository(ExamQuestionEntity).find({ where: { examId: exam.id } });
    const options =
      questions.length === 0
        ? []
        : await manager.getRepository(ExamQuestionOptionEntity).find({
            where: { examQuestionId: In(questions.map((question) => question.id)) },
          });

    return {
      session: toStudentSessionView(session),
      questions: toStudentQuestionViews(questions, options),
      answers: toStudentAnswerViews(await this.answers.listAnswers(session.id)),
    };
  }

  private async requireExam(examId: string): Promise<ExamEntity> {
    const exam = await this.tenantContext.getManager().getRepository(ExamEntity).findOneBy({ id: examId });
    if (!exam) {
      throw new NotFoundException(`exam ${examId} not found`);
    }
    return exam;
  }
}
