import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TenantContextService } from '../../database/tenant-context.service';
import { AuthService } from './auth.service';
import { JwtPayload } from './jwt-auth.guard';
import { RefreshTokenService } from './refresh-token.service';

export interface MobileTokenPair {
  accessToken: string;
  refreshToken: string;
}

// 20 min: inside the 15-30 min range the Security Agent's approved design
// calls for (architecture-overview.md, "Decisão de segurança — Autenticação
// Mobile") — short enough to bound how long a leaked access token is useful,
// long enough that a normal in-class session doesn't need a background
// refresh mid-use. Deliberately separate from the web dashboard's 8h token
// (auth.module.ts): a personal mobile device carrying student PII is a
// different risk profile than a short authenticated admin session.
const MOBILE_ACCESS_TOKEN_TTL = '20m';

// Security-review finding: refresh() used to throw three distinguishable
// messages ("Invalid refresh token" / "Refresh token already used" /
// "Refresh token expired"), letting a caller distinguish "this token never
// existed" from "this token existed but was already used/expired" — an
// oracle this codebase already avoids everywhere else (AuthService.login's
// unified "Invalid credentials" for wrong-CPF vs wrong-password; logout()'s
// own silent no-op for both unknown and already-revoked tokens, right below).
// The three internal code paths/conditions stay exactly as they were — only
// the externally-visible message collapses to this one string.
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token';

// Orchestrates the App Mobile auth flow (login/refresh/logout) on top of
// AuthService's existing credential verification and RefreshTokenService's
// token persistence — kept separate from AuthController's existing
// POST /v1/auth/login so that endpoint's contract/behavior is untouched.
@Injectable()
export class MobileAuthService {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async login(cpf: string, password: string): Promise<MobileTokenPair> {
    // Reuses AuthService.login unchanged (same bcrypt/timing-safe-dummy-hash
    // credential check as the web login) — identity is established before
    // any tenant context exists, exactly like today.
    const { personId, tenantId } = await this.authService.login(cpf, password);

    return this.tenantContext.runWithTenant(tenantId, async () => {
      const accessToken = this.signAccessToken({ personId, tenantId });
      const { rawToken } = await this.refreshTokenService.issue(personId);
      return { accessToken, refreshToken: rawToken };
    });
  }

  async refresh(presentedToken: string): Promise<MobileTokenPair> {
    const resolved = await this.refreshTokenService.resolveByHash(presentedToken);
    if (!resolved) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    return this.tenantContext.runWithTenant(resolved.tenant_id, async () => {
      // Code-review finding — race condition in refresh-token rotation:
      // resolved's revoked_at/expires_at above is an unlocked snapshot read
      // before this transaction existed, so it can be stale under
      // concurrency. Re-fetching the same row here WITH a row lock, and
      // deciding everything below off THIS read, is what actually closes
      // the race — see RefreshTokenService.lockById's own comment.
      const locked = await this.refreshTokenService.lockById(resolved.refresh_token_id);
      if (!locked) {
        throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
      }

      if (locked.revokedAt) {
        // An already-rotated/already-revoked token being presented again is
        // the reuse-detection signal per the approved design: burn the whole
        // family for this person (possible theft/replay), not just this row.
        await this.refreshTokenService.revokeAllForPerson(locked.personId);
        throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
      }

      if (locked.expiresAt.getTime() < Date.now()) {
        // Tidy-up, not load-bearing for security (an expired token is
        // already rejected below either way): mark it revoked so it reads
        // consistently for anyone inspecting the row later.
        await this.refreshTokenService.revoke(locked.id);
        throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
      }

      const accessToken = this.signAccessToken({ personId: locked.personId, tenantId: resolved.tenant_id });
      const { tokenId, rawToken } = await this.refreshTokenService.issue(locked.personId);
      await this.refreshTokenService.rotate(locked.id, tokenId);
      return { accessToken, refreshToken: rawToken };
    });
  }

  async logout(presentedToken: string): Promise<void> {
    const resolved = await this.refreshTokenService.resolveByHash(presentedToken);
    if (!resolved || resolved.revoked_at) {
      // Unknown or already-revoked token: nothing left to do. Deliberately a
      // silent no-op rather than 404/409 — logout must not become an oracle
      // for whether a given refresh token value ever existed.
      return;
    }

    await this.tenantContext.runWithTenant(resolved.tenant_id, () =>
      this.refreshTokenService.revoke(resolved.refresh_token_id),
    );
  }

  private signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, { expiresIn: MOBILE_ACCESS_TOKEN_TTL });
  }
}
