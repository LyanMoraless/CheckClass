import { IsNumber, Max, Min } from 'class-validator';

// RULE-EXAM-14's manual half. The real ceiling is the question's own
// `points`, checked in the service — the bounds here only match the
// numeric(6,2) column.
export class GradeAnswerDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  awardedPoints: number;
}
