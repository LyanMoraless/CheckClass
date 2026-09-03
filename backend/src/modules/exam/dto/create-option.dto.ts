import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// Only objective questions have options — enforced by the service, since it
// depends on the parent question's type and not on this payload alone.
export class CreateOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  label: string;

  @IsInt()
  @Min(0)
  position: number;

  // The answer key of RULE-EXAM-14, and optional as that rule requires:
  // false everywhere simply means the question is not graded automatically.
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}
