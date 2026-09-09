import { IsDateString, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES,
  AbsenceJustificationLegalCategory,
} from '../absence-justification.constants';

// RULE-JUST-01 addendum/RULE-JUST-06/RULE-JUST-12: one date range, one legal
// category, one written description — the attachment travels alongside this
// DTO as a multipart file (see AbsenceJustificationSubmissionController),
// never as a field here. The matéria is NOT part of this DTO on purpose:
// RULE-JUST-01's addendum removed matéria selection entirely — the system
// derives which matérias/sessions are affected server-side
// (AbsenceJustificationEligibilityService), the student never picks one.
export class CreateAbsenceJustificationSubmissionDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsIn(ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES)
  legalCategory: AbsenceJustificationLegalCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;
}
