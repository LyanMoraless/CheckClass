import { IsISO8601, IsUUID } from 'class-validator';

export class CreateClassSessionDto {
  @IsUUID()
  classGroupId: string;

  @IsUUID()
  roomId: string;

  @IsISO8601()
  scheduledStart: string;

  @IsISO8601()
  scheduledEnd: string;
}
