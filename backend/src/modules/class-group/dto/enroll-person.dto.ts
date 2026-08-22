import { IsIn, IsUUID } from 'class-validator';

export class EnrollPersonDto {
  @IsUUID()
  personId: string;

  // Matches the values AttendanceRulesEngineService's roster query filters
  // on ('student') — kept closed rather than a free-form string so that
  // filter can't silently miss a differently-spelled equivalent.
  @IsIn(['student', 'teacher'])
  role: string;
}
