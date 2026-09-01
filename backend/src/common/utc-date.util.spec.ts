import { combineUtc, dateKey, dateKeyOfUtc, extractUtcYmd, timeToSeconds, utcDayRange } from './utc-date.util';

describe('utc-date.util', () => {
  test('test_extractUtcYmd_returnsUtcCalendarComponents', () => {
    expect(extractUtcYmd(new Date('2026-09-07T13:00:00.000Z'))).toEqual({ year: 2026, month: 8, day: 7 });
  });

  test('test_dateKey_padsMonthAndDayToTwoDigits', () => {
    expect(dateKey(2026, 0, 7)).toBe('2026-01-07');
  });

  test('test_dateKeyOfUtc_composesExtractAndKey', () => {
    expect(dateKeyOfUtc(new Date('2026-09-07T13:00:00.000Z'))).toBe('2026-09-07');
  });

  test('test_combineUtc_buildsExpectedTimestamp', () => {
    expect(combineUtc(2026, 8, 7, '13:30:00')).toEqual(new Date('2026-09-07T13:30:00.000Z'));
  });

  test('test_combineUtc_defaultsMissingSecondsToZero', () => {
    expect(combineUtc(2026, 8, 7, '13:30')).toEqual(new Date('2026-09-07T13:30:00.000Z'));
  });

  test('test_utcDayRange_returnsHalfOpenDayBoundary', () => {
    const { start, end } = utcDayRange(new Date('2026-09-07T13:00:00.000Z'));
    expect(start).toEqual(new Date('2026-09-07T00:00:00.000Z'));
    expect(end).toEqual(new Date('2026-09-08T00:00:00.000Z'));
  });

  test('test_timeToSeconds_convertsHoursMinutesSeconds', () => {
    expect(timeToSeconds('01:02:03')).toBe(3723);
  });
});
