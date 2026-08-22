import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource, IsNull } from 'typeorm';
import { RefreshTokenEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

const REFRESH_TOKEN_BYTES = 32;

// ~30 days, sliding (renewed on every successful rotation) — Security
// Agent's "Decisão de segurança — Autenticação Mobile", approved 2026-08-22.
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Raw row shape returned by resolve_refresh_token_by_hash() (AddRefreshToken
// migration) — snake_case, same convention as ResolvedPerson/ResolvedDevice
// in auth.service.ts/device-auth.service.ts.
export interface ResolvedRefreshToken {
  refresh_token_id: string;
  tenant_id: string;
  person_id: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by_token_id: string | null;
}

export interface IssuedRefreshToken {
  tokenId: string;
  rawToken: string;
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Persistence + lifecycle for App Mobile refresh tokens (Security Agent's
// "Decisão de segurança — Autenticação Mobile", approved 2026-08-22). Only
// the SHA-256 hash is ever stored — mirroring device-auth.service.ts's
// convention for high-entropy, server-generated secrets (bcrypt stays
// reserved for low-entropy human passwords, see person-management.service.ts
// / auth.service.ts's DUMMY_PASSWORD_HASH). No timing-safe comparison is
// needed here the way DeviceAuthService needs one for its split
// apiKeyId.secret: a refresh token is a single 256-bit opaque value looked
// up by its hash through a unique index, not compared byte-by-byte against a
// value already retrieved by a (potentially attacker-controlled) id.
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  // Runs BEFORE any tenant context exists — same sanctioned SECURITY
  // DEFINER escape hatch as resolve_person_by_cpf/resolve_device_by_api_key_id
  // (AddRefreshToken migration): the RLS-locked app role can't otherwise
  // resolve a presented token's tenant_id/person_id by hash alone.
  async resolveByHash(rawToken: string): Promise<ResolvedRefreshToken | undefined> {
    const rows: ResolvedRefreshToken[] = await this.dataSource.query(
      'SELECT * FROM resolve_refresh_token_by_hash($1)',
      [hashToken(rawToken)],
    );
    return rows[0];
  }

  // Code-review finding — race condition in refresh-token rotation:
  // resolveByHash() above is an unlocked read taken BEFORE any transaction
  // exists (it's how MobileAuthService.refresh() learns which tenant's
  // transaction to open in the first place), so its revoked_at/expires_at
  // snapshot can already be stale by the time the caller is ready to decide
  // whether to rotate. This method re-fetches the SAME row by id, inside the
  // caller's already-open tenant transaction, WITH a pessimistic write lock
  // (`SELECT ... FOR UPDATE`) — must be called from inside
  // TenantContextService.runWithTenant, same as issue()/rotate()/revoke().
  // Two concurrent refresh() calls presenting the same token now serialize
  // here: the second blocks until the first's transaction (which rotates
  // this same row) commits, then observes the now-revoked row and correctly
  // falls into reuse-detection instead of also succeeding.
  async lockById(tokenId: string): Promise<RefreshTokenEntity | null> {
    const manager = this.tenantContext.getManager();
    const token = await manager.getRepository(RefreshTokenEntity).findOne({
      where: { id: tokenId },
      lock: { mode: 'pessimistic_write' },
    });
    return token ?? null;
  }

  // Must run inside TenantContextService.runWithTenant for the token's
  // owning tenant — persists through the tenant-scoped, RLS-bearing manager.
  async issue(personId: string): Promise<IssuedRefreshToken> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');

    const repository = manager.getRepository(RefreshTokenEntity);
    const saved = await repository.save(
      repository.create({
        tenantId,
        personId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      }),
    );

    return { tokenId: saved.id, rawToken };
  }

  // Rotation: the presented token is marked used AND pointed at the token
  // that replaced it — the pairing the reuse-detection check in
  // MobileAuthService relies on (a token presented again after this call has
  // revokedAt set, which is exactly the signal it treats as replay).
  async rotate(presentedTokenId: string, newTokenId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    await manager
      .getRepository(RefreshTokenEntity)
      .update({ id: presentedTokenId }, { revokedAt: new Date(), replacedByTokenId: newTokenId });
  }

  async revoke(tokenId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    await manager.getRepository(RefreshTokenEntity).update({ id: tokenId }, { revokedAt: new Date() });
  }

  // Family-wide revocation: used both by MobileAuthService's reuse-detection
  // path (an already-rotated/already-revoked token presented again is a
  // theft/replay signal) and, per the approved design, meant to be invoked
  // from a future password-change flow (none exists in this codebase yet —
  // see PersonManagementService; flagged separately, not built here).
  async revokeAllForPerson(personId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    await manager
      .getRepository(RefreshTokenEntity)
      .update({ personId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
