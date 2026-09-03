// RULE-INST-14: a Turma studies N matérias, so every turma-level screen shows
// a set instead of a single name — and zero matérias is a real, valid state
// (RULE-INST-08 addendum: a turma survives losing its last one). Rendering
// that as an empty cell would read like missing data, so it gets the same
// explicit dash the rest of the UI uses for "nothing here".
export function formatSubjectNames(names: string[]): string {
  return names.length === 0 ? '—' : names.join(', ');
}
