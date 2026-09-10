import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { InstitutionalMachineStatus } from '../institutional-machine-status.enum';

// Plain partial edit (RULE-DEV-15's "editar" — covers "dar baixa" too, since
// that is just setting status to decommissioned/stolen, not a separate
// workflow). Unlike CreateInstitutionalMachineDto, RULE-DEV-04's
// all-four-groups-required rule only applies to the initial cadastro, not to
// every subsequent edit.
export class UpdateInstitutionalMachineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  assetTag?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  serialNumber?: string;

  @IsUUID()
  @IsOptional()
  roomId?: string;

  @IsEnum(InstitutionalMachineStatus)
  @IsOptional()
  status?: InstitutionalMachineStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  brand?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  model?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  processor?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  memoryDescription?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  operatingSystem?: string;

  @IsUUID()
  @IsOptional()
  courseId?: string;
}
