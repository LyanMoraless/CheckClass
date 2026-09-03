import { ExamSessionEntity } from '../../database/entities';
import { ExamMonitoringService } from './exam-monitoring.service';
import { ExamViolationPolicyService } from './exam-violation-policy.service';

// RULE-EXAM-05 (only enabled types are monitored), RULE-EXAM-11 (a page
// reload is ALWAYS logged, whether or not it counts as a violation) and
// RULE-EXAM-04 (what happens when it does count).
//
// The real ExamViolationPolicyService is used — the point of most of these
// tests is the interaction between the enablement filter and the policy.
describe('ExamMonitoringService', () => {
  function session(overrides: Partial<ExamSessionEntity> = {}): ExamSessionEntity {
    return {
      id: 'session-1',
      personId: 'student-1',
      examId: 'exam-1',
      status: 'IN_PROGRESS',
      monitoringModeSnapshot: 'LOG_ONLY',
      monitoredEventTypesSnapshot: ['PAGE_BLUR'],
      ...overrides,
    } as ExamSessionEntity;
  }

  function buildService(currentSession: ExamSessionEntity) {
    const sessions = {
      requireActiveSession: jest.fn().mockResolvedValue({ exam: { id: 'exam-1' }, session: currentSession }),
      terminateForViolation: jest
        .fn()
        .mockImplementation(async (target: ExamSessionEntity) => ({ ...target, status: 'TERMINATED' })),
    };
    const audit = { recordClientEvent: jest.fn().mockResolvedValue(undefined) };
    const service = new ExamMonitoringService(sessions as never, new ExamViolationPolicyService(), audit as never);
    return { service, sessions, audit };
  }

  // RULE-EXAM-05: a type the teacher did not enable is not monitored at all
  // — not even written to the trail, or the enablement checkbox would mean
  // nothing.
  test('test_report_disabledEventType_notRecordedAtAll', async () => {
    const { service, audit } = buildService(session());

    const result = await service.report('student-1', 'exam-1', { eventType: 'EXTERNAL_NAVIGATION_ATTEMPT' });

    expect(result).toEqual({ recorded: false, treatedAsViolation: false, action: null, sessionStatus: 'IN_PROGRESS' });
    expect(audit.recordClientEvent).not.toHaveBeenCalled();
  });

  test('test_report_enabledEventType_recordedAsViolation', async () => {
    const { service, audit } = buildService(session());

    const result = await service.report('student-1', 'exam-1', { eventType: 'PAGE_BLUR' });

    expect(result.recorded).toBe(true);
    expect(result.treatedAsViolation).toBe(true);
    expect(audit.recordClientEvent).toHaveBeenCalledWith(expect.anything(), 'PAGE_BLUR', true, undefined);
  });

  // RULE-EXAM-11 has no "if enabled" clause, unlike RULE-EXAM-05's other
  // types: the reload is always on the record, and only whether it COUNTS is
  // conditional.
  test('test_report_pageReloadNotEnabled_stillRecordedButNotAViolation', async () => {
    const { service, audit, sessions } = buildService(session({ monitoredEventTypesSnapshot: [] }));

    const result = await service.report('student-1', 'exam-1', { eventType: 'PAGE_RELOAD' });

    expect(result).toEqual({ recorded: true, treatedAsViolation: false, action: null, sessionStatus: 'IN_PROGRESS' });
    expect(audit.recordClientEvent).toHaveBeenCalledWith(expect.anything(), 'PAGE_RELOAD', false, undefined);
    expect(sessions.terminateForViolation).not.toHaveBeenCalled();
  });

  test('test_report_pageReloadEnabled_countsAsViolation', async () => {
    const { service, audit } = buildService(session({ monitoredEventTypesSnapshot: ['PAGE_RELOAD'] }));

    const result = await service.report('student-1', 'exam-1', { eventType: 'PAGE_RELOAD' });

    expect(result.treatedAsViolation).toBe(true);
    expect(audit.recordClientEvent).toHaveBeenCalledWith(expect.anything(), 'PAGE_RELOAD', true, undefined);
  });

  // RULE-EXAM-04, "apenas registro": the student keeps going.
  test('test_report_logOnlyMode_keepsSessionRunning', async () => {
    const { service, sessions } = buildService(session({ monitoringModeSnapshot: 'LOG_ONLY' }));

    const result = await service.report('student-1', 'exam-1', { eventType: 'PAGE_BLUR' });

    expect(result.action).toBe('LOG_ONLY');
    expect(result.sessionStatus).toBe('IN_PROGRESS');
    expect(sessions.terminateForViolation).not.toHaveBeenCalled();
  });

  // RULE-EXAM-04, "encerramento automático": the state change is delegated
  // to ExamSessionService, never applied here.
  test('test_report_terminateMode_delegatesTerminationToSessionService', async () => {
    const { service, sessions } = buildService(session({ monitoringModeSnapshot: 'TERMINATE' }));

    const result = await service.report('student-1', 'exam-1', { eventType: 'PAGE_BLUR' });

    expect(sessions.terminateForViolation).toHaveBeenCalledWith(expect.anything(), 'PAGE_BLUR');
    expect(result.action).toBe('TERMINATE_SESSION');
    expect(result.sessionStatus).toBe('TERMINATED');
  });

  // RULE-EXAM-05: the SNAPSHOT decides, not the exam's current configuration
  // — a mid-flight edit cannot change what a running session is monitored
  // for.
  test('test_report_usesSessionSnapshotNotCurrentExamConfig', async () => {
    const { service, audit } = buildService(
      session({ monitoredEventTypesSnapshot: ['KEYBOARD_RESTRICTION_TRIGGERED'], monitoringModeSnapshot: 'TERMINATE' }),
    );

    await service.report('student-1', 'exam-1', { eventType: 'KEYBOARD_RESTRICTION_TRIGGERED' });

    expect(audit.recordClientEvent).toHaveBeenCalledWith(
      expect.anything(),
      'KEYBOARD_RESTRICTION_TRIGGERED',
      true,
      undefined,
    );
  });

  // Security control 4: the client write path may never name a
  // server-generated event type.
  test('test_report_serverOnlyEventType_rejected', async () => {
    const { service, audit } = buildService(session());

    await expect(
      service.report('student-1', 'exam-1', { eventType: 'EXAM_TIME_EXPIRED' as never }),
    ).rejects.toThrow(/not a reportable monitoring event type/);
    expect(audit.recordClientEvent).not.toHaveBeenCalled();
  });

  test('test_report_expiredSession_rejectedBeforeWritingAnything', async () => {
    const { service, sessions, audit } = buildService(session());
    sessions.requireActiveSession.mockRejectedValue(new Error('session is EXPIRED'));

    await expect(service.report('student-1', 'exam-1', { eventType: 'PAGE_BLUR' })).rejects.toThrow(/EXPIRED/);
    expect(audit.recordClientEvent).not.toHaveBeenCalled();
  });

  // Security control 7 applied to the technical details a browser attaches:
  // they end up rendered on the teacher's timeline.
  test('test_report_details_sanitizedBeforeReachingTheAuditTrail', async () => {
    const { service, audit } = buildService(session());

    await service.report('student-1', 'exam-1', {
      eventType: 'PAGE_BLUR',
      details: { url: 'https://x.test<script>alert(1)</script>' },
    });

    expect(audit.recordClientEvent).toHaveBeenCalledWith(expect.anything(), 'PAGE_BLUR', true, {
      url: 'https://x.testalert(1)',
    });
  });
});
