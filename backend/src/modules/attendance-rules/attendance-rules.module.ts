import { Module } from '@nestjs/common';
import { AttendanceRulesEngineService } from './attendance-rules-engine.service';
import { PresenceIntervalService } from './presence-interval.service';

@Module({
  providers: [AttendanceRulesEngineService, PresenceIntervalService],
  exports: [AttendanceRulesEngineService],
})
export class AttendanceRulesModule {}
