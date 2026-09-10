// Minimal, dependency-free JWT payload reader. Only ever applied to the
// access token this app already stores and trusts itself (auth-storage.ts)
// — never used to validate a signature (no client-side code should ever do
// that); the only purpose here is reading the already-verified `exp` claim
// so device-binding can schedule Gatilho 4's token_expired checkout timer
// (Tech Decision B, "o navegador também sabe o exp do próprio JWT").
export interface DecodedJwtPayload {
  exp?: number;
  [claim: string]: unknown;
}

export function decodeJwtPayload(token: string): DecodedJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded)) as DecodedJwtPayload;
  } catch {
    return null;
  }
}

// Returns the token's `exp` claim as an epoch-millisecond timestamp, or null
// when it can't be read — callers treat null as "unknown, don't schedule a
// timer for it" rather than throwing.
export function getJwtExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }
  return payload.exp * 1000;
}
