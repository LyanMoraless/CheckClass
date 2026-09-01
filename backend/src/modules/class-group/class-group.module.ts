import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassGroupDeletionModule } from '../class-group-deletion/class-group-deletion.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { ClassGroupController } from './class-group.controller';
import { ClassGroupService } from './class-group.service';

@Module({
  imports: [AuthModule, LeadershipScopeModule, ClassGroupDeletionModule],
  controllers: [ClassGroupController],
  providers: [ClassGroupService],
  exports: [ClassGroupService],
})
export class ClassGroupModule {}
