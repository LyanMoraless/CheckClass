import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';

@Module({
  imports: [AuthModule],
  controllers: [CourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
