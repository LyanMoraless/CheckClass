import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  actorTypeCode: string;

  @IsString()
  @Matches(/^\d{11}$/, { message: 'cpf must be exactly 11 digits' })
  @IsOptional()
  cpf?: string;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  password?: string;
}
