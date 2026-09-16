import { IsNotEmpty, IsString } from 'class-validator';

// guardian_link_followup closure (architecture-overview.md's "Fechamento"
// section): manual attestation by the Secretaria that the legal-guardian
// vínculo flow (RULE-GRD-02/05) was (re-)completed. resolutionNote is
// required — the DB CHECK on the resolution columns already enforces this at
// the schema level (guardian_link_followup_resolution_exclusive_check), this
// mirrors it at the API boundary. resolvedByPersonId is NOT part of this DTO
// on purpose: it always comes from the verified JWT, same idiom as
// ConfirmDateOfBirthDto's confirmedByPersonId.
export class ResolveGuardianLinkFollowupDto {
  @IsString()
  @IsNotEmpty()
  resolutionNote: string;
}
