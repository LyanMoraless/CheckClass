import { addUtcDays, addUtcMonths, utcMidnight } from '../../common/utc-date.util';
import { AccumulatedFrequencyPeriod } from '../config/accumulated-frequency-period.enum';

// Reporting-period slicing for Controle B (RULE-FREQ-02), as decided in the
// approved technology decision for Frente 06: the turma's term
// (class_group.term_start_date → term_end_date) is divided into slices of
// equal length in CALENDAR MONTHS counted from term_start_date, and there is
// no academic-calendar table — the boundaries are computed, never stored.
// A dedicated academic_period table was considered and rejected there: it
// would reverse the standing decision of not modelling "Período Letivo"
// separately, to solve a problem (institution-specific irregular period dates
// aligned to holidays/exams) that no business rule asks for today.
//
// Pure function on purpose: no tenant context, no manager, no clock of its
// own (the reference date is an argument). Everything the calculation engine
// does with a window is derived from here, so this is also the single place
// where "there is no window" is decided.

export interface ReportingPeriodWindow {
  // Both inclusive, both UTC midnight — the same date-only convention the
  // rest of this codebase already uses for class_group's term columns.
  startDate: Date;
  endDate: Date;
}

const MONTHS_PER_PERIOD: Record<AccumulatedFrequencyPeriod, number> = {
  [AccumulatedFrequencyPeriod.BIMESTER]: 2,
  [AccumulatedFrequencyPeriod.TRIMESTER]: 3,
  [AccumulatedFrequencyPeriod.SEMESTER]: 6,
};

// The reporting-period window that `referenceDate` falls into, or null when
// there is none. Null is never a degenerate window: it is propagated by the
// engine as `no_period_window` (approved addendum, section B4), and inventing
// a default window instead would let the system compute a frequency — and a
// failure warning — out of data it does not have.
//
// Three ways to get null, all deliberate:
//   1. term_start_date or term_end_date is NULL. Both columns are nullable
//      (a turma can be created before its term is defined) and without them
//      the slicing has no input at all.
//   2. term_end_date precedes term_start_date — inconsistent registration,
//      treated the same way as missing dates rather than guessed at.
//   3. referenceDate is outside the term. Outside the term there is no
//      CURRENT reporting period: before it starts nothing has been measured
//      yet, and after it ends the warning of the last period is frozen with
//      its last known percentage (approved answer 6) while the display filter
//      of GET /v1/me/warnings hides it once term_end_date has passed.
export function currentPeriodWindow(
  termStartDate: Date | null,
  termEndDate: Date | null,
  period: AccumulatedFrequencyPeriod,
  referenceDate: Date,
): ReportingPeriodWindow | null {
  if (!termStartDate || !termEndDate) {
    return null;
  }

  const termStart = utcMidnight(termStartDate);
  const termEnd = utcMidnight(termEndDate);
  const reference = utcMidnight(referenceDate);
  if (termEnd.getTime() < termStart.getTime()) {
    return null;
  }
  if (reference.getTime() < termStart.getTime() || reference.getTime() > termEnd.getTime()) {
    return null;
  }

  const months = MONTHS_PER_PERIOD[period];
  for (let sliceIndex = 0; ; sliceIndex += 1) {
    const sliceStart = addUtcMonths(termStart, sliceIndex * months);
    const nextSliceStart = addUtcMonths(termStart, (sliceIndex + 1) * months);

    // The LAST slice absorbs the remainder: when the next boundary would fall
    // past the end of the term, this slice runs to term_end_date instead of
    // to its own nominal length. That single branch also covers the case of a
    // configured period longer than the whole term — slice 0 is then the only
    // slice, and it is the whole term.
    const isLastSlice = nextSliceStart.getTime() > termEnd.getTime();
    const sliceEnd = isLastSlice ? termEnd : addUtcDays(nextSliceStart, -1);

    if (reference.getTime() <= sliceEnd.getTime()) {
      return { startDate: sliceStart, endDate: sliceEnd };
    }
    // Guaranteed to terminate: the reference date is inside the term, and the
    // last slice always ends exactly at term_end_date.
    if (isLastSlice) {
      return { startDate: sliceStart, endDate: sliceEnd };
    }
  }
}

export function sameWindow(left: ReportingPeriodWindow, right: ReportingPeriodWindow): boolean {
  return (
    left.startDate.getTime() === right.startDate.getTime() && left.endDate.getTime() === right.endDate.getTime()
  );
}
