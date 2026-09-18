import { IsBoolean, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// RULE-PRES-09 — the discrete afastamento-transition reading the App
// Mobile's monitor (mobile/src/features/class-monitoring/use-class-monitoring.ts)
// already produces (see class-monitoring-api.ts's ClassMonitoringReading,
// same field names/shapes). personId/tenantId are deliberately absent — same
// idiom as AppCheckinDto, resolved exclusively from the caller's own
// verified JWT (JwtAuthGuard sets request.personId/tenantId), never trusted
// from the body.
export class ReportClassMonitoringSignalDto {
  // Client-generated idempotency key, same purpose/shape as AppCheckinDto's
  // (RULE-ATT-10-style resend tolerance) — protects a retried submission
  // (e.g. a flaky network causing the app to send the same reading twice)
  // from being recorded twice. raw_location_signal.idempotency_key is
  // UNIQUE(tenant_id, idempotency_key) from creation (AddRawLocationSignal
  // migration), so no schema change was needed for this.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idempotencyKey: string;

  // Which in-progress session this reading belongs to — the app already
  // knows this (GET /v1/me/schedule, see use-class-monitoring.ts), so unlike
  // AppCheckinDto's own session resolution (auto-discovered server-side),
  // this endpoint accepts it directly. The service still re-validates it
  // server-side against the caller's own enrollments and the server clock
  // before accepting the signal — see ClassMonitoringSignalService.report.
  @IsUUID()
  classSessionId: string;

  // RULE-PRES-09: required, not optional like AppCheckinDto's own
  // latitude/longitude — unlike RULE-PRES-15's caminho alternativo student
  // (tag-only, consent refused), who never has the App Mobile even start
  // this monitor at all (useClassMonitoringSession's own gate on
  // hasActiveConsent), there is no legitimate caller of this endpoint with
  // no coordinates to report.
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  // Mirrors raw_location_signal.accuracy_meters (NOT NULL numeric(7,2)).
  // ClassMonitoringReading.accuracyMeters is typed `number | null` on the
  // mobile side (LocationObjectCoords.accuracy is nullable on Expo web,
  // practically never null on a real iOS/Android device) — resolved as a
  // DTO-level requirement rather than inventing a sentinel/default for
  // "unknown accuracy": class-monitoring-api.ts drops a reading with a null
  // accuracy before ever calling this endpoint (same "some readings lost is
  // fine" tolerance RULE-PRES-09's own "ausência de sinal não é tratada como
  // afastamento" already establishes for missing readings in general), so
  // this field is never actually null on the wire.
  @IsNumber()
  @Min(0)
  accuracyMeters: number;

  // Either anti-spoofing layer folded into one flag by the client (expo-location's
  // own `mocked` field OR Talsec freeRASP's locationSpoofing threat) — mirrors
  // raw_location_signal.is_mocked exactly, same shape ClassMonitoringReading
  // already uses.
  @IsBoolean()
  isMocked: boolean;

  // No capturedAt field, deliberately, same discipline as AppCheckinDto's own
  // (RULE-PRES-02): the server's own request-received clock is the only
  // source of truth for raw_location_signal.captured_at — see
  // ClassMonitoringSignalService.report.
}
