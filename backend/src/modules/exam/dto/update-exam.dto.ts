import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// Every field optional (partial update). classGroupId is deliberately absent:
// moving an exam to another turma would change who may take it and who may
// grade it (RULE-EXAM-16) — that is a different exam, not an edit.
export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsDateString()
  availableUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}
