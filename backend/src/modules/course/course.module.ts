import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassGroupDeletionModule } from '../class-group-deletion/class-group-deletion.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';

@Module({
  imports: [AuthModule, LeadershipScopeModule, ClassGroupDeletionModule],
  controllers: [CourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
