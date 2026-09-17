import { Module } from '@nestjs/common';
import { RoomPresenceModule } from '../room-presence/room-presence.module';
import { ClassroomHeadcountReconciliationService } from './classroom-headcount-reconciliation.service';

// RULE-PRES-10/11/12 (Bloco 4 — Contagem por câmera como cruzamento).
// Imports RoomPresenceModule (mão única: this module reads
// RoomPresenceService.countActiveInRoom, never the reverse) — same
// acoplamento direction as every other reader of room-presence
// (AttendanceRulesEngineService, PresenceIntervalService). No controller of
// its own: its two callers are src/scripts/classroom-headcount-reconciliation-check.ts
// (the periodic job, via NestFactory.createApplicationContext) and
// SelfServiceModule (the professor's live read, GET /v1/me/class-sessions/
// :id/headcount-alert) — both import this module and call
// ClassroomHeadcountReconciliationService directly, same idiom as
// LocationVerificationModule/RoomPresenceModule above it.
@Module({
  imports: [RoomPresenceModule],
  providers: [ClassroomHeadcountReconciliationService],
  exports: [ClassroomHeadcountReconciliationService],
})
export class ClassroomHeadcountReconciliationModule {}
