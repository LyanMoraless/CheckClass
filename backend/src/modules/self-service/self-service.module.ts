import { Module } from '@nestjs/common';
import { AttendanceRegisterModule } from '../attendance-register/attendance-register.module';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';
import { MyScheduleService } from './my-schedule.service';

// RULE-ATT-15: self-scoped ("my own data") reads for any authenticated
// person, kept structurally apart from the permission-gated admin-facing
// modules (AttendanceRegisterModule, ClassSessionModule, etc.) it composes.
@Module({
  imports: [AuthModule, AttendanceRegisterModule],
  controllers: [MeController],
  providers: [MyScheduleService],
})
export class SelfServiceModule {}
