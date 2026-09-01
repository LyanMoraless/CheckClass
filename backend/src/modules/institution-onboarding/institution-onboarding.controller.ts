import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatedTenant } from '../auth/tenant-bootstrap.service';
import { CreateInstitutionOnboardingDto } from './dto/create-institution-onboarding.dto';
import { InstitutionOnboardingService } from './institution-onboarding.service';

// RULE-INST-02: public, pre-authentication institution-creation screen — no
// JwtAuthGuard/TenantContextInterceptor on either route here, same
// precedent already established by AuthController's refresh()/logout()
// (there is no tenant context yet at the moment either endpoint below is
// called). Both routes are unauthenticated and unauthorized by definition,
// not an oversight.
@Controller('v1/institution-onboarding')
export class InstitutionOnboardingController {
  constructor(private readonly institutionOnboardingService: InstitutionOnboardingService) {}

  // RULE-INST-02 (third round, item #3): lets the frontend check, before
  // rendering the onboarding form at all, whether this instance is already
  // locked — so it can redirect straight to login with a message instead of
  // showing a form that would only fail on submit.
  @Get('status')
  async status(): Promise<{ configured: boolean }> {
    return this.institutionOnboardingService.getStatus();
  }

  @Post()
  // Public, pre-authentication endpoint — same rate-limiting reasoning
  // already applied to AuthController's login/refresh/logout (Security
  // skill: rate limit public-facing endpoints as a defense-in-depth
  // measure, here against abuse of the single-instance creation attempt).
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async onboard(@Body() body: CreateInstitutionOnboardingDto): Promise<CreatedTenant> {
    return this.institutionOnboardingService.onboard(body);
  }
}
