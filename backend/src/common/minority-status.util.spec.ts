import { deriveMinorityStatus, isSensitiveConsentGateBlocked } from './minority-status.util';

describe('minority-status.util', () => {
  describe('deriveMinorityStatus', () => {
    test('test_deriveMinorityStatus_dateOfBirthNull_returnsAbsentWithUnknownMinority', () => {
      expect(deriveMinorityStatus({ dateOfBirth: null, dateOfBirthConfirmedAt: null })).toEqual({
        isMinor: null,
        confirmationState: 'absent',
      });
    });

    test('test_deriveMinorityStatus_dateOfBirthSetButNotConfirmed_returnsProvisional', () => {
      const status = deriveMinorityStatus(
        { dateOfBirth: '2000-01-01', dateOfBirthConfirmedAt: null },
        new Date('2026-09-15T00:00:00.000Z'),
      );
      expect(status).toEqual({ isMinor: false, confirmationState: 'provisional' });
    });

    test('test_deriveMinorityStatus_bothSet_returnsConfirmed', () => {
      const status = deriveMinorityStatus(
        { dateOfBirth: '2000-01-01', dateOfBirthConfirmedAt: '2026-01-01T00:00:00.000Z' },
        new Date('2026-09-15T00:00:00.000Z'),
      );
      expect(status).toEqual({ isMinor: false, confirmationState: 'confirmed' });
    });

    test('test_deriveMinorityStatus_acceptsRealDateInstanceForDateOfBirth', () => {
      // Raw manager.query() reads return a real Date for a `date` column,
      // unlike repository.findOneBy's string — both must work.
      const status = deriveMinorityStatus(
        { dateOfBirth: new Date('2010-06-15T00:00:00.000Z'), dateOfBirthConfirmedAt: null },
        new Date('2026-06-14T00:00:00.000Z'),
      );
      expect(status.isMinor).toBe(true);
    });

    test('test_deriveMinorityStatus_birthdayIsTomorrow_stillCountsPreviousAge', () => {
      // Turns 18 on 2026-09-16; as of 2026-09-15 is still 17.
      const status = deriveMinorityStatus(
        { dateOfBirth: '2008-09-16', dateOfBirthConfirmedAt: '2026-01-01T00:00:00.000Z' },
        new Date('2026-09-15T00:00:00.000Z'),
      );
      expect(status.isMinor).toBe(true);
    });

    test('test_deriveMinorityStatus_birthdayIsToday_countsAsAlreadyTurnedThatAge', () => {
      // Turns 18 exactly on 2026-09-15.
      const status = deriveMinorityStatus(
        { dateOfBirth: '2008-09-15', dateOfBirthConfirmedAt: '2026-01-01T00:00:00.000Z' },
        new Date('2026-09-15T00:00:00.000Z'),
      );
      expect(status.isMinor).toBe(false);
    });

    test('test_deriveMinorityStatus_leapYearBirthday_handlesFeb29Correctly', () => {
      const status = deriveMinorityStatus(
        { dateOfBirth: '2008-02-29', dateOfBirthConfirmedAt: '2026-01-01T00:00:00.000Z' },
        new Date('2026-09-15T00:00:00.000Z'),
      );
      expect(status.isMinor).toBe(false);
    });
  });

  describe('isSensitiveConsentGateBlocked', () => {
    test('test_isSensitiveConsentGateBlocked_absent_returnsTrue', () => {
      expect(isSensitiveConsentGateBlocked({ isMinor: null, confirmationState: 'absent' })).toBe(true);
    });

    test('test_isSensitiveConsentGateBlocked_provisionalAndAdult_stillReturnsTrue', () => {
      // RULE-GRD-07 pendência 3: an unconfirmed value does not release the
      // gate even when it claims majority.
      expect(isSensitiveConsentGateBlocked({ isMinor: false, confirmationState: 'provisional' })).toBe(true);
    });

    test('test_isSensitiveConsentGateBlocked_confirmed_returnsFalse', () => {
      expect(isSensitiveConsentGateBlocked({ isMinor: false, confirmationState: 'confirmed' })).toBe(false);
    });

    test('test_isSensitiveConsentGateBlocked_confirmedMinor_stillReturnsFalse', () => {
      // The gate here only concerns "is the birth date confirmed", not
      // majority itself — a confirmed minor still passes THIS gate; whether
      // a guardian's consent is required instead of the student's own is a
      // separate check inside RULE-FACE-09/RULE-PRES-14 once implemented.
      expect(isSensitiveConsentGateBlocked({ isMinor: true, confirmationState: 'confirmed' })).toBe(false);
    });
  });
});
