import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionalNetworkModule } from '../institutional-network/institutional-network.module';
import { LocationConsentModule } from '../location-consent/location-consent.module';
import { LocationVerificationModule } from '../location-verification/location-verification.module';
import { AppCheckinController } from './app-checkin.controller';
import { AppCheckinService } from './app-checkin.service';

// RULE-ATT-06's confirmed note: the app check-in submission path, kept as
// its own feature module — structurally separate from IngestionModule (the
// device-authenticated contract it deliberately does not reuse) — that
// feeds the existing Identification/Deduplication/Motor-de-Regras pipeline.
// RULE-PRES-01/14 (architecture-overview.md's "Implementação — room-presence
// e integração dos três gates"): imports the three gate primitives
// (InstitutionalNetworkModule, LocationVerificationModule,
// LocationConsentModule) — mão única, same shape as every other consumer of
// these modules, none of them import AppCheckinModule back.
@Module({
  imports: [AuthModule, InstitutionalNetworkModule, LocationVerificationModule, LocationConsentModule],
  controllers: [AppCheckinController],
  providers: [AppCheckinService],
})
export class AppCheckinModule {}
