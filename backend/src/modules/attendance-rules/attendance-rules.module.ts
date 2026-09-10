import { Module } from '@nestjs/common';
import { DeviceBindingModule } from '../device-binding/device-binding.module';
import { AttendanceRulesEngineService } from './attendance-rules-engine.service';
import { PresenceIntervalService } from './presence-interval.service';

// RULE-DEV-09/10 (Frente 12): the Motor de Regras reads DeviceBindingService
// as a one-way dependency (mão única, same shape as its existing read of
// Serviço de Configuração) — device-binding never imports this module back.
@Module({
  imports: [DeviceBindingModule],
  providers: [AttendanceRulesEngineService, PresenceIntervalService],
  exports: [AttendanceRulesEngineService],
})
export class AttendanceRulesModule {}
