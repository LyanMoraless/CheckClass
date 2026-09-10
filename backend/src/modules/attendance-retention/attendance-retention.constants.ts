// Frente 10 — Conformidade LGPD e retenção (RULE-RET-01/02). Shared numbers,
// kept in one place instead of re-derived at each call site.

// RULE-RET-01: data stays live/directly queryable for 60 days from the
// event/session date before a monthly closure moves it out of the live
// database. Used by the monthly closure eligibility check, and by the
// self-service "archived" indicator (AttendanceRetentionArchiveLookupService)
// — the same number both read.
export const ATTENDANCE_RETENTION_LIVE_WINDOW_DAYS = 60;

// RULE-RET-02: once 12 monthly closures accumulate (still un-consolidated),
// the annual consolidation folds them into one annual closure and erases
// their content. "12" is read here as a ROLLING WINDOW (the oldest 12
// un-consolidated monthly documents), not calendar-year alignment — Frente
// 10 architecture Open Question 6 leaves this unconfirmed; this constant is
// the literal cardinality RULE-RET-02 states, not a resolution of that
// question.
export const ATTENDANCE_RETENTION_MONTHS_PER_ANNUAL_CONSOLIDATION = 12;

// Same 16 KB ceiling as the attendance_closure_document_summary_size_check
// CHECK the Database Agent added in the AddAttendanceRetention migration —
// kept here too so the closure service can fail fast, with a clear message,
// in application code instead of surfacing a raw DB constraint violation.
export const ATTENDANCE_CLOSURE_DOCUMENT_SUMMARY_MAX_BYTES = 16384;
