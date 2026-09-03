import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CreateClassSessionDto {
  @IsUUID()
  classGroupId: string;

  // RULE-INST-14: required — which of the turma's matérias this session is
  // about. That it is actually linked to the turma is validated at the
  // service layer (ClassSessionService.createSession).
  @IsUUID()
  subjectId: string;

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
