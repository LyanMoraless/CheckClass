import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
}
