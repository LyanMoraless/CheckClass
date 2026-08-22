import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class IssueWristbandDto {
  @IsUUID()
  personId: string;

  @IsUUID()
  wristbandCategoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tagCode: string;
}
