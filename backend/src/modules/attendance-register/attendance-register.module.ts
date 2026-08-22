import { Module } from '@nestjs/common';
import { AttendanceRegisterService } from './attendance-register.service';

@Module({
  providers: [AttendanceRegisterService],
  exports: [AttendanceRegisterService],
})
export class AttendanceRegisterModule {}
