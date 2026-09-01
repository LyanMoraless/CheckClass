import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantConfigModule } from '../config/tenant-config.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { ScheduleConflictDetectionModule } from '../schedule-conflict-detection/schedule-conflict-detection.module';
import { ClassSessionController } from './class-session.controller';
import { ClassSessionService } from './class-session.service';

@Module({
  imports: [TenantConfigModule, AuthModule, LeadershipScopeModule, ScheduleConflictDetectionModule],
  controllers: [ClassSessionController],
  providers: [ClassSessionService],
  exports: [ClassSessionService],
})
export class ClassSessionModule {}
