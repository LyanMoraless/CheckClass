import { IsOptional, IsString, MaxLength } from 'class-validator';

// personId is deliberately absent — RULE-DEV-02/RULE-DEV-01 nota C4: always
// resolved from the caller's own JWT (AuthenticatedRequest.personId), never
// accepted from the body.
export class RegisterPersonalDeviceDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;
}
