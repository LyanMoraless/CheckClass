import { ArrayUnique, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Incremental autosave payload: the FULL current state of one question's
// answer, not a delta — the stored selection is replaced by what arrives
// here, including an empty one when the student unchecks everything.
//
// There is no personId and no sessionId: the owner comes from the JWT and
// the session is resolved from (person, exam), which is what makes the
// ownership check of Security control 1 structural rather than a lookup that
// could be forgotten.
export class SaveAnswerDto {
  // Blank is a valid answer (confirmed 2026-09-03) — it simply scores zero.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  answerText?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  selectedOptionIds?: string[];
}
