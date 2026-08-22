import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceRegisterController } from './attendance-register.controller';
import { AttendanceRegisterService } from './attendance-register.service';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceRegisterController],
  providers: [AttendanceRegisterService],
  exports: [AttendanceRegisterService],
})
export class AttendanceRegisterModule {}
