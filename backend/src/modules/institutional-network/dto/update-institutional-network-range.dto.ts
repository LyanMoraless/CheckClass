import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Plain partial edit — same posture as UpdateInstitutionalMachineDto: no
// field is required to be resubmitted, only what actually changes.
export class UpdateInstitutionalNetworkRangeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(43)
  @IsOptional()
  cidr?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;
}
