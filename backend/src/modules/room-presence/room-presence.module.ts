import { Module } from '@nestjs/common';
import { LocationVerificationModule } from '../location-verification/location-verification.module';
import { RoomPresenceService } from './room-presence.service';

// RULE-PRES-04/05/06/07/08 — "Decisão de arquitetura — Fluxo de Chamada
// Redesenhado" (architecture-overview.md), consolidated in
// .doc/checkclass-arquitetura-chamada.html ("Onde Fica Cada Lógica — 'Em
// sala por aula'"). Same idiom as DeviceBindingModule: dedicated read
// primitive, own module, exported for cross-module consumption. Imports
// LocationVerificationModule (mão única: room-presence consumes
// LocationVerificationService for RULE-PRES-08/09's priority-2 afastamento
// signal, never the reverse). No controller: room-presence has no HTTP
// surface of its own — its write path (recordFromCheckin) is invoked by
// DeduplicationWorker, its reads by PresenceIntervalService and
// AttendanceRulesEngineService.
@Module({
  imports: [LocationVerificationModule],
  providers: [RoomPresenceService],
  exports: [RoomPresenceService],
})
export class RoomPresenceModule {}
