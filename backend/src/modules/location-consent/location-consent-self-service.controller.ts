import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecordLocationConsentDecisionDto } from './dto/record-location-consent-decision.dto';
import { LocationConsentService } from './location-consent.service';

// RULE-PRES-14 — self-service (App Mobile), titular deciding for themself.
// Same isolation idiom as SelfServiceModule's MeController: /v1/me/* route,
// JwtAuthGuard + TenantContextInterceptor ONLY (no PermissionCheckInterceptor
// — "is this MY OWN consent" is not a permission-group grant), personId
// NEVER accepted as a route/query/body param, always request.personId from
// the verified JWT.
@Controller('v1/me/location-consent')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class LocationConsentSelfServiceController {
  constructor(private readonly locationConsentService: LocationConsentService) {}

  @Get()
  getMyConsent(@Req() request: AuthenticatedRequest) {
    return this.locationConsentService.getActiveConsent(request.personId);
  }

  // Rejects with ForbiddenException (via LocationConsentService.grantForSelf)
  // when the caller is a confirmed minor, or when their date_of_birth
  // confirmation is still ausente/provisório (RULE-GRD-07 pendência 3) — see
  // that method's own comment.
  @Post('grant')
  grant(@Body() body: RecordLocationConsentDecisionDto, @Req() request: AuthenticatedRequest) {
    return this.locationConsentService.grantForSelf(request.personId, body.consentVersion);
  }

  @Post('refuse')
  refuse(@Body() body: RecordLocationConsentDecisionDto, @Req() request: AuthenticatedRequest) {
    return this.locationConsentService.refuseForSelf(request.personId, body.consentVersion);
  }

  @Post('revoke')
  revoke(@Req() request: AuthenticatedRequest) {
    return this.locationConsentService.revokeForSelf(request.personId);
  }
}
