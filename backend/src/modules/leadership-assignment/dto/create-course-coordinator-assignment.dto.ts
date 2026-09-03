import { IsUUID } from 'class-validator';

export class CreateCourseCoordinatorAssignmentDto {
  @IsUUID()
  personId: string;

  @IsUUID()
  courseId: string;
}
