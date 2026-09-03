import { Module } from '@nestjs/common';
import { AttendanceRegisterModule } from '../attendance-register/attendance-register.module';
import { AuthModule } from '../auth/auth.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { CoordinatedClassGroupsService } from './coordinated-class-groups.service';
import { MeClassGroupAttendanceService } from './me-class-group-attendance.service';
import { MeContextService } from './me-context.service';
import { MeController } from './me.controller';
import { MyScheduleService } from './my-schedule.service';
import { TeachingClassGroupsService } from './teaching-class-groups.service';

// RULE-ATT-15: self-scoped ("my own data") reads for any authenticated
// person, kept structurally apart from the permission-gated admin-facing
// modules (AttendanceRegisterModule, ClassSessionModule, etc.) it composes.
// LeadershipScopeModule import (Portal de Autoatendimento web pivot) adds a
// second, distinct authorization idiom to this same module — leadership
// -chain-scoped reads (MeContextService, CoordinatedClassGroupsService,
// MeClassGroupAttendanceService) — without touching the permission-group
// system at all.
@Module({
  imports: [AuthModule, AttendanceRegisterModule, LeadershipScopeModule],
  controllers: [MeController],
  providers: [
    MyScheduleService,
    MeContextService,
    TeachingClassGroupsService,
    CoordinatedClassGroupsService,
    MeClassGroupAttendanceService,
  ],
})
export class SelfServiceModule {}
