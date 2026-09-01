import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateClassGroupDto {
  @IsUUID()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  // RULE-INST-07: room lives on the turma itself. Existence is validated
  // against RoomEntity at the service layer (ClassGroupService.create),
  // NotFoundException if not found — same "validate FK exists, 404 if not"
  // precedent as SubjectService.create for courseId. Shape only here
  // (@IsUUID); schedule-conflict detection over room/professor
  // (RULE-INST-10) is a separate concern, handled by
  // ScheduleConflictDetectionService.
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @IsDateString()
  @IsOptional()
  termStartDate?: string;

  @IsDateString()
  @IsOptional()
  termEndDate?: string;
}
