import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// personId and tenantId are deliberately absent — resolved exclusively from
// the caller's own verified JWT (JwtAuthGuard sets request.personId/tenantId),
// never trusted from the body. Same idiom as IngestionEventEnvelopeDto
// omitting tenant_id/device_id, applied here to the person-authenticated
// equivalent (RULE-ATT-06's confirmed note).
export class AppCheckinDto {
  // Client-generated idempotency key (Pendente — pending-decisions.md's
  // "Idempotency key no endpoint de check-in via app", now decided): same
  // purpose and shape as the device-ingestion contract's idempotencyKey
  // (RULE-ATT-10) — protects a retried/offline-queued submission from being
  // recorded twice. Persisted on the same raw_identification_event table and
  // constraint (UNIQUE(tenant_id, idempotency_key), ScopeIdempotencyKeyToTenant)
  // the device path already uses, since app check-in feeds the same table.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idempotencyKey: string;

  // Security/code-review finding + user decision (2026-08-22): a
  // client-supplied `capturedAt` used to live here and was fed straight into
  // AppCheckinService's session resolution — which let any enrolled student
  // submit a check-in for a session they'd actually skipped, just by
  // claiming a timestamp inside that session's window, with no bound on how
  // far in the past. Deliberately removed rather than kept-but-ignored: it
  // had no purpose here other than session resolution/authorization, and
  // the decided fix is "no tolerance — check-in must be effectively
  // real-time", i.e. the server's own request-received clock is now the
  // ONLY input to session resolution (see AppCheckinService.submit). If a
  // future, genuinely different, non-authoritative need shows up (e.g. pure
  // informational logging of "when the device thinks the tap happened"), it
  // must be reintroduced as its own field, explicitly documented as never
  // influencing session resolution, deduplication, or any pipeline
  // decision — not silently restored to this role.

  // RULE-PRES-01(b): dado espacial aceito do cliente, mesma disciplina já
  // usada para tagCode/idempotencyKey — but the DECISION of whether it
  // counts as presence is never the client's: AppCheckinService.submit
  // treats a coordinate outside the institution's configured radius (or
  // absent entirely) as a failed geo gate, same fail-closed posture as
  // isWithinInstitutionalRadius's own "no config configured" default.
  //
  // Optional, not required, on purpose: RULE-PRES-14/15's caminho
  // alternativo student (location consent refused/revoked) never has the
  // App Mobile even attempt to collect a location fix at all ("Consulta o
  // consentimento de localização antes de sequer ligar o monitor" —
  // architecture-overview.md's App Mobile component card) — the request
  // body legitimately has no coordinates for that caller. Marking these
  // @IsNotEmpty would 400 that legitimate case before the service ever gets
  // a chance to route it through RULE-PRES-14's consent gate instead of the
  // rede/geo AND. A present-but-active-consent caller missing coordinates is
  // still correctly fail-closed inside the service (see submit()'s own
  // comment), not by DTO validation.
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
