import { IsDateString } from 'class-validator';

// RULE-GRD-07 (business-rules/references/legal-guardian-consent-rules.md):
// this DTO backs the Secretaria's presencial confirmation of a person's date
// of birth — always sets person.date_of_birth_confirmed_at/_by, never leaves
// the result "provisório" (that state only exists for a self-declared value
// this backend does not currently accept from any endpoint).
export class ConfirmDateOfBirthDto {
  // "YYYY-MM-DD" — matches the `date`-typed person.date_of_birth column.
  @IsDateString()
  dateOfBirth: string;
}
