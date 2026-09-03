import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
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
import { TenantContextService } from '../../database/tenant-context.service';
import { ExamAccessService } from './exam-access.service';
import { ExamAuditEntry, ExamAuditService } from './exam-audit.service';
import { ExamSessionService } from './exam-session.service';
import { isObjectiveQuestion } from './exam-vocabulary';

export interface ExamDetail {
  exam: ExamEntity;
  monitoringMode: string | null;
  monitoredEventTypes: string[];
  questions: Array<{
    id: string;
    questionType: string;
    prompt: string;
    position: number;
    points: number | null;
    options: Array<{ id: string; label: string; position: number; isCorrect: boolean }>;
  }>;
}

export interface ExamPanelEntry {
  examSessionId: string;
  personId: string;
  personName: string | null;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
  endedAt: Date | null;
  eventCount: number;
  violationCount: number;
  lastEventAt: Date | null;
}

export interface ExamSessionDetail {
  examSessionId: string;
  personId: string;
  personName: string | null;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
  endedAt: Date | null;
  answers: Array<{
    answerId: string;
    examQuestionId: string;
    questionType: string;
    answerText: string | null;
    selectedOptionIds: string[];
    awardedPoints: number | null;
    maxPoints: number | null;
    awaitingManualGrading: boolean;
  }>;
  totalAwardedPoints: number;
  totalPossiblePoints: number;
  timeline: ExamAuditEntry[];
}

// Read model of the teacher's side (RULE-EXAM-16's management/audit access):
// the exam as authored, the live panel polled every 5 seconds, and the
// per-student detail with the full violation timeline of RULE-EXAM-12.
//
// Unlike the student read model, these payloads DO carry the answer key and
// the scores — RULE-EXAM-17 restricts the student's payloads, not the
// teacher's. That asymmetry is why the two read models are separate files
// instead of one parameterized mapper: a boolean "includeAnswerKey" flag is
// exactly the kind of thing that gets passed wrong once.
@Injectable()
export class ExamPanelService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly examAccess: ExamAccessService,
    private readonly sessions: ExamSessionService,
    private readonly audit: ExamAuditService,
  ) {}

  async examDetail(personId: string, examId: string): Promise<ExamDetail> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    const manager = this.tenantContext.getManager();

    const config = await manager.getRepository(ExamMonitoringConfigEntity).findOneBy({ examId });
    const eventTypes = config
      ? await manager.getRepository(ExamMonitoringEventTypeEntity).find({ where: { examMonitoringConfigId: config.id } })
      : [];

    const questions = await manager.getRepository(ExamQuestionEntity).find({ where: { examId }, order: { position: 'ASC' } });
    const options =
      questions.length === 0
        ? []
        : await manager.getRepository(ExamQuestionOptionEntity).find({
            where: { examQuestionId: In(questions.map((question) => question.id)) },
            order: { position: 'ASC' },
          });

    return {
      exam,
      monitoringMode: config ? config.monitoringMode : null,
      monitoredEventTypes: eventTypes.map((eventType) => eventType.eventType),
      questions: questions.map((question) => ({
        id: question.id,
        questionType: question.questionType,
        prompt: question.prompt,
        position: question.position,
        points: question.points === null ? null : Number(question.points),
        options: options
          .filter((option) => option.examQuestionId === question.id)
          .map((option) => ({
            id: option.id,
            label: option.label,
            position: option.position,
            isCorrect: option.isCorrect,
          })),
      })),
    };
  }

  // The 5-second polling target. Every session is refreshed on the way out,
  // so a window that closed since the previous poll shows up here as
  // ABANDONED without any scheduler having run (see ExamSessionService).
  async sessionPanel(personId: string, examId: string): Promise<ExamPanelEntry[]> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    const sessions = await this.sessions.listRefreshedForExam(exam);
    if (sessions.length === 0) {
      return [];
    }

    const stats = await this.audit.statsBySession(sessions.map((session) => session.id));
    const names = await this.personNames(sessions.map((session) => session.personId));

    return sessions.map((session) => {
      const sessionStats = stats.get(session.id);
      return {
        examSessionId: session.id,
        personId: session.personId,
        personName: names.get(session.personId) ?? null,
        status: session.status,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        endedAt: session.endedAt,
        eventCount: sessionStats ? sessionStats.eventCount : 0,
        violationCount: sessionStats ? sessionStats.violationCount : 0,
        lastEventAt: sessionStats ? sessionStats.lastEventAt : null,
      };
    });
  }

  async sessionDetail(personId: string, examId: string, examSessionId: string): Promise<ExamSessionDetail> {
    const exam = await this.examAccess.authorizeExam(personId, examId);
    const session = await this.sessions.getRefreshedSessionForExam(exam, examSessionId);
    const manager = this.tenantContext.getManager();

    const questions = await manager.getRepository(ExamQuestionEntity).find({ where: { examId } });
    const answers = await manager.getRepository(ExamAnswerEntity).find({ where: { examSessionId: session.id } });
    const selections =
      answers.length === 0
        ? []
        : await manager.getRepository(ExamAnswerSelectedOptionEntity).find({
            where: { examAnswerId: In(answers.map((answer) => answer.id)) },
          });
    const names = await this.personNames([session.personId]);

    const detailAnswers = answers.map((answer) => {
      const question = questions.find((candidate) => candidate.id === answer.examQuestionId);
      const maxPoints = question && question.points !== null ? Number(question.points) : null;
      const awardedPoints = answer.awardedPoints === null ? null : Number(answer.awardedPoints);

      return {
        answerId: answer.id,
        examQuestionId: answer.examQuestionId,
        questionType: question ? question.questionType : 'UNKNOWN',
        answerText: answer.answerText,
        selectedOptionIds: selections
          .filter((selection) => selection.examAnswerId === answer.id)
          .map((selection) => selection.examQuestionOptionId),
        awardedPoints,
        maxPoints,
        // RULE-EXAM-14: only the subjective types ever wait for a human.
        awaitingManualGrading:
          awardedPoints === null && maxPoints !== null && !!question && !isObjectiveQuestion(question.questionType),
      };
    });

    return {
      examSessionId: session.id,
      personId: session.personId,
      personName: names.get(session.personId) ?? null,
      status: session.status,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
      answers: detailAnswers,
      totalAwardedPoints: detailAnswers.reduce((total, answer) => total + (answer.awardedPoints ?? 0), 0),
      // The whole exam's worth, not just the answered questions' — an
      // unanswered question still counts against the total (it is simply
      // worth zero, confirmed 2026-09-03).
      totalPossiblePoints: questions.reduce((total, question) => total + Number(question.points ?? 0), 0),
      timeline: await this.audit.timeline(session.id),
    };
  }

  private async personNames(personIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(personIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const people = await this.tenantContext.getManager().getRepository(PersonEntity).find({ where: { id: In(unique) } });
    return new Map(people.map((person) => [person.id, person.fullName]));
  }
}
