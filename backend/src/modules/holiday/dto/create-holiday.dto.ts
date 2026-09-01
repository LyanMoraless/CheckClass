import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateHolidayDto {
  // "YYYY-MM-DD" — matches the `date`-typed holiday.date column, no time
  // component (a holiday is a whole calendar day, RULE-INST-04).
  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
