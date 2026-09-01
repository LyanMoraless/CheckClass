import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

// RULE-INST-04 (third-round update, item #3): horário/data (scheduledStart +
// scheduledEnd, both required together) and sala (roomId, optional — omitted
// means "leave the session's current roomId untouched").
export class EditClassSessionDto {
  @IsISO8601()
  scheduledStart: string;

  @IsISO8601()
  scheduledEnd: string;

  @IsUUID()
  @IsOptional()
  roomId?: string;
}
