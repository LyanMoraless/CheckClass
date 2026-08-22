import { UnauthorizedException } from '@nestjs/common';
import { MobileAuthService } from './mobile-auth.service';

// Orchestrates login/refresh/logout for the App Mobile auth flow (Security
// Agent's "Decisão de segurança — Autenticação Mobile", approved
// 2026-08-22). AuthService and RefreshTokenService are mocked at their
// public seams (both already have their own unit specs covering their
// internals) — tenantContext.runWithTenant is mocked to just run its
// callback, same as TenantBootstrapService's spec.
describe('MobileAuthService', () => {
  function buildService(
    overrides: {
      authService?: Partial<{ login: jest.Mock }>;
      jwtService?: Partial<{ sign: jest.Mock }>;
      refreshTokenService?: Partial<{
        resolveByHash: jest.Mock;
        lockById: jest.Mock;
        issue: jest.Mock;
        rotate: jest.Mock;
        revoke: jest.Mock;
        revokeAllForPerson: jest.Mock;
      }>;
    } = {},
  ) {
    const authService = {
      login: jest.fn().mockResolvedValue({ personId: 'person-1', tenantId: 'tenant-a-id' }),
      ...overrides.authService,
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('signed-access-token'),
      ...overrides.jwtService,
    };
    const refreshTokenService = {
      resolveByHash: jest.fn(),
      // Default: the locked re-read mirrors whatever resolveByHash resolved
      // to, in the entity's camelCase shape — individual tests override this
      // when they need the locked read to diverge from the initial snapshot
      // (that divergence is exactly what the race-condition fix relies on).
      lockById: jest.fn().mockImplementation((tokenId: string) =>
        Promise.resolve({
          id: tokenId,
          personId: 'person-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ),
      issue: jest.fn().mockResolvedValue({ tokenId: 'new-token-1', rawToken: 'new-raw-token' }),
      rotate: jest.fn().mockResolvedValue(undefined),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllForPerson: jest.fn().mockResolvedValue(undefined),
      ...overrides.refreshTokenService,
    };
    const tenantContext = {
      runWithTenant: jest.fn((_tenantId: string, callback: () => Promise<unknown>) => callback()),
    };

    const service = new MobileAuthService(
      authService as never,
      jwtService as never,
      refreshTokenService as never,
      tenantContext as never,
    );

    return { service, authService, jwtService, refreshTokenService, tenantContext };
  }

  describe('login', () => {
    test('test_login_validCredentials_issuesAccessAndRefreshTokenForResolvedTenant', async () => {
      const { service, authService, jwtService, refreshTokenService, tenantContext } = buildService();

      const result = await service.login('11122233344', 'correct password');

      expect(authService.login).toHaveBeenCalledWith('11122233344', 'correct password');
      expect(tenantContext.runWithTenant).toHaveBeenCalledWith('tenant-a-id', expect.any(Function));
      expect(jwtService.sign).toHaveBeenCalledWith(
        { personId: 'person-1', tenantId: 'tenant-a-id' },
        { expiresIn: '20m' },
      );
      expect(refreshTokenService.issue).toHaveBeenCalledWith('person-1');
      expect(result).toEqual({ accessToken: 'signed-access-token', refreshToken: 'new-raw-token' });
    });

    test('test_login_invalidCredentials_propagatesAuthServiceRejectionWithoutIssuingTokens', async () => {
      const { service, refreshTokenService } = buildService({
        authService: { login: jest.fn().mockRejectedValue(new UnauthorizedException('Invalid credentials')) },
      });

      await expect(service.login('11122233344', 'wrong password')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const validResolvedToken = {
      refresh_token_id: 'presented-token-1',
      tenant_id: 'tenant-a-id',
      person_id: 'person-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      replaced_by_token_id: null,
    };

    test('test_refresh_validUnexpiredNotRevokedToken_rotatesAndReturnsNewPair', async () => {
      const { service, refreshTokenService, jwtService } = buildService({
        refreshTokenService: { resolveByHash: jest.fn().mockResolvedValue(validResolvedToken) },
      });

      const result = await service.refresh('presented-raw-token');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { personId: 'person-1', tenantId: 'tenant-a-id' },
        { expiresIn: '20m' },
      );
      expect(refreshTokenService.lockById).toHaveBeenCalledWith('presented-token-1');
      expect(refreshTokenService.issue).toHaveBeenCalledWith('person-1');
      expect(refreshTokenService.rotate).toHaveBeenCalledWith('presented-token-1', 'new-token-1');
      expect(result).toEqual({ accessToken: 'signed-access-token', refreshToken: 'new-raw-token' });
    });

    test('test_refresh_unknownToken_throwsUnauthorizedWithoutRevokingAnything', async () => {
      const { service, refreshTokenService } = buildService({
        refreshTokenService: { resolveByHash: jest.fn().mockResolvedValue(undefined) },
      });

      await expect(service.refresh('unknown-token')).rejects.toThrow(new UnauthorizedException('Invalid refresh token'));
      expect(refreshTokenService.lockById).not.toHaveBeenCalled();
      expect(refreshTokenService.revoke).not.toHaveBeenCalled();
      expect(refreshTokenService.revokeAllForPerson).not.toHaveBeenCalled();
    });

    // Code-review finding — race condition in refresh-token rotation:
    // lockById's return is now what drives every decision below, NOT
    // resolveByHash's earlier (potentially stale) snapshot — this is exactly
    // the seam the row-lock fix relies on to close the TOCTOU window.
    test('test_refresh_lockedRowNotFound_throwsUnauthorizedWithoutRevokingAnything', async () => {
      const { service, refreshTokenService } = buildService({
        refreshTokenService: {
          resolveByHash: jest.fn().mockResolvedValue(validResolvedToken),
          lockById: jest.fn().mockResolvedValue(null),
        },
      });

      await expect(service.refresh('vanished-token')).rejects.toThrow('Invalid refresh token');
      expect(refreshTokenService.revoke).not.toHaveBeenCalled();
      expect(refreshTokenService.revokeAllForPerson).not.toHaveBeenCalled();
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });

    test('test_refresh_expiredToken_marksItRevokedAndThrowsUnauthorized', async () => {
      const expiredLockedToken = {
        id: 'presented-token-1',
        personId: 'person-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      };
      const { service, refreshTokenService } = buildService({
        refreshTokenService: {
          resolveByHash: jest.fn().mockResolvedValue(validResolvedToken),
          lockById: jest.fn().mockResolvedValue(expiredLockedToken),
        },
      });

      await expect(service.refresh('expired-raw-token')).rejects.toThrow('Invalid refresh token');
      expect(refreshTokenService.revoke).toHaveBeenCalledWith('presented-token-1');
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });

    test('test_refresh_alreadyRevokedToken_triggersReuseDetectionRevokingWholeFamilyAndThrowsUnauthorized', async () => {
      const reusedLockedToken = {
        id: 'presented-token-1',
        personId: 'person-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      };
      const { service, refreshTokenService } = buildService({
        refreshTokenService: {
          resolveByHash: jest.fn().mockResolvedValue(validResolvedToken),
          lockById: jest.fn().mockResolvedValue(reusedLockedToken),
        },
      });

      await expect(service.refresh('already-used-raw-token')).rejects.toThrow('Invalid refresh token');
      expect(refreshTokenService.revokeAllForPerson).toHaveBeenCalledWith('person-1');
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
      expect(refreshTokenService.rotate).not.toHaveBeenCalled();
    });

    // Code-review finding — race condition in refresh-token rotation,
    // simulated at the unit level: a concurrent refresh() call that rotated
    // this same row in between resolveByHash's (stale) read and this call's
    // locked re-read must be treated as reuse, exactly like a genuinely
    // already-used token — proving the fix actually closes the race and not
    // just re-validates the same stale data twice.
    test('test_refresh_rowRotatedByConcurrentCallBetweenResolveByHashAndLock_triggersReuseDetection', async () => {
      const concurrentlyRotatedLockedToken = {
        id: 'presented-token-1',
        personId: 'person-1',
        // resolveByHash saw revoked_at: null (validResolvedToken) — but by
        // the time this call acquires the lock, a concurrent refresh() has
        // already committed its own rotation of this exact row.
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      };
      const { service, refreshTokenService } = buildService({
        refreshTokenService: {
          resolveByHash: jest.fn().mockResolvedValue(validResolvedToken),
          lockById: jest.fn().mockResolvedValue(concurrentlyRotatedLockedToken),
        },
      });

      await expect(service.refresh('presented-raw-token')).rejects.toThrow('Invalid refresh token');
      expect(refreshTokenService.revokeAllForPerson).toHaveBeenCalledWith('person-1');
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
      expect(refreshTokenService.rotate).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    test('test_logout_validToken_revokesIt', async () => {
      const resolvedToken = {
        refresh_token_id: 'token-1',
        tenant_id: 'tenant-a-id',
        person_id: 'person-1',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: null,
        replaced_by_token_id: null,
      };
      const { service, refreshTokenService } = buildService({
        refreshTokenService: { resolveByHash: jest.fn().mockResolvedValue(resolvedToken) },
      });

      await service.logout('raw-token');

      expect(refreshTokenService.revoke).toHaveBeenCalledWith('token-1');
    });

    test('test_logout_unknownToken_silentlyNoOps', async () => {
      const { service, refreshTokenService } = buildService({
        refreshTokenService: { resolveByHash: jest.fn().mockResolvedValue(undefined) },
      });

      await expect(service.logout('unknown-token')).resolves.toBeUndefined();
      expect(refreshTokenService.revoke).not.toHaveBeenCalled();
    });

    test('test_logout_alreadyRevokedToken_silentlyNoOps', async () => {
      const alreadyRevoked = {
        refresh_token_id: 'token-1',
        tenant_id: 'tenant-a-id',
        person_id: 'person-1',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: new Date().toISOString(),
        replaced_by_token_id: null,
      };
      const { service, refreshTokenService } = buildService({
        refreshTokenService: { resolveByHash: jest.fn().mockResolvedValue(alreadyRevoked) },
      });

      await expect(service.logout('already-revoked-token')).resolves.toBeUndefined();
      expect(refreshTokenService.revoke).not.toHaveBeenCalled();
    });
  });
});
