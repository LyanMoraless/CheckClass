import { Module } from '@nestjs/common';
import { ClassGroupDeletionOrchestrator } from './class-group-deletion-orchestrator.service';

@Module({
  providers: [ClassGroupDeletionOrchestrator],
  exports: [ClassGroupDeletionOrchestrator],
})
export class ClassGroupDeletionModule {}
