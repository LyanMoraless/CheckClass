// UTC convention for combining a date-only value with a `time` column into a
// timestamptz — this project has no "institution timezone" concept yet (a
// real, flagged gap), so treating the wall-clock date+time as UTC is the
// simplest option that stays internally consistent deployment-wide, as long
// as the app runs with TZ=UTC (the common Docker/CI default; nothing in this
// codebase sets a different TZ). Extraction uses UTC getters to mirror how
// the *write* side already builds these Date values everywhere in this
// codebase (ClassGroupService.create's `new Date(input.termStartDate)` and
// HolidayService.create's `new Date(input.date)` both parse a date-only ISO
// string, which the JS spec defines as UTC midnight, not local midnight) — so
// read-back extraction via UTC getters is the correct inverse of that,
// regardless of what local TZ the Node process happens to run under.
//
// Originally introduced inline in ClassScheduleService (RULE-INST-04's
// generateSessions); promoted here so HolidayService (cancel same-day
// sessions, RULE-INST-04 third-round item #4) and
// ScheduleRegenerationService (RULE-INST-04 third-round item #5) share the
// exact same convention instead of re-deriving it.
export function extractUtcYmd(date: Date): { year: number; month: number; day: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Convenience composition of the two functions above, for the common case of
// "give me a comparable calendar-date key straight from a Date".
export function dateKeyOfUtc(date: Date): string {
  const { year, month, day } = extractUtcYmd(date);
  return dateKey(year, month, day);
}

export function combineUtc(year: number, month: number, day: number, time: string): Date {
  const [hours, minutes, seconds] = time.split(':').map((part) => Number(part));
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds || 0));
}

// The UTC calendar-day boundaries `date` falls on, as a half-open
// [start, end) instant range — the DB-query-side counterpart to
// combineUtc/dateKey above, for callers that need to filter a `timestamptz`
// column by "falls on this calendar date" without loading every row into
// memory first (HolidayService's same-day session cancellation).
export function utcDayRange(date: Date): { start: Date; end: Date } {
  const { year, month, day } = extractUtcYmd(date);
  return { start: new Date(Date.UTC(year, month, day)), end: new Date(Date.UTC(year, month, day + 1)) };
}

export function timeToSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map((part) => Number(part));
  return hours * 3600 + minutes * 60 + (seconds || 0);
}
