import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// A top-level row (parentAreaId omitted) models a "bloco"; a row with
// parentAreaId set models a nested "área"/andar/corredor inside it — same
// hierarchy AreaEntity/AreaAuthorizationService already document.
export class CreateAreaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUUID()
  parentAreaId?: string;
}
