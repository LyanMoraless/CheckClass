import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassSessionModule } from '../class-session/class-session.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { ScheduleConflictDetectionModule } from '../schedule-conflict-detection/schedule-conflict-detection.module';
import { ClassScheduleController } from './class-schedule.controller';
import { ClassScheduleService } from './class-schedule.service';
import { ScheduleRegenerationService } from './schedule-regeneration.service';
import { SessionGenerationService } from './session-generation.service';

@Module({
  imports: [AuthModule, LeadershipScopeModule, ClassSessionModule, ScheduleConflictDetectionModule],
  controllers: [ClassScheduleController],
  providers: [ClassScheduleService, SessionGenerationService, ScheduleRegenerationService],
  exports: [ClassScheduleService, SessionGenerationService, ScheduleRegenerationService],
})
export class ClassScheduleModule {}
