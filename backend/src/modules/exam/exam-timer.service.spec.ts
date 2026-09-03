import { ExamSessionEntity } from '../../database/entities';
import { ExamTimerService } from './exam-timer.service';

// RULE-EXAM-07/08/11: the backend owns exam time. These are pure functions,
// so every branch is reachable without a database — which is the point of
// keeping the timer free of persistence.
describe('ExamTimerService', () => {
  const service = new ExamTimerService();
  const startedAt = new Date('2026-09-03T10:00:00.000Z');

  function sessionWith(expiresAt: Date | null): Pick<ExamSessionEntity, 'expiresAt'> {
    return { expiresAt };
  }

  test('test_expiryAt_durationInMinutes_addsToStart', () => {
    expect(service.expiryAt(startedAt, 90)).toEqual(new Date('2026-09-03T11:30:00.000Z'));
  });

  // RULE-EXAM-06: no duration limit is NOT "until the window closes" — it is
  // no deadline at all, which is exactly what makes ABANDONED necessary.
  test('test_expiryAt_nullDuration_hasNoDeadline', () => {
    expect(service.expiryAt(startedAt, null)).toBeNull();
  });

  test('test_hasExpired_beforeDeadline_false', () => {
    const session = sessionWith(new Date('2026-09-03T11:00:00.000Z'));
    expect(service.hasExpired(session, new Date('2026-09-03T10:59:59.000Z'))).toBe(false);
  });

  test('test_hasExpired_exactlyAtDeadline_true', () => {
    const session = sessionWith(new Date('2026-09-03T11:00:00.000Z'));
    expect(service.hasExpired(session, new Date('2026-09-03T11:00:00.000Z'))).toBe(true);
  });

  test('test_hasExpired_nullDeadline_neverExpires', () => {
    expect(service.hasExpired(sessionWith(null), new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
  });

  test('test_remainingMs_afterDeadline_clampedToZero', () => {
    const session = sessionWith(new Date('2026-09-03T11:00:00.000Z'));
    expect(service.remainingMs(session, new Date('2026-09-03T12:00:00.000Z'))).toBe(0);
  });

  test('test_remainingMs_nullDeadline_null', () => {
    expect(service.remainingMs(sessionWith(null), new Date())).toBeNull();
  });

  // The reload guarantee of RULE-EXAM-11, expressed at the timer level: the
  // deadline is a function of the ORIGINAL start, so recomputing it later
  // yields the same instant and never a fresh exam period.
  test('test_expiryAt_recomputedLater_sameAbsoluteInstant', () => {
    const first = service.expiryAt(startedAt, 60);
    const afterReload = service.expiryAt(startedAt, 60);
    expect(afterReload).toEqual(first);
  });
});
