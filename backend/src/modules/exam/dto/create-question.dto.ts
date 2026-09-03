import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QUESTION_TYPES, QuestionType } from '../exam-vocabulary';

// RULE-EXAM-03's definitive type set. There is deliberately no `isRequired`
// field: every question is optional (confirmed 2026-09-03), because
// mandatory questions would conflict with the automatic submission on time
// expiry (RULE-EXAM-08).
export class CreateQuestionDto {
  @IsIn(QUESTION_TYPES)
  questionType: QuestionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  prompt: string;

  @IsInt()
  @Min(0)
  position: number;

  // RULE-EXAM-14: how much the question is worth at most, for every type.
  // Omitted = the question carries no score at all, which is what lets an
  // exam with no answer key behave like a plain form. numeric(6,2) in the
  // database, hence the bounds.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  points?: number;
}
