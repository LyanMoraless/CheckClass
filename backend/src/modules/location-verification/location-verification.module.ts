import { Module } from '@nestjs/common';
import { LocationVerificationService } from './location-verification.service';

// RULE-PRES-01(b)/RULE-PRES-09 — "Decisão de arquitetura — Fluxo de Chamada
// Redesenhado" (architecture-overview.md). Shared, stateless decision
// primitive exported for cross-module consumption: AppCheckinService
// (RULE-PRES-01's login gate) and room-presence's afastamento monitor
// (RULE-PRES-09) are the two intended callers, neither wired yet — both are
// a later implementation round by design (this round only builds and
// exposes the primitive itself, see architecture-overview.md's
// "Implementação — location-verification e location-consent" addendum). No
// controller: this module has no HTTP surface of its own.
@Module({
  providers: [LocationVerificationService],
  exports: [LocationVerificationService],
})
export class LocationVerificationModule {}
