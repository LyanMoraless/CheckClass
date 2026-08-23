import * as Crypto from 'expo-crypto';

// Client-generated idempotency key for POST /v1/app-checkin (AppCheckinDto.idempotencyKey)
// — protects a retried/offline-queued submission from being recorded twice (RULE-ATT-10's
// dedup semantics, reused as-is for the app-checkin path).
export function generateIdempotencyKey(): string {
  return Crypto.randomUUID();
}
