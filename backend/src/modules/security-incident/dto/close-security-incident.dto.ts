import { IsIn, IsNotEmpty, IsString } from 'class-validator';

// RULE-SEC-07: two possible outcomes, note MANDATORY on every closure
// (unlike ResolvePendingReviewDto's optional note — a deliberately separate,
// stricter rule for this domain, not a reuse of that mechanism).
export class CloseSecurityIncidentDto {
  @IsIn(['resolved', 'false_positive'])
  outcome: 'resolved' | 'false_positive';

  @IsString()
  @IsNotEmpty()
  note: string;
}
