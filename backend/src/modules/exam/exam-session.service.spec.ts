import {
  ExamEntity,
  ExamMonitoringConfigEntity,
  ExamMonitoringEventTypeEntity,
  ExamSessionEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ExamSessionService } from './exam-session.service';
import { ExamTimerService } from './exam-timer.service';

// RULE-EXAM-12's state machine, and it lives here alone: no other service
// and nothing in the frontend may move a session between states.
//
// ExamTimerService is used for real (it is pure), while availability, audit
// and grading are mocked — their own branches are covered by their own specs.
describe('ExamSessionService', () => {
  const startedAt = new Date('2099-09-03T10:00:00.000Z');

  const exam = {
    id: 'exam-1',
    classGroupId: 'class-group-1',
    status: 'PUBLISHED',
    availableFrom: new Date('2099-09-03T09:00:00.000Z'),
    availableUntil: new Date('2099-09-03T18:00:00.000Z'),
    durationMinutes: 60,
  } as ExamEntity;

  function inProgressSession(overrides: Partial<ExamSessionEntity> = {}): ExamSessionEntity {
    return {
      id: 'session-1',
      tenantId: 'tenant-a-id',
      examId: 'exam-1',
      personId: 'student-1',
      status: 'IN_PROGRESS',
      startedAt,
      expiresAt: new Date('2099-09-03T11:00:00.000Z'),
      endedAt: null,
      durationMinutesSnapshot: 60,
      monitoringModeSnapshot: 'TERMINATE',
      monitoredEventTypesSnapshot: ['PAGE_BLUR'],
      ...overrides,
    } as ExamSessionEntity;
  }

  function buildService(options: { existingSession?: ExamSessionEntity | null; examOverrides?: Partial<ExamEntity> } = {}) {
    const currentExam = { ...exam, ...options.examOverrides } as ExamEntity;

    const examRepo: MockRepository = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(currentExam) });
    const sessionRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.existingSession ?? null),
      find: jest.fn().mockResolvedValue([]),
    });
    const configRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'config-1', examId: 'exam-1', monitoringMode: 'LOG_ONLY' }),
    });
    const eventTypeRepo: MockRepository = createMockRepository({
      find: jest.fn().mockResolvedValue([{ eventType: 'PAGE_BLUR' }, { eventType: 'PAGE_RELOAD' }]),
    });

    const manager = createMockEntityManager(
      new Map([
        [ExamEntity, examRepo],
        [ExamSessionEntity, sessionRepo],
        [ExamMonitoringConfigEntity, configRepo],
        [ExamMonitoringEventTypeEntity, eventTypeRepo],
      ]),
    );

    const availability = {
      assertStartable: jest.fn().mockResolvedValue(undefined),
      assertStudentVisibility: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { recordServerEvent: jest.fn().mockResolvedValue(undefined) };
    const grading = { gradeObjectiveAnswers: jest.fn().mockResolvedValue(undefined) };

    const service = new ExamSessionService(
      createMockTenantContext(manager) as never,
      availability as never,
      new ExamTimerService(),
      audit as never,
      grading as never,
    );

    return { service, examRepo, sessionRepo, configRepo, eventTypeRepo, availability, audit, grading, currentExam };
  }

  describe('startOrResume', () => {
    test('test_startOrResume_noExistingSession_createsInProgressWithSnapshotAndDeadline', async () => {
      const { service, sessionRepo, availability } = buildService({ existingSession: null });

      const { session } = await service.startOrResume('student-1', 'exam-1');

      expect(availability.assertStartable).toHaveBeenCalled();
      expect(session.status).toBe('IN_PROGRESS');
      expect(session.durationMinutesSnapshot).toBe(60);
      expect(session.monitoringModeSnapshot).toBe('LOG_ONLY');
      expect(session.monitoredEventTypesSnapshot).toEqual(['PAGE_BLUR', 'PAGE_RELOAD']);
      expect(session.expiresAt).toEqual(new Date(session.startedAt.getTime() + 60 * 60_000));
      expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    });

    // RULE-EXAM-06: no duration limit means no deadline at all — such a
    // session is closed by the availability window (ABANDONED), never by
    // EXPIRED.
    test('test_startOrResume_examWithoutDuration_hasNoDeadline', async () => {
      const { service } = buildService({ existingSession: null, examOverrides: { durationMinutes: null } });

      const { session } = await service.startOrResume('student-1', 'exam-1');

      expect(session.expiresAt).toBeNull();
      expect(session.durationMinutesSnapshot).toBeNull();
    });

    test('test_startOrResume_newSession_writesStartedAuditEvent', async () => {
      const { service, audit } = buildService({ existingSession: null });

      await service.startOrResume('student-1', 'exam-1');

      expect(audit.recordServerEvent).toHaveBeenCalledWith(
        expect.objectContaining({ personId: 'student-1' }),
        'EXAM_SESSION_STARTED',
        expect.objectContaining({ monitoringMode: 'LOG_ONLY' }),
      );
    });

    // RULE-EXAM-11 + single attempt: a reload must land on the SAME session
    // with the SAME absolute deadline, and must not create a second row.
    test('test_startOrResume_existingRunningSession_returnsSameSessionWithoutCreatingAnother', async () => {
      const existing = inProgressSession();
      const { service, sessionRepo, audit } = buildService({ existingSession: existing });

      const { session } = await service.startOrResume('student-1', 'exam-1');

      expect(session.id).toBe('session-1');
      expect(session.expiresAt).toEqual(existing.expiresAt);
      expect(sessionRepo.save).not.toHaveBeenCalled();
      expect(audit.recordServerEvent).not.toHaveBeenCalled();
    });

    test('test_startOrResume_existingRunningSession_doesNotReevaluateWindow', async () => {
      const { service, availability } = buildService({ existingSession: inProgressSession() });

      await service.startOrResume('student-1', 'exam-1');

      // Recovering an already-started session must survive the window having
      // closed (RULE-EXAM-11); only STARTING is gated by the window.
      expect(availability.assertStartable).not.toHaveBeenCalled();
      expect(availability.assertStudentVisibility).toHaveBeenCalled();
    });

    // One attempt per student per exam (confirmed 2099-09-03).
    test('test_startOrResume_alreadyFinishedSession_conflicts', async () => {
      const { service } = buildService({ existingSession: inProgressSession({ status: 'COMPLETED' }) });

      await expect(service.startOrResume('student-1', 'exam-1')).rejects.toThrow(/only one attempt is allowed/);
    });

    // Two tabs pressing start at the same instant: the database arbitrates,
    // and the loser gets the winning row rather than an error the student
    // cannot act on.
    test('test_startOrResume_uniqueViolationRace_returnsSessionThatWon', async () => {
      const winner = inProgressSession({ id: 'session-winner' });
      const { service, sessionRepo } = buildService({ existingSession: null });
      sessionRepo.save.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
      sessionRepo.findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);

      const { session } = await service.startOrResume('student-1', 'exam-1');

      expect(session.id).toBe('session-winner');
    });

    test('test_startOrResume_unexpectedDatabaseError_propagates', async () => {
      const { service, sessionRepo } = buildService({ existingSession: null });
      sessionRepo.save.mockRejectedValueOnce(Object.assign(new Error('connection lost'), { code: '08006' }));

      await expect(service.startOrResume('student-1', 'exam-1')).rejects.toThrow(/connection lost/);
    });
  });

  describe('refresh', () => {
    // RULE-EXAM-08. There is no scheduler in the project, so the transition
    // is derived on read — and endedAt is the deadline itself, not the
    // moment someone happened to look.
    test('test_refresh_deadlinePassed_becomesExpiredAtTheDeadline', async () => {
      const session = inProgressSession();
      const { service, audit, grading } = buildService({ existingSession: session });

      const refreshed = await service.refresh(session, exam, new Date('2099-09-03T11:30:00.000Z'));

      expect(refreshed.status).toBe('EXPIRED');
      expect(refreshed.endedAt).toEqual(new Date('2099-09-03T11:00:00.000Z'));
      expect(audit.recordServerEvent).toHaveBeenCalledWith(expect.anything(), 'EXAM_TIME_EXPIRED', expect.anything());
      expect(grading.gradeObjectiveAnswers).toHaveBeenCalled();
    });

    // ABANDONED, confirmed 2099-09-03: started, never finished, and the
    // availability window closed with the session still running — the
    // typical case of an exam with no duration, where EXPIRED never fires.
    test('test_refresh_windowClosedOnUnlimitedSession_becomesAbandonedAtWindowEnd', async () => {
      const session = inProgressSession({ expiresAt: null, durationMinutesSnapshot: null });
      const { service, audit } = buildService({ existingSession: session });

      const refreshed = await service.refresh(session, exam, new Date('2099-09-03T18:30:00.000Z'));

      expect(refreshed.status).toBe('ABANDONED');
      expect(refreshed.endedAt).toEqual(exam.availableUntil);
      expect(audit.recordServerEvent).toHaveBeenCalledWith(
        expect.anything(),
        'EXAM_SESSION_ABANDONED',
        expect.anything(),
      );
    });

    // Both deadlines already passed by the time anyone looked: the one that
    // came FIRST is the one that actually ended the session.
    test('test_refresh_bothDeadlinesPassed_earlierOneWins_expired', async () => {
      const session = inProgressSession({ expiresAt: new Date('2099-09-03T11:00:00.000Z') });
      const { service } = buildService({ existingSession: session });

      const refreshed = await service.refresh(session, exam, new Date('2099-09-04T00:00:00.000Z'));

      expect(refreshed.status).toBe('EXPIRED');
    });

    test('test_refresh_bothDeadlinesPassed_earlierOneWins_abandoned', async () => {
      const session = inProgressSession({ expiresAt: new Date('2099-09-03T23:00:00.000Z') });
      const { service } = buildService({ existingSession: session });

      const refreshed = await service.refresh(session, exam, new Date('2099-09-04T00:00:00.000Z'));

      // The window closed at 18:00, before the individual deadline at 23:00.
      expect(refreshed.status).toBe('ABANDONED');
      expect(refreshed.endedAt).toEqual(exam.availableUntil);
    });

    test('test_refresh_stillRunning_leavesSessionUntouched', async () => {
      const session = inProgressSession();
      const { service, sessionRepo, audit } = buildService({ existingSession: session });

      const refreshed = await service.refresh(session, exam, new Date('2099-09-03T10:30:00.000Z'));

      expect(refreshed.status).toBe('IN_PROGRESS');
      expect(sessionRepo.save).not.toHaveBeenCalled();
      expect(audit.recordServerEvent).not.toHaveBeenCalled();
    });

    // Idempotent: reading an already-ended session must not append a second
    // lifecycle event to the append-only trail.
    test('test_refresh_alreadyEndedSession_isIdempotent', async () => {
      const session = inProgressSession({ status: 'EXPIRED', endedAt: new Date('2099-09-03T11:00:00.000Z') });
      const { service, sessionRepo, audit } = buildService({ existingSession: session });

      const refreshed = await service.refresh(session, exam, new Date('2099-09-05T00:00:00.000Z'));

      expect(refreshed.status).toBe('EXPIRED');
      expect(sessionRepo.save).not.toHaveBeenCalled();
      expect(audit.recordServerEvent).not.toHaveBeenCalled();
    });
  });

  describe('finish', () => {
    // Confirmed 2099-09-03: every question is optional, so nothing about the
    // answers can block submission.
    test('test_finish_runningSession_completesWithoutCheckingAnswers', async () => {
      const { service, audit } = buildService({ existingSession: inProgressSession() });

      const finished = await service.finish('student-1', 'exam-1');

      expect(finished.status).toBe('COMPLETED');
      expect(finished.endedAt).not.toBeNull();
      expect(audit.recordServerEvent).toHaveBeenCalledWith(
        expect.anything(),
        'EXAM_SESSION_COMPLETED',
        expect.anything(),
      );
    });

    // RULE-EXAM-07/08: the server revalidates expiry before accepting the
    // submission, whatever the client's own clock says.
    test('test_finish_deadlineAlreadyPassed_rejectsAndExpiresInstead', async () => {
      const expired = inProgressSession({ expiresAt: new Date('2020-01-01T00:00:00.000Z') });
      const { service } = buildService({ existingSession: expired });

      await expect(service.finish('student-1', 'exam-1')).rejects.toThrow(/EXPIRED and no longer accepts changes/);
    });

    test('test_finish_noSession_notFound', async () => {
      const { service } = buildService({ existingSession: null });

      await expect(service.finish('student-1', 'exam-1')).rejects.toThrow(/no session for exam/);
    });
  });

  describe('terminateForViolation', () => {
    // RULE-EXAM-04's TERMINATE mode. The decision is made by the policy; the
    // transition happens only here.
    test('test_terminateForViolation_endsSessionAndRecordsTriggeringEvent', async () => {
      const session = inProgressSession();
      const { service, audit, grading } = buildService({ existingSession: session });

      const terminated = await service.terminateForViolation(session, 'NEW_TAB_OR_WINDOW_ATTEMPT');

      expect(terminated.status).toBe('TERMINATED');
      expect(audit.recordServerEvent).toHaveBeenCalledWith(
        expect.anything(),
        'EXAM_SESSION_TERMINATED',
        expect.objectContaining({ triggeringEventType: 'NEW_TAB_OR_WINDOW_ATTEMPT' }),
      );
      // RULE-EXAM-04: answers already synchronized are preserved and still
      // graded.
      expect(grading.gradeObjectiveAnswers).toHaveBeenCalled();
    });
  });

  describe('listRefreshedForExam', () => {
    // The teacher's 5-second poll is also what resolves stale sessions, since
    // no periodic job exists to do it.
    test('test_listRefreshedForExam_resolvesStaleSessionsOnRead', async () => {
      // Deliberately in the past relative to the real clock: this method
      // takes no `now` argument, since production reads always mean "right
      // now".
      const stale = inProgressSession({ expiresAt: new Date('2020-01-01T10:30:00.000Z') });
      const { service, sessionRepo } = buildService({});
      sessionRepo.find.mockResolvedValue([stale]);

      const sessions = await service.listRefreshedForExam({
        ...exam,
        availableUntil: new Date('2020-01-01T10:45:00.000Z'),
      } as ExamEntity);

      expect(sessions[0].status).toBe('EXPIRED');
    });
  });
});
