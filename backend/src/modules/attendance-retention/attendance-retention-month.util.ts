// Frente 10 — calendar-month boundaries for the RULE-RET-01/02 batch jobs.
// Pure functions, no tenant context, no clock of its own (the reference
// date is always an argument) — same posture as
// attendance-frequency/reporting-period.util.ts, for the same reason: this
// is the one place "which month" and "is this month old enough" are decided,
// so every caller (closure, purge, annual consolidation, CLI scripts) agrees
// by construction instead of by convention.

export interface AttendanceRetentionMonth {
  year: number;
  month: number; // 1-12
}

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

// Parses the CLI scripts' own "YYYY-MM" argument shape. Throws a plain Error
// (not a Nest HTTP exception — there is no HTTP request here, this only ever
// runs from an unattended script) with a message the script's own catch
// handler prints as-is.
export function parseYearMonth(yearMonth: string): AttendanceRetentionMonth {
  const match = YEAR_MONTH_PATTERN.exec(yearMonth);
  if (!match) {
    throw new Error(`Invalid yearMonth "${yearMonth}" — expected the shape "YYYY-MM"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid yearMonth "${yearMonth}" — month must be between 01 and 12`);
  }
  return { year, month };
}

// The UTC calendar-month boundaries for (year, month), as a half-open
// [monthStart, monthEndExclusive) instant range — the same shape
// utc-date.util.ts's utcDayRange already uses for a single day, one level up.
export function monthBounds(year: number, month: number): { monthStart: Date; monthEndExclusive: Date } {
  return {
    monthStart: new Date(Date.UTC(year, month - 1, 1)),
    monthEndExclusive: new Date(Date.UTC(year, month, 1)),
  };
}

// RULE-RET-01: "fim do mês + 60 dias <= hoje". monthEndExclusive is already
// the instant right after the month's last calendar day, so adding the
// live-window length directly to IT is the exact boundary — no separate
// "last day of month" computation, no off-by-one.
export function isMonthPastLiveWindow(monthEndExclusive: Date, referenceDate: Date, liveWindowDays: number): boolean {
  const eligibleFrom = monthEndExclusive.getTime() + liveWindowDays * 24 * 60 * 60 * 1000;
  return eligibleFrom <= referenceDate.getTime();
}
