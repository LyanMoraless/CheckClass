import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateClassGroupDto {
  @IsUUID()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
