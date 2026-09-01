import { Module } from '@nestjs/common';
import { ScheduleConflictDetectionService } from './schedule-conflict-detection.service';

@Module({
  providers: [ScheduleConflictDetectionService],
  exports: [ScheduleConflictDetectionService],
})
export class ScheduleConflictDetectionModule {}
