import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^\d{11}$/, { message: 'cpf must be exactly 11 digits' })
  cpf: string;

  @IsString()
  @IsNotEmpty()
  // bcrypt silently truncates beyond 72 bytes; this also caps the size of an
  // unbounded string reaching bcrypt at all (no request body size limit is
  // configured elsewhere).
  @MaxLength(128)
  password: string;
}
