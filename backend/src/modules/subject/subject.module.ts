import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassGroupDeletionModule } from '../class-group-deletion/class-group-deletion.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { SubjectController } from './subject.controller';
import { SubjectService } from './subject.service';

@Module({
  imports: [AuthModule, LeadershipScopeModule, ClassGroupDeletionModule],
  controllers: [SubjectController],
  providers: [SubjectService],
  exports: [SubjectService],
})
export class SubjectModule {}
