import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// studentPersonId comes from the route (:personId), never the body.
// registeredByPersonId always comes from the verified JWT (see
// LegalGuardianController.create) — never accepted here, same idiom as
// PersonManagementController's confirmedByPersonId/resolvedByPersonId.
// signature_captured_at is not settable at all (DB default now()) —
// accepting a client-supplied timestamp would let the Secretaria retrodate
// the presencial conferência (RULE-GRD-05).
export class CreateLegalGuardianDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber: string;
}
