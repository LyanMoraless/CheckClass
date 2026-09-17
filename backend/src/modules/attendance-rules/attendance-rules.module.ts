import { Module } from '@nestjs/common';
import { DeviceBindingModule } from '../device-binding/device-binding.module';
import { LocationConsentModule } from '../location-consent/location-consent.module';
import { RoomPresenceModule } from '../room-presence/room-presence.module';
import { AttendanceRulesEngineService } from './attendance-rules-engine.service';
import { PresenceIntervalService } from './presence-interval.service';

// RULE-DEV-09/10 (Frente 12): the Motor de Regras reads DeviceBindingService
// as a one-way dependency (mão única, same shape as its existing read of
// Serviço de Configuração) — device-binding never imports this module back.
// RULE-PRES-05/14/15 (architecture-overview.md's "Decisão de arquitetura —
// Fluxo de Chamada Redesenhado"): same mão-única shape for LocationConsentModule
// (APP_CHECKIN's RULE-PRES-15 routing) and RoomPresenceModule (both
// isPresentForSession, consumed directly by AttendanceRulesEngineService, and
// getSessionProjectedInterval, consumed by PresenceIntervalService).
@Module({
  imports: [DeviceBindingModule, LocationConsentModule, RoomPresenceModule],
  providers: [AttendanceRulesEngineService, PresenceIntervalService],
  exports: [AttendanceRulesEngineService],
})
export class AttendanceRulesModule {}
