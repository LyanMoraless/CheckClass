import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  ExamEntity,
  ExamMonitoringConfigEntity,
  ExamMonitoringEventTypeEntity,
  ExamSessionEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ExamAuditService } from './exam-audit.service';
import { ExamAvailabilityService } from './exam-availability.service';
import { ExamGradingService } from './exam-grading.service';
import { ExamTimerService } from './exam-timer.service';
import { MonitoringMode, ServerEventType, SessionStatus } from './exam-vocabulary';

const UNIQUE_VIOLATION = '23505';

export interface ActiveExamSession {
  exam: ExamEntity;
  session: ExamSessionEntity;
}

interface SessionLapse {
  status: SessionStatus;
  at: Date;
  eventType: ServerEventType;
}

// Component 5 of the approved architecture, and the module's ONLY write
// authority over session state. Every transition — start, expiry,
// abandonment, termination, completion — happens in this file and nowhere
// else: ExamMonitoringService asks for a termination, ExamAnswerService asks
// for an active session, the frontend asks for nothing at all. That is what
// makes RULE-EXAM-12's state set enforceable instead of aspirational.
//
// The lazy end-state resolution (see refresh/resolveLapse below) is the one
// structurally unusual thing here, and it is a deliberate consequence of a
// confirmed constraint: the project has no scheduler and none was approved
// for this feature. So EXPIRED and ABANDONED are not "applied by a job at
// the moment they happen" — they are DERIVED from the session's own
// timestamps whenever anyone reads or touches the session (the student's
// next interaction, or the teacher's 5-second panel poll). Nothing observes
// a stale IN_PROGRESS, because nothing can observe a session without going
// through here first.
@Injectable()
export class ExamSessionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly availability: ExamAvailabilityService,
    private readonly timer: ExamTimerService,
    private readonly audit: ExamAuditService,
    private readonly grading: ExamGradingService,
  ) {}

  // RULE-EXAM-11 + single attempt (confirmed 2026-09-03): reloading the page
  // MUST land on the same session with the same absolute expiresAt, and must
  // never mint a second one. Hence one entry point for both cases — the
  // caller does not get to choose "start" or "resume", the state does.
  async startOrResume(personId: string, examId: string): Promise<ActiveExamSession> {
    const now = new Date();
    const exam = await this.requireExam(examId);

    const existing = await this.findSession(personId, examId);
    if (existing) {
      await this.availability.assertStudentVisibility(personId, exam);
      const session = await this.refresh(existing, exam, now);
      if (session.status !== 'IN_PROGRESS') {
        // Not a resumable session, and a new one is out of the question:
        // one attempt per student per exam, enforced by UNIQUE
        // (tenant_id, exam_id, person_id).
        throw new ConflictException(
          `You have already taken exam ${examId} (session is ${session.status}); only one attempt is allowed`,
        );
      }
      return { exam, session };
    }

    await this.availability.assertStartable(personId, exam, now);
    return { exam, session: await this.create(personId, exam, now) };
  }

  // The read counterpart, for "what is my state on this exam" — never
  // creates anything, so the student's own listing/polling cannot
  // accidentally consume their single attempt.
  async findRefreshedSession(personId: string, examId: string, exam?: ExamEntity): Promise<ExamSessionEntity | null> {
    const existing = await this.findSession(personId, examId);
    if (!existing) {
      return null;
    }
    return this.refresh(existing, exam ?? (await this.requireExam(examId)));
  }

  // The gate every "the student is doing something inside the exam" path
  // goes through (answering, reporting an event, finishing): re-resolves the
  // end states first, so an expired session can never accept one more write
  // (RULE-EXAM-07/08).
  async requireActiveSession(personId: string, examId: string): Promise<ActiveExamSession> {
    const exam = await this.requireExam(examId);
    const existing = await this.findSession(personId, examId);
    if (!existing) {
      throw new NotFoundException(`You have no session for exam ${examId}`);
    }

    const session = await this.refresh(existing, exam);
    if (session.status !== 'IN_PROGRESS') {
      throw new ConflictException(`Your session for exam ${examId} is ${session.status} and no longer accepts changes`);
    }
    return { exam, session };
  }

  // RULE-EXAM-03's addendum (confirmed 2026-09-03): a blank question NEVER
  // blocks delivery, so there is deliberately no completeness validation
  // here — finishing is always allowed while the session is active.
  async finish(personId: string, examId: string): Promise<ExamSessionEntity> {
    const { session } = await this.requireActiveSession(personId, examId);
    return this.end(session, 'COMPLETED', new Date(), 'EXAM_SESSION_COMPLETED');
  }

  // RULE-EXAM-04, TERMINATE mode. Called only by ExamMonitoringService,
  // after ExamViolationPolicyService decided — this service never inspects a
  // monitoring event itself, which is what keeps timer and monitoring
  // independent (RULE-EXAM-09).
  async terminateForViolation(session: ExamSessionEntity, triggeringEventType: string): Promise<ExamSessionEntity> {
    return this.end(session, 'TERMINATED', new Date(), 'EXAM_SESSION_TERMINATED', { triggeringEventType });
  }

  // Teacher's panel (polled every 5 seconds): each session is refreshed on
  // read, which is exactly where a window that closed since the last poll
  // turns into ABANDONED.
  async listRefreshedForExam(exam: ExamEntity): Promise<ExamSessionEntity[]> {
    const sessions = await this.tenantContext.getManager().getRepository(ExamSessionEntity).find({
      where: { examId: exam.id },
      order: { startedAt: 'ASC' },
    });

    const refreshed: ExamSessionEntity[] = [];
    for (const session of sessions) {
      refreshed.push(await this.refresh(session, exam));
    }
    return refreshed;
  }

  async getRefreshedSessionForExam(exam: ExamEntity, examSessionId: string): Promise<ExamSessionEntity> {
    const session = await this.tenantContext.getManager().getRepository(ExamSessionEntity).findOneBy({ id: examSessionId });
    if (!session || session.examId !== exam.id) {
      throw new NotFoundException(`exam_session ${examSessionId} not found for exam ${exam.id}`);
    }
    return this.refresh(session, exam);
  }

  // Applies whichever end state the clock already justifies. Idempotent: a
  // session that is not IN_PROGRESS is returned untouched, so the audit
  // trail gets exactly one EXAM_TIME_EXPIRED / EXAM_SESSION_ABANDONED entry
  // no matter how many times it is read afterwards.
  async refresh(session: ExamSessionEntity, exam: ExamEntity, now: Date = new Date()): Promise<ExamSessionEntity> {
    if (session.status !== 'IN_PROGRESS') {
      return session;
    }

    const lapse = this.resolveLapse(session, exam, now);
    if (!lapse) {
      return session;
    }
    return this.end(session, lapse.status, lapse.at, lapse.eventType);
  }

  // The two ways a running session can be over without the student saying
  // so, and they are genuinely different rules:
  //   EXPIRED   — the individual duration ran out (RULE-EXAM-08);
  //   ABANDONED — the exam's availability window closed with the session
  //               still running (RULE-EXAM-06 + confirmed 2026-09-03), the
  //               typical case of an exam with no duration limit, where
  //               EXPIRED would never fire.
  // Both can be true at once by the time anyone looks, so the EARLIER
  // deadline wins: it is the one that actually ended the session, and
  // endedAt is that instant rather than "whenever we happened to notice".
  private resolveLapse(session: ExamSessionEntity, exam: ExamEntity, now: Date): SessionLapse | null {
    const lapses: SessionLapse[] = [];

    if (this.timer.hasExpired(session, now) && session.expiresAt !== null) {
      lapses.push({ status: 'EXPIRED', at: new Date(session.expiresAt), eventType: 'EXAM_TIME_EXPIRED' });
    }

    const windowEnd = new Date(exam.availableUntil);
    if (now > windowEnd) {
      lapses.push({ status: 'ABANDONED', at: windowEnd, eventType: 'EXAM_SESSION_ABANDONED' });
    }

    if (lapses.length === 0) {
      return null;
    }
    return lapses.sort((first, second) => first.at.getTime() - second.at.getTime())[0];
  }

  // The single funnel every end state goes through: persist the state,
  // grade what can be graded, then write the audit entry (RULE-EXAM-12).
  // Answers already saved are never discarded — RULE-EXAM-04 requires them
  // preserved even when the session was cut short.
  private async end(
    session: ExamSessionEntity,
    status: SessionStatus,
    endedAt: Date,
    eventType: ServerEventType,
    details?: Record<string, unknown>,
  ): Promise<ExamSessionEntity> {
    session.status = status;
    session.endedAt = endedAt;
    const saved = await this.tenantContext.getManager().getRepository(ExamSessionEntity).save(session);

    await this.grading.gradeObjectiveAnswers(saved);
    await this.audit.recordServerEvent(saved, eventType, { ...details, endedAt: endedAt.toISOString(), status });
    return saved;
  }

  private async create(personId: string, exam: ExamEntity, startedAt: Date): Promise<ExamSessionEntity> {
    const snapshot = await this.configSnapshot(exam);
    const repository = this.tenantContext.getManager().getRepository(ExamSessionEntity);

    const session = repository.create({
      tenantId: this.tenantContext.getTenantId(),
      examId: exam.id,
      personId,
      status: 'IN_PROGRESS',
      startedAt,
      // Computed once, here, and re-served verbatim forever after
      // (RULE-EXAM-07/11).
      expiresAt: this.timer.expiryAt(startedAt, exam.durationMinutes),
      endedAt: null,
      durationMinutesSnapshot: exam.durationMinutes,
      monitoringModeSnapshot: snapshot.monitoringMode,
      monitoredEventTypesSnapshot: snapshot.monitoredEventTypes,
    });

    let saved: ExamSessionEntity;
    try {
      saved = await repository.save(session);
    } catch (error) {
      // Two tabs pressing "start" at the same instant both got past the
      // findSession above; the database is the arbiter. Resolving the race
      // by returning the row that won is not a lenient reading of "one
      // attempt" — it is the same outcome the two requests would have had
      // if they had arrived one after the other (RULE-EXAM-11).
      if ((error as { code?: string }).code !== UNIQUE_VIOLATION) {
        throw error;
      }
      const winner = await this.findSession(personId, exam.id);
      if (!winner) {
        throw new ConflictException(
          `A session for exam ${exam.id} already exists for this student, but could not be read back`,
        );
      }
      return winner;
    }

    await this.audit.recordServerEvent(saved, 'EXAM_SESSION_STARTED', {
      expiresAt: saved.expiresAt ? saved.expiresAt.toISOString() : null,
      monitoringMode: saved.monitoringModeSnapshot,
    });
    return saved;
  }

  // Freezes the configuration in force at this moment onto the session, the
  // same precedent class_session already sets: a teacher editing the exam
  // while someone is taking it must not change the rules of a run already
  // under way.
  private async configSnapshot(exam: ExamEntity): Promise<{
    monitoringMode: MonitoringMode;
    monitoredEventTypes: string[];
  }> {
    const manager = this.tenantContext.getManager();

    const config = await manager.getRepository(ExamMonitoringConfigEntity).findOneBy({ examId: exam.id });
    if (!config) {
      // Every exam gets its monitoring config at creation time and
      // publishing re-checks it, so a published exam without one is a data
      // integrity problem, never something the student did.
      throw new InternalServerErrorException(`exam ${exam.id} has no monitoring configuration`);
    }

    const eventTypes = await manager.getRepository(ExamMonitoringEventTypeEntity).find({
      where: { examMonitoringConfigId: config.id },
    });

    return {
      monitoringMode: config.monitoringMode as MonitoringMode,
      monitoredEventTypes: eventTypes.map((eventType) => eventType.eventType),
    };
  }

  private async findSession(personId: string, examId: string): Promise<ExamSessionEntity | null> {
    return this.tenantContext.getManager().getRepository(ExamSessionEntity).findOneBy({ personId, examId });
  }

  private async requireExam(examId: string): Promise<ExamEntity> {
    const exam = await this.tenantContext.getManager().getRepository(ExamEntity).findOneBy({ id: examId });
    if (!exam) {
      throw new NotFoundException(`exam ${examId} not found`);
    }
    return exam;
  }
}
