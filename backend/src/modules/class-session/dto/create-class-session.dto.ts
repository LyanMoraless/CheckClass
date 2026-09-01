import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CreateClassSessionDto {
  @IsUUID()
  classGroupId: string;

  // RULE-INST-07: optional — see ClassSessionService's CreateClassSessionInput
  // doc for what omitting it means (inherits class_group.roomId dynamically,
  // stored as NULL, not a snapshot).
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @IsISO8601()
  scheduledStart: string;

  @IsISO8601()
  scheduledEnd: string;
}
