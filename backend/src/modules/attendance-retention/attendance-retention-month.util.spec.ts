import { isMonthPastLiveWindow, monthBounds, parseYearMonth } from './attendance-retention-month.util';

describe('attendance-retention-month.util', () => {
  describe('parseYearMonth', () => {
    test('test_parseYearMonth_validShape_returnsYearAndMonth', () => {
      expect(parseYearMonth('2026-07')).toEqual({ year: 2026, month: 7 });
    });

    test('test_parseYearMonth_missingLeadingZero_rejected', () => {
      expect(() => parseYearMonth('2026-7')).toThrow(/Invalid yearMonth/);
    });

    test('test_parseYearMonth_monthOutOfRange_rejected', () => {
      expect(() => parseYearMonth('2026-13')).toThrow(/month must be between 01 and 12/);
      expect(() => parseYearMonth('2026-00')).toThrow(/month must be between 01 and 12/);
    });

    test('test_parseYearMonth_garbage_rejected', () => {
      expect(() => parseYearMonth('not-a-month')).toThrow(/Invalid yearMonth/);
    });
  });

  describe('monthBounds', () => {
    test('test_monthBounds_ordinaryMonth_returnsHalfOpenUtcRange', () => {
      const { monthStart, monthEndExclusive } = monthBounds(2026, 6);

      expect(monthStart.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(monthEndExclusive.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });

    test('test_monthBounds_december_rollsIntoNextYear', () => {
      const { monthStart, monthEndExclusive } = monthBounds(2026, 12);

      expect(monthStart.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(monthEndExclusive.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  describe('isMonthPastLiveWindow', () => {
    test('test_isMonthPastLiveWindow_exactlySixtyDaysLater_isEligible', () => {
      const monthEndExclusive = new Date('2026-07-01T00:00:00.000Z');
      const referenceDate = new Date('2026-08-30T00:00:00.000Z'); // exactly +60 days

      expect(isMonthPastLiveWindow(monthEndExclusive, referenceDate, 60)).toBe(true);
    });

    test('test_isMonthPastLiveWindow_oneMillisecondBeforeSixtyDays_notYetEligible', () => {
      const monthEndExclusive = new Date('2026-07-01T00:00:00.000Z');
      const referenceDate = new Date('2026-08-29T23:59:59.999Z'); // 1ms short of +60 days

      expect(isMonthPastLiveWindow(monthEndExclusive, referenceDate, 60)).toBe(false);
    });

    test('test_isMonthPastLiveWindow_wellWithinWindow_notEligible', () => {
      const monthEndExclusive = new Date('2026-07-01T00:00:00.000Z');
      const referenceDate = new Date('2026-07-05T00:00:00.000Z');

      expect(isMonthPastLiveWindow(monthEndExclusive, referenceDate, 60)).toBe(false);
    });
  });
});
