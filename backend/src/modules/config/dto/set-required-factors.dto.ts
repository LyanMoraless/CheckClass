import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetRequiredFactorsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  factorTypeIds: string[];
}
