import { IsUUID } from 'class-validator';

// RULE-INST-14: links one Matéria to a Turma. That the matéria exists and
// belongs to the turma's own course is validated at the service layer
// (ClassGroupService.linkSubject) — shape only here, same split already used
// by CreateClassGroupDto for roomId.
export class AddClassGroupSubjectDto {
  @IsUUID()
  subjectId: string;
}
