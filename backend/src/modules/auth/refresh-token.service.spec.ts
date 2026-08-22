import { createHash } from 'crypto';
import { RefreshTokenEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { RefreshTokenService } from './refresh-token.service';

function hashOf(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Persistence + lifecycle for App Mobile refresh tokens. resolveByHash runs
// BEFORE any tenant context exists — the DataSource.query call here IS the
// resolve_refresh_token_by_hash() SECURITY DEFINER function call, mocked at
// the unit level (same shape as AuthService/DeviceAuthService's specs).
// issue/rotate/revoke/revokeAllForPerson run AFTER tenant context is
// established, through TenantContextService's mocked manager.
describe('RefreshTokenService', () => {
  function buildService(queryResult: unknown[] = []) {
    const dataSource = { query: jest.fn().mockResolvedValue(queryResult) };
    const refreshTokenRepo = createMockRepository({
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'new-token-1', ...(entity as object) })),
    });
    const manager = createMockEntityManager(new Map([[RefreshTokenEntity, refreshTokenRepo]]));
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const service = new RefreshTokenService(dataSource as never, tenantContext as never);
    return { service, dataSource, refreshTokenRepo, manager, tenantContext };
  }

  test('test_resolveByHash_tokenExists_returnsResolvedRowAndQueriesByHashOfRawToken', async () => {
    const resolvedRow = {
      refresh_token_id: 'token-1',
      tenant_id: 'tenant-a-id',
      person_id: 'person-1',
      expires_at: '2026-09-21T00:00:00.000Z',
      revoked_at: null,
      replaced_by_token_id: null,
    };
    const { service, dataSource } = buildService([resolvedRow]);

    const result = await service.resolveByHash('raw-refresh-token-value');

    expect(result).toEqual(resolvedRow);
    expect(dataSource.query).toHaveBeenCalledWith('SELECT * FROM resolve_refresh_token_by_hash($1)', [
      hashOf('raw-refresh-token-value'),
    ]);
  });

  test('test_resolveByHash_tokenDoesNotExist_returnsUndefined', async () => {
    const { service } = buildService([]);

    const result = await service.resolveByHash('unknown-token');

    expect(result).toBeUndefined();
  });

  test('test_issue_storesOnlyHashOfGeneratedTokenAndReturnsRawTokenOnce', async () => {
    const { service, refreshTokenRepo } = buildService();

    const result = await service.issue('person-1');

    expect(result.tokenId).toBe('new-token-1');
    expect(result.rawToken).toMatch(/^[0-9a-f]{64}$/);

    const savedEntity = refreshTokenRepo.save.mock.calls[0][0];
    expect(savedEntity).toMatchObject({ tenantId: 'tenant-a-id', personId: 'person-1' });
    expect(savedEntity.tokenHash).toBe(hashOf(result.rawToken));
    expect(savedEntity.expiresAt).toBeInstanceOf(Date);
    expect(savedEntity.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('test_issue_twoCalls_produceDifferentRawTokens', async () => {
    const { service } = buildService();

    const first = await service.issue('person-1');
    const second = await service.issue('person-1');

    expect(first.rawToken).not.toBe(second.rawToken);
  });

  // Code-review finding — race condition in refresh-token rotation:
  // lockById is the seam that closes it (SELECT ... FOR UPDATE via TypeORM's
  // pessimisticWrite lock option), so this test verifies the lock option is
  // actually requested on the query, not just that a row comes back. A true
  // concurrency test (two simultaneous refresh() calls actually racing) isn't
  // reasonably simulable at the unit level: unit specs mock the manager/
  // repository entirely, so there is no real lock, connection, or
  // transaction to contend over — this needs the integration suite (real
  // Postgres, two overlapping connections) to genuinely exercise, which is
  // outside this codebase's existing test:integration fixtures for this
  // service today.
  test('test_lockById_fetchesTheTokenRowWithAPessimisticWriteLock', async () => {
    const lockedRow = { id: 'presented-token-1', personId: 'person-1', revokedAt: null, expiresAt: new Date() };
    const { service, refreshTokenRepo } = buildService();
    (refreshTokenRepo.findOne as jest.Mock).mockResolvedValue(lockedRow);

    const result = await service.lockById('presented-token-1');

    expect(result).toEqual(lockedRow);
    expect(refreshTokenRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'presented-token-1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  test('test_lockById_rowNotFound_returnsNull', async () => {
    const { service, refreshTokenRepo } = buildService();
    (refreshTokenRepo.findOne as jest.Mock).mockResolvedValue(undefined);

    const result = await service.lockById('missing-token');

    expect(result).toBeNull();
  });

  test('test_rotate_marksPresentedTokenRevokedAndPointsAtReplacement', async () => {
    const { service, refreshTokenRepo } = buildService();

    await service.rotate('old-token-1', 'new-token-1');

    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { id: 'old-token-1' },
      expect.objectContaining({ revokedAt: expect.any(Date), replacedByTokenId: 'new-token-1' }),
    );
  });

  test('test_revoke_marksTokenRevoked', async () => {
    const { service, refreshTokenRepo } = buildService();

    await service.revoke('token-1');

    expect(refreshTokenRepo.update).toHaveBeenCalledWith({ id: 'token-1' }, { revokedAt: expect.any(Date) });
  });

  test('test_revokeAllForPerson_updatesEveryOutstandingTokenForThatPerson', async () => {
    const { service, refreshTokenRepo } = buildService();

    await service.revokeAllForPerson('person-1');

    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { personId: 'person-1', revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });
});
