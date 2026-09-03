import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateClassGroupDto {
  // RULE-INST-14: the turma belongs to a Curso; its Matérias are a set that
  // can be given here and edited afterwards via
  // POST/DELETE :classGroupId/subjects. Omitting subjectIds creates a turma
  // with no matéria yet — a valid, composable state.
  @IsUUID()
  courseId: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  subjectIds?: string[];

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
