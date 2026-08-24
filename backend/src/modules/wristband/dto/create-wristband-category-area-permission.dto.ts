import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

// RULE-ACC-02's concrete grant: a wristband category authorized in an area,
// optionally bounded by an absolute validity window (the "período" part of
// "área, bloco, período" — see WristbandCategoryAreaPermissionEntity).
export class CreateWristbandCategoryAreaPermissionDto {
  @IsUUID()
  areaId: string;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}
