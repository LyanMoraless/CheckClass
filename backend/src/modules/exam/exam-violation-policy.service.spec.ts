import { ExamViolationPolicyService } from './exam-violation-policy.service';
import { MONITORABLE_EVENT_TYPES, MonitorableEventType } from './exam-vocabulary';

// RULE-EXAM-04's two modes, and RULE-EXAM-05's requirement that per-event-type
// policy be reachable later without rebuilding the module (the seam exists,
// even though no strategy reads eventType yet).
describe('ExamViolationPolicyService', () => {
  const service = new ExamViolationPolicyService();

  test('test_decide_terminateMode_endsSession', () => {
    expect(service.decide({ monitoringMode: 'TERMINATE', eventType: 'PAGE_BLUR' })).toBe('TERMINATE_SESSION');
  });

  test('test_decide_logOnlyMode_keepsSessionRunning', () => {
    expect(service.decide({ monitoringMode: 'LOG_ONLY', eventType: 'PAGE_BLUR' })).toBe('LOG_ONLY');
  });

  // RULE-EXAM-05 this round: the mode is uniform across event types. The
  // day it stops being, only the strategies change — this test is what would
  // legitimately be rewritten then, not the monitoring service.
  test.each(MONITORABLE_EVENT_TYPES)('test_decide_terminateMode_%s_sameActionForEveryEventType', (eventType) => {
    expect(service.decide({ monitoringMode: 'TERMINATE', eventType: eventType as MonitorableEventType })).toBe(
      'TERMINATE_SESSION',
    );
  });

  test.each(MONITORABLE_EVENT_TYPES)('test_decide_logOnlyMode_%s_sameActionForEveryEventType', (eventType) => {
    expect(service.decide({ monitoringMode: 'LOG_ONLY', eventType: eventType as MonitorableEventType })).toBe(
      'LOG_ONLY',
    );
  });

  // Fail closed: a corrupt mode must not silently behave as "no policy".
  test('test_decide_unknownMode_throws', () => {
    expect(() =>
      service.decide({ monitoringMode: 'SOMETHING_ELSE' as never, eventType: 'PAGE_RELOAD' }),
    ).toThrow(/No violation policy strategy/);
  });
});
