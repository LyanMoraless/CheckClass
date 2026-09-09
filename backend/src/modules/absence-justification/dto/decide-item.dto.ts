import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// "note required when rejecting, optional when approving" (RULE-JUST-03
// addendum item 1) is enforced in AbsenceJustificationDecisionService, not
// here — a conditional-required class-validator rule reads worse than the
// explicit check next to the DB CHECK it mirrors
// (absence_justification_item_decision_note_required_check).
export class DecideAbsenceJustificationItemDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  // MaxLength mirrors create-submission.dto.ts's description limit (Security
  // Agent, DoS/storage-bloat finding) — the column itself is
  // absence_justification_item_decision.note (text, unbounded), so this is a
  // pure input-validation ceiling, no migration involved.
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  note?: string;
}
