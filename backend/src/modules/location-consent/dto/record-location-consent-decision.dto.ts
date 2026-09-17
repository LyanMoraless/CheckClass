import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// consent_version (location_consent_decision.consent_version, NOT NULL) —
// "which version of the consent text was shown" (column comment,
// AddLegalGuardianAndLocationConsentDecision migration). Only the caller
// that actually displayed the term text (App Mobile for self-service; the
// Secretaria's atendimento screen for the guardian path) knows which
// version that was, so it is always taken as explicit input here, never
// inferred or defaulted by the backend. Not required on revoke — see
// LocationConsentService.assertRevocableAndGetLatest for why.
export class RecordLocationConsentDecisionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  consentVersion: string;
}
