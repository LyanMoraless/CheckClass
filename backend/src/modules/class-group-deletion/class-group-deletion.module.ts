import { Module } from '@nestjs/common';
import { AttendanceFrequencyModule } from '../attendance-frequency/attendance-frequency.module';
import { ClassGroupDeletionOrchestrator } from './class-group-deletion-orchestrator.service';

@Module({
  imports: [AttendanceFrequencyModule],
  providers: [ClassGroupDeletionOrchestrator],
  exports: [ClassGroupDeletionOrchestrator],
})
export class ClassGroupDeletionModule {}
