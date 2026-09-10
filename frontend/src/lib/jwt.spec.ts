import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, getJwtExpiryMs } from './jwt';

// Frente 12 (device-binding) needs the token's `exp` claim client-side to
// schedule Gatilho 4's checkout timer (Tech Decision B) — these tests only
// cover the pure decode logic, not any network/session behavior.
describe('jwt', () => {
  function buildToken(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    return `${header}.${body}.signature-not-checked-client-side`;
  }

  describe('decodeJwtPayload', () => {
    it('test_decodeJwtPayload_wellFormedToken_returnsPayload', () => {
      const token = buildToken({ sub: 'person-1', exp: 1234567890 });
      expect(decodeJwtPayload(token)).toEqual({ sub: 'person-1', exp: 1234567890 });
    });

    it('test_decodeJwtPayload_missingSegments_returnsNull', () => {
      expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    });

    it('test_decodeJwtPayload_malformedBase64_returnsNull', () => {
      expect(decodeJwtPayload('header.not-valid-base64!!!.signature')).toBeNull();
    });
  });

  describe('getJwtExpiryMs', () => {
    it('test_getJwtExpiryMs_secondsClaim_convertsToMilliseconds', () => {
      const token = buildToken({ exp: 1000 });
      expect(getJwtExpiryMs(token)).toBe(1_000_000);
    });

    it('test_getJwtExpiryMs_noExpClaim_returnsNull', () => {
      const token = buildToken({ sub: 'person-1' });
      expect(getJwtExpiryMs(token)).toBeNull();
    });

    it('test_getJwtExpiryMs_unparseableToken_returnsNull', () => {
      expect(getJwtExpiryMs('garbage')).toBeNull();
    });
  });
});
