// RULE-FREQ-03 addendum (2026-09-03): how far above the minimum the
// approaching_minimum warning starts. Ten percentage points, added to
// attendance_config.min_accumulated_frequency_percentage — minimum 60 warns
// at 70, minimum 75 warns at 85.
//
// This being a TypeScript constant is an EXCEPTION to the project default,
// and the exception has to justify itself where it lives, because the default
// points the other way: configurable-parameters.md's standing rule is that
// attendance thresholds are never fixed values in code. The user confirmed
// this particular distance as a single value, identical for every
// institution, explicitly not configurable by the administrator and with no
// configuration screen — so:
//
// - a column in attendance_config would offer per-scope configuration the
//   rule says does not exist, and would need a UI nobody is going to build;
// - an environment variable would be worse: per-deploy configuration in
//   disguise, contradicting "the same for every institution" while looking
//   like it obeys the no-constants rule.
//
// configurable-parameters.md has already been corrected to record this
// exception (the superseded bullet is struck through there). If the value is
// ever made configurable, the warning rows are ready: each one persists the
// min_percentage_applied it was written with, so old warnings stay
// explainable.
export const FREQUENCY_WARNING_MARGIN_POINTS = 10;
