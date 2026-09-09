import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// RULE-JUST-17.1: a revocation's motivo is ALWAYS required, unlike an
// approval's optional observação.
//
// MaxLength mirrors create-submission.dto.ts's description limit (Security
// Agent, DoS/storage-bloat finding) — the column itself is
// absence_justification_item_decision.note (text, unbounded), so this is a
// pure input-validation ceiling, no migration involved.
export class RevokeAbsenceJustificationItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  note: string;
}
