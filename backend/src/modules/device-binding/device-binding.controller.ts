import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CheckoutDto } from './dto/checkout.dto';
import { UpsertDeviceBindingConfigDto } from './dto/upsert-device-binding-config.dto';
import { WebauthnLoginVerifyDto } from './dto/webauthn-login-verify.dto';
import { DeviceBindingConfigService } from './device-binding-config.service';
import { DeviceBindingService } from './device-binding.service';

// No class-level @RequirePermission: most routes here are self-scoped
// ("my own" login/checkout/active binding, same posture as
// AppCheckinController/RULE-ATT-15) — only list() below (RULE-DEV-13/
// RULE-ACC-08) needs a permission code, applied at the method level.
@Controller('v1/device-bindings')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
export class DeviceBindingController {
  constructor(
    private readonly bindingService: DeviceBindingService,
    private readonly configService: DeviceBindingConfigService,
  ) {}

  @Post('login-options')
  generateLoginOptions() {
    return this.bindingService.generateLoginOptions();
  }

  // RULE-DEV-01/07/10: creates the vínculo after a successful WebAuthn
  // verification, always tied to the already-authenticated JWT person —
  // deviceIdentityId is never accepted from the client. request.ip is
  // Express's own resolution (GAP-10/RULE-DEV-14) — no `trust proxy`
  // handling here on purpose: correctly resolving the real client IP behind
  // a reverse proxy/load balancer is a DevOps deploy-time concern flagged in
  // the Tech Decision, not solved here (see architecture-overview.md,
  // "Decisão de tecnologia — Detecção de rede institucional / GAP-10").
  // Express types request.ip as `string | undefined` (it can be undefined if
  // the underlying socket is already destroyed) — coalesced to '' rather
  // than widening every downstream signature to `string | undefined`; an
  // empty string is not a parseable IP either, so it falls into the same
  // fail-closed "outside the network" branch as any other unparseable
  // value (InstitutionalNetworkService.isWithinInstitutionalNetwork).
  @Post('login')
  login(@Body() body: WebauthnLoginVerifyDto, @Req() request: AuthenticatedRequest) {
    return this.bindingService.completeLogin(request.personId, body.challengeToken, body.response, request.ip ?? '');
  }

  // Same endpoint for all four RULE-DEV-06 triggers — only `reason` varies.
  // Idempotent: a second call after the binding is already checked out is a
  // silent no-op (checkedOut: false).
  @Post('checkout')
  checkout(@Body() body: CheckoutDto, @Req() request: AuthenticatedRequest) {
    return this.bindingService.checkoutMine(request.personId, body.reason);
  }

  @Get('me/active')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.bindingService.getActiveForPerson(request.personId);
  }

  // RULE-DEV-13/RULE-ACC-08: dedicated permission code, titular padrão
  // coordenação + diretoria/reitoria (RULE-DEV-16) — enforced by whichever
  // permission groups a tenant grants VIEW_DEVICE_BINDINGS to, not hardcoded
  // here.
  @Get()
  @RequirePermission(Permission.VIEW_DEVICE_BINDINGS)
  list() {
    return this.bindingService.listActiveAndHistory();
  }

  // Not named by any RULE-DEV rule (see DeviceBindingConfigService's header
  // comment) — plumbing needed to actually set gatilho 3's threshold,
  // gated by the same Direção/Reitoria authority as inventory admin.
  @Get('config')
  getConfig() {
    return this.configService.getEffective();
  }

  @Post('config')
  async upsertConfig(@Body() body: UpsertDeviceBindingConfigDto, @Req() request: AuthenticatedRequest) {
    const config = await this.configService.upsert(body.inactivityTimeoutMinutes, request.personId);
    return { inactivityTimeoutMinutes: config.inactivityTimeoutMinutes };
  }
}
