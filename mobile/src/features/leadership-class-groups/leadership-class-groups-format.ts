// Pure formatting helpers pulled out of the two screens in this feature so
// they're unit-testable without rendering anything — same idiom as
// warnings-feed.ts.

// RULE-INST-14: a turma studies N matérias, so this always joins a set
// instead of showing a single name — same behavior, same empty-set copy, as
// the web dashboard's lib/subject-names.ts#formatSubjectNames.
export function formatSubjectNames(names: string[]): string {
  return names.length === 0 ? '—' : names.join(', ');
}

// Mirrors the web dashboard's class-group-attendance-page.tsx rendering:
// null means no session has been evaluated yet for this student in this
// turma (nothing to compute a rate from), which is a real, valid state — not
// an error — so it renders as an explicit dash rather than "0%" or "NaN%".
export function formatAttendanceRate(rate: number | null): string {
  return rate === null ? '—' : `${rate.toFixed(1)}%`;
}
