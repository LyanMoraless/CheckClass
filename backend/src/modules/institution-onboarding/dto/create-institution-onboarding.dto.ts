import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { INSTITUTION_TYPES } from '../../auth/tenant-bootstrap.service';

export class CreateInstitutionOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  institutionName: string;

  // RULE-INST-02 (second round, item #3): check-digit validation happens in
  // InstitutionOnboardingService via common/cnpj.util's isValidCnpj, not
  // here — a class-validator decorator can only check shape, not the
  // Receita Federal algorithm, and the task calls for a clear
  // BadRequestException specifically on a failed check digit, not a generic
  // 422 from the validation pipe. Accepts either masked
  // ("11.222.333/0001-81", 18 chars) or unmasked ("11222333000181", 14
  // chars) input; MaxLength(18) just admits the widest accepted shape.
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  cnpj: string;

  // RULE-INST-01: fixed 3-value enum (faculdade/escola/empresa), same list
  // TenantBootstrapService seeds leadership roles against for "faculdade" —
  // imported from there so the two never drift out of sync.
  @IsIn(INSTITUTION_TYPES)
  institutionType: string;

  // RULE-INST-02 (third round, items #1/#2): address fields are always
  // collected here, whether autofilled by the frontend calling ViaCEP
  // directly or typed manually after a ViaCEP miss/outage — the backend
  // never requires proof either way, it only validates the fields
  // themselves. Accepts either masked ("01310-100") or unmasked
  // ("01310100") CEP; normalized/validated as exactly 8 digits in the
  // service.
  @IsString()
  @IsNotEmpty()
  @MaxLength(9)
  addressZipCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressStreet: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  addressNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressComplement?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressNeighborhood: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressCity: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'addressState must be a 2-letter UF code' })
  addressState: string;

  @IsString()
  @IsNotEmpty()
  rootFullName: string;

  // Same unmasked-11-digit convention already used by LoginDto/CreatePersonDto
  // for every other CPF field in this codebase.
  @IsString()
  @Matches(/^\d{11}$/, { message: 'rootCpf must be exactly 11 digits' })
  rootCpf: string;

  // Same upper bound already used by LoginDto — bcrypt silently truncates
  // beyond 72 bytes; this also caps an unbounded string reaching bcrypt at
  // all. Security-review finding: unlike CreatePersonDto/LoginDto (whose own
  // missing MinLength is a pre-existing, lower-risk gap behind an
  // authenticated-admin-only surface), this DTO provisions a fully
  // unauthenticated, public endpoint's root account — one holding every
  // Permission value (TenantBootstrapService.provisionRootAdmin) — so a
  // minimum length is added here specifically rather than deferred to that
  // broader, separate cleanup.
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  rootPassword: string;
}
