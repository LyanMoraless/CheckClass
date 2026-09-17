import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuardianLinkFollowupModule } from '../guardian-link-followup/guardian-link-followup.module';
import { LocationConsentGuardModule } from '../location-consent-guard/location-consent-guard.module';
import { PersonManagementModule } from '../person-management/person-management.module';
import { LegalGuardianController } from './legal-guardian.controller';
import { LegalGuardianService } from './legal-guardian.service';

// PersonManagementModule: reuses PersonMinorityStatusService (the "é menor"
// gate that module's header already earmarked for future consumers) instead
// of a divergent copy — new, unidirectional dependency, no cycle back (see
// "Decisão de arquitetura — CRUD de legal_guardian", architecture-overview
// .md's "Coesão/acoplamento"). GuardianLinkFollowupModule: revoke()'s
// "no active guardian remains" trigger. LocationConsentGuardModule:
// revoke()'s "this guardian decided the latest granted consent" trigger.
@Module({
  imports: [AuthModule, PersonManagementModule, GuardianLinkFollowupModule, LocationConsentGuardModule],
  controllers: [LegalGuardianController],
  providers: [LegalGuardianService],
  // Additive export (no behavior change to this module's own routes) — the
  // new location-consent module (RULE-PRES-14, architecture-overview.md's
  // "Implementação — location-verification e location-consent") imports this
  // module to reuse LegalGuardianService.findById for the exact same
  // guardianId->studentId(+status='active') integrity check
  // LegalGuardianController.assertBelongsToStudent already does for its own
  // routes, instead of a second, divergent copy of that lookup.
  exports: [LegalGuardianService],
})
export class LegalGuardianModule {}
