import { formatAttendanceRate, formatSubjectNames } from '../leadership-class-groups-format';

test('formatSubjectNames_withNoSubjects_returnsDash', () => {
  expect(formatSubjectNames([])).toBe('—');
});

test('formatSubjectNames_withOneSubject_returnsItUnchanged', () => {
  expect(formatSubjectNames(['Cálculo I'])).toBe('Cálculo I');
});

test('formatSubjectNames_withMultipleSubjects_joinsWithCommaAndSpace', () => {
  expect(formatSubjectNames(['Cálculo I', 'Física II', 'Química'])).toBe('Cálculo I, Física II, Química');
});

test('formatAttendanceRate_whenNull_returnsDash', () => {
  expect(formatAttendanceRate(null)).toBe('—');
});

test('formatAttendanceRate_withRate_formatsAsPercentageWithOneDecimal', () => {
  expect(formatAttendanceRate(87.5)).toBe('87.5%');
});

test('formatAttendanceRate_withIntegerRate_stillShowsOneDecimal', () => {
  expect(formatAttendanceRate(100)).toBe('100.0%');
});
