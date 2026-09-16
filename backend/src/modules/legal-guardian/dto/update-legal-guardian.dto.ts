import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Only fullName/documentNumber are editable ("Decisão de arquitetura — CRUD
// de legal_guardian", architecture-overview.md, pendência 3) — status only
// changes via revoke(), studentPersonId/tenantId are immutable. At least one
// field must be present (LegalGuardianService.update throws
// BadRequestException otherwise); @IsNotEmpty on each still-present field
// rejects an explicit empty string.
export class UpdateLegalGuardianDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber?: string;
}
