import { Module } from '@nestjs/common';
import { AttendanceFrequencyModule } from '../attendance-frequency/attendance-frequency.module';
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
//
// AttendanceFrequencyModule (Frente 06, Controle B) is imported, not
// re-provided: GET /v1/me/warnings is a plain "my own data" read whose entire
// read model — including the lazy reconciliation it runs first — belongs to
// that bounded context, so this module contributes the route and nothing
// else. Note that the warning is exclusive to the student (RULE-FREQ-04
// addendum b): this import adds NO leadership-scoped surface, and Controle B
// deliberately has no dependency on LeadershipScopeService.
@Module({
  imports: [AuthModule, AttendanceRegisterModule, LeadershipScopeModule, AttendanceFrequencyModule],
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
