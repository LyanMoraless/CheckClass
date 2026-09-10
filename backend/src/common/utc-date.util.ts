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

// Normalizes a value read off a `type: 'date'` column (class_group.term_start_
// date/term_end_date, the only two in this codebase read back through
// TypeORM before being handed to the UTC helpers above) into a real `Date`
// instance, while preserving null/undefined AS null instead of collapsing
// them into the Unix epoch. This distinction is load-bearing: `new
// Date(null)` is `1970-01-01T00:00:00.000Z` — truthy, not null — which would
// silently defeat every "no term dates yet" freeze/guard check downstream
// (reporting-period.util.ts's currentPeriodWindow, RULE-FREQ-08 approved
// answer 6) if a caller ever blindly wrapped with `new Date(...)` instead of
// this.
//
// The reason this exists at all (Testing Agent finding, confirmed against a
// real Postgres instance): a raw `manager.query()` SELECT on a `date` column
// returns a genuine `Date`, but `repository.findOneBy()`/`manager.
// getRepository(...)` on that SAME column returns a plain STRING
// ("2026-08-01") — a real driver-level inconsistency, not something this
// project's own code controls. Every call site that reads
// classGroup.termStartDate/termEndDate off a repository-loaded
// ClassGroupEntity and feeds it to extractUtcYmd/utcMidnight/
// currentPeriodWindow must go through this first (or, for a context where
// the value is already guaranteed non-null by an earlier guard, `new
// Date(...)` directly is equivalent and reads a little lighter — see e.g.
// ScheduleRegenerationService.regenerateFutureSessions).
export function hydrateNullableDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
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

// The UTC midnight instant of the calendar day `date` falls on — the
// normalization step every caller of the two month/day helpers below needs
// first, since a `date` column read back through TypeORM carries whatever
// time component the driver gave it.
export function utcMidnight(date: Date): Date {
  const { year, month, day } = extractUtcYmd(date);
  return new Date(Date.UTC(year, month, day));
}

export function addUtcDays(date: Date, days: number): Date {
  const { year, month, day } = extractUtcYmd(date);
  return new Date(Date.UTC(year, month, day + days));
}

// Calendar-month arithmetic for Controle B's reporting-period slicing
// (RULE-FREQ-02: bimester/trimester/semester = 2/3/6 calendar months from
// class_group.term_start_date). No date library is involved anywhere in this
// project — the approved technology decision for Frente 06 explicitly
// rejected adding one — so the one non-obvious case is handled here, once:
//
// The day-of-month is CLAMPED to the target month's length instead of being
// left to Date.UTC's overflow. Date.UTC(2026, 1, 31) silently becomes 3 March,
// so a term starting on the 31st would have every later slice boundary drift
// into the following month, and two slices in a row could then claim the same
// days. Clamping keeps each boundary inside the month it names (31 Jan + 1
// month = 28 Feb), which is also what every date library does.
export function addUtcMonths(date: Date, months: number): Date {
  const { year, month, day } = extractUtcYmd(date);
  const daysInTargetMonth = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + months, Math.min(day, daysInTargetMonth)));
}

export function timeToSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map((part) => Number(part));
  return hours * 3600 + minutes * 60 + (seconds || 0);
}
