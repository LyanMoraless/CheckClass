import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { InstitutionalMachineStatus } from '../institutional-machine-status.enum';

// RULE-DEV-04: all four field groups are required at cadastro time, no
// partial registration — group 1 (assetTag/serialNumber), group 2
// (roomId/status), group 3 (brand/model/processor/memoryDescription/
// operatingSystem), group 4 (courseId, RULE-DEV-05 metadata only).
export class CreateInstitutionalMachineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetTag: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serialNumber: string;

  @IsUUID()
  roomId: string;

  @IsEnum(InstitutionalMachineStatus)
  status: InstitutionalMachineStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  model: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  processor: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  memoryDescription: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  operatingSystem: string;

  @IsUUID()
  courseId: string;
}
