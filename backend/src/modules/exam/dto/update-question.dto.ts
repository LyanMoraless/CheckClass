import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QUESTION_TYPES, QuestionType } from '../exam-vocabulary';

export class UpdateQuestionDto {
  @IsOptional()
  @IsIn(QUESTION_TYPES)
  questionType?: QuestionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  prompt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  points?: number;
}
