import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LegalGuardianModule } from '../legal-guardian/legal-guardian.module';
import { LocationConsentGuardModule } from '../location-consent-guard/location-consent-guard.module';
import { PersonManagementModule } from '../person-management/person-management.module';
import { LocationConsentGuardianController } from './location-consent-guardian.controller';
import { LocationConsentSelfServiceController } from './location-consent-self-service.controller';
import { LocationConsentService } from './location-consent.service';

// RULE-PRES-14/15 — irmão de LocationConsentGuardModule (architecture-
// overview.md, "Implementação — location-verification e location-consent").
// LocationConsentGuardModule: LocationConsentSuspensionService.getLatestDecision,
// a leitura reaproveitada por getActiveConsent/hasActiveConsent, nunca
// reimplementada aqui. PersonManagementModule: PersonMinorityStatusService,
// o gate de auto-consentimento (grantForSelf). LegalGuardianModule:
// LegalGuardianService.findById, usado por LocationConsentGuardianController
// para confirmar que :guardianId é um vínculo ATIVO de :personId antes de
// aceitar qualquer decisão em nome do responsável legal — mesma checagem que
// LegalGuardianController já faz para suas próprias rotas.
@Module({
  imports: [AuthModule, LocationConsentGuardModule, PersonManagementModule, LegalGuardianModule],
  controllers: [LocationConsentSelfServiceController, LocationConsentGuardianController],
  providers: [LocationConsentService],
  // RULE-PRES-01/05/14/15 (architecture-overview.md's "Implementação — room-
  // presence e integração dos três gates"): exported for AppCheckinModule
  // (the consent gate/routing decision, RULE-PRES-14) and AttendanceRulesModule
  // (the RULE-PRES-15 bypass in AttendanceRulesEngineService.evaluatePerson) —
  // both consume hasActiveConsent as a read-only primitive, mão única, this
  // module never imports either back.
  exports: [LocationConsentService],
})
export class LocationConsentModule {}
