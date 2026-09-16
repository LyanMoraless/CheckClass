import { Module } from '@nestjs/common';
import { GuardianLinkFollowupModule } from '../guardian-link-followup/guardian-link-followup.module';
import { LocationConsentSuspensionService } from './location-consent-suspension.service';

// Shared domain service (not a lower layer of any one feature module):
// PersonManagementModule imports this for RetroactiveMinorConsentGuardService,
// LegalGuardianModule imports this for LegalGuardianService.revoke() — see
// "Decisão de arquitetura — CRUD de legal_guardian", architecture-overview.md.
@Module({
  imports: [GuardianLinkFollowupModule],
  providers: [LocationConsentSuspensionService],
  exports: [LocationConsentSuspensionService],
})
export class LocationConsentGuardModule {}
