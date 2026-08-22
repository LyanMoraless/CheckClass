import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthenticatedRequest, JwtAuthGuard, JwtPayload } from './jwt-auth.guard';
import { MobileAuthService, MobileTokenPair } from './mobile-auth.service';
import { Permission } from './permission.enum';
import { PermissionGroupService } from './permission-group.service';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly permissionGroupService: PermissionGroupService,
    private readonly mobileAuthService: MobileAuthService,
  ) {}

  @Post('login')
  // Security review finding: the app-wide default throttle (100 req/min)
  // was sized for the device-ingestion endpoint, a materially weaker bar
  // against online brute-forcing of a human password. 10/min per IP is
  // still generous for a legitimate user mistyping a password, but bounds
  // an automated guessing loop.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() body: LoginDto): Promise<{ accessToken: string }> {
    const { personId, tenantId } = await this.authService.login(body.cpf, body.password);
    const payload: JwtPayload = { personId, tenantId };
    return { accessToken: this.jwtService.sign(payload) };
  }

  // App Mobile login (Security Agent's "Decisão de segurança — Autenticação
  // Mobile", approved 2026-08-22). Distinct route/response shape from
  // POST /v1/auth/login above — that endpoint's contract is unchanged and
  // still what the web dashboard depends on. Same CPF+password body shape
  // and credential-verification logic (reused via AuthService), same
  // brute-force throttle.
  @Post('login/mobile')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async loginMobile(@Body() body: LoginDto): Promise<MobileTokenPair> {
    return this.mobileAuthService.login(body.cpf, body.password);
  }

  // No JwtAuthGuard/TenantContextInterceptor here by design: this route
  // establishes identity from the presented refresh token itself (resolved
  // via resolve_refresh_token_by_hash, AddRefreshToken migration), the same
  // way login establishes identity from credentials — there is no tenant
  // context yet when the request arrives.
  @Post('refresh')
  // Defense-in-depth per the approved design: same bar as login, even though
  // this isn't a password-guessing target — bounds abuse of the endpoint
  // itself (e.g. hammering it with random tokens).
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Body() body: RefreshTokenDto): Promise<MobileTokenPair> {
    return this.mobileAuthService.refresh(body.refreshToken);
  }

  // App Mobile logout: revokes the presented refresh token. No guard here
  // either, for the same reason as refresh() above — and deliberately so a
  // client can still log out with an already-expired access token. Doesn't
  // touch the access token itself (it self-expires shortly; no server-side
  // access-token revocation list is part of the approved design).
  //
  // Code-review finding: this is the same "unauthenticated lookup against an
  // arbitrary presented value" attack surface refresh() above is already
  // throttled for — logout() had no @Throttle at all despite doing the exact
  // same resolveByHash() lookup. Same bar as login/refresh.
  @Post('logout')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async logout(@Body() body: RefreshTokenDto): Promise<{ success: true }> {
    await this.mobileAuthService.logout(body.refreshToken);
    return { success: true };
  }

  // Added for the admin frontend (no other consumer needs it yet): lets the
  // UI know which of the 4 permissions the logged-in person holds, so it can
  // hide/disable actions instead of only reacting to a 403 after the fact.
  // Deliberately returns ALL 4 checked individually rather than exposing
  // permission-group membership itself — the frontend only ever needs the
  // yes/no answer per permission, not the groups behind it.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  async me(@Req() request: AuthenticatedRequest): Promise<{ personId: string; permissions: Permission[] }> {
    const permissions = await this.permissionGroupService.getPermissionsForPerson(request.personId);
    return { personId: request.personId, permissions };
  }
}
