// RULE-PRES-09's discrete afastamento-transition signal — what use-class-monitoring.ts
// produces once it decides a reading is worth reporting.
//
// GAP, confirmed by grepping backend/src (not presumed): there is NO backend ingestion
// endpoint for this signal yet. `raw_location_signal` (signal_type = 'class_monitoring')
// already exists as a table/entity, and LocationVerificationService.evaluateDepartureFromClassLocation
// already READS it (backend/src/modules/location-verification/location-verification.service.ts),
// but nothing in the backend WRITES to it — that service's own header comment says so
// explicitly: "persistence is whichever caller ingests the app's discrete afastamento
// transition events, not built in this round". This is a real, pre-existing backend gap,
// not something introduced by this round of mobile work.
//
// Flagged to the Orchestrator (see the Mobile Implementation Summary's "Flagged issues")
// rather than invented: this agent does not own the backend contract (endpoint path, auth,
// idempotency-key scoping, request/response shape) — designing one here would mean deciding
// backend architecture, which is explicitly out of scope. This function is intentionally a
// stub that captures the payload shape the future endpoint will need, so
// use-class-monitoring.ts's own logic (gating, throttling, session-scoping) can be built and
// tested end-to-end now, without silently starting to call a path that doesn't exist or
// guessing at a contract nobody has designed.
export interface ClassMonitoringReading {
  classSessionId: string;
  latitude: number;
  longitude: number;
  // Mirrors raw_location_signal.accuracy_meters — null when the OS didn't report one
  // (LocationObjectCoords.accuracy is nullable on web).
  accuracyMeters: number | null;
  // Either anti-spoofing layer (expo-location's own `mocked` field OR freeRASP's
  // locationSpoofing threat, mobile-security-signals.ts) folded into one flag — mirrors
  // raw_location_signal.is_mocked exactly. No capturedAt field: RULE-PRES-02 makes the
  // server clock the only source of truth for timing, same discipline AppCheckinDto
  // already applies; a future ingestion endpoint would stamp this itself, not trust a
  // client-supplied timestamp.
  isMocked: boolean;
}

export function reportClassMonitoringReading(reading: ClassMonitoringReading): void {
  if (__DEV__) {
    console.warn('[class-monitoring] backend ingestion endpoint for RULE-PRES-09 readings does not exist yet — reading dropped, not sent', reading);
  }
}
