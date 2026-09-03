import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CourseCoordinatorAssignmentController } from './course-coordinator-assignment.controller';
import { CourseCoordinatorAssignmentService } from './course-coordinator-assignment.service';

@Module({
  imports: [AuthModule],
  controllers: [CourseCoordinatorAssignmentController],
  providers: [CourseCoordinatorAssignmentService],
  exports: [CourseCoordinatorAssignmentService],
})
export class LeadershipAssignmentModule {}
