import { apiClient } from '../../lib/api-client';
import { generateIdempotencyKey } from '../../lib/idempotency-key';

// RULE-PRES-09's discrete afastamento-transition signal — what use-class-monitoring.ts
// produces once it decides a reading is worth reporting.
//
// POST /v1/class-monitoring-signals (backend/src/modules/class-monitoring-signal/) —
// person-JWT-authenticated, same family as POST /v1/app-checkin (checkin-api.ts):
// closes the gap this file's own previous version flagged (a stub that logged and
// dropped every reading because the backend endpoint did not exist yet — see the
// Backend Implementation Summary for "endpoint de ingestão de raw_location_signal",
// architecture-overview.md). `raw_location_signal` (signal_type = 'class_monitoring')
// already existed as a table/entity, and LocationVerificationService.evaluateDepartureFromClassLocation
// already reads it (backend/src/modules/location-verification/location-verification.service.ts)
// — this function is now that endpoint's only mobile caller.
export interface ClassMonitoringReading {
  classSessionId: string;
  latitude: number;
  longitude: number;
  // Mirrors raw_location_signal.accuracy_meters — null when the OS didn't report one
  // (LocationObjectCoords.accuracy is nullable on web). ReportClassMonitoringSignalDto's
  // own field is required (NOT NULL in the DB), so a null reading here is dropped before
  // ever calling the endpoint, never coerced to a made-up sentinel value — see below.
  accuracyMeters: number | null;
  // Either anti-spoofing layer (expo-location's own `mocked` field OR freeRASP's
  // locationSpoofing threat, mobile-security-signals.ts) folded into one flag — mirrors
  // raw_location_signal.is_mocked exactly. No capturedAt field: RULE-PRES-02 makes the
  // server clock the only source of truth for timing, same discipline AppCheckinDto
  // already applies; the endpoint stamps this itself, never trusting a client-supplied
  // timestamp.
  isMocked: boolean;
}

// Fire-and-forget by design, same posture as the rest of this monitor (see
// use-class-monitoring.ts's own comments): RULE-PRES-09's own "ausência de sinal de
// localização não é tratada como afastamento" (RULE-PRES-08 caso 3, pendência) already
// establishes that a missing reading is tolerated, not an error condition to surface to
// the student — unlike checkin-api.ts's submitCheckIn, there is no persisted offline
// retry queue here; a reading that fails to send (or is dropped before sending) is
// simply lost, and the next watchPositionAsync callback produces the next one.
export function reportClassMonitoringReading(reading: ClassMonitoringReading): void {
  if (reading.accuracyMeters === null) {
    // ReportClassMonitoringSignalDto.accuracyMeters has no null-handling of its own —
    // see that DTO's own comment for why "drop the reading" was chosen over inventing an
    // "unknown accuracy" sentinel value: this case is practically only reachable on Expo
    // web, never on a real iOS/Android device, so there was no established convention to
    // reuse for it.
    if (__DEV__) {
      console.warn('[class-monitoring] reading dropped — OS reported no accuracy', reading);
    }
    return;
  }

  void apiClient
    .post('/v1/class-monitoring-signals', {
      idempotencyKey: generateIdempotencyKey(),
      classSessionId: reading.classSessionId,
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracyMeters: reading.accuracyMeters,
      isMocked: reading.isMocked,
    })
    .catch((error) => {
      if (__DEV__) {
        console.warn('[class-monitoring] failed to report reading', error);
      }
    });
}
