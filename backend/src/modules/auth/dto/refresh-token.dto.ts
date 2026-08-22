import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// The opaque refresh token itself (crypto.randomBytes(32).toString('hex') ==
// 64 hex chars) — 256 is generous headroom, same defensive-cap reasoning as
// LoginDto's password MaxLength, not a real expected size.
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken: string;
}
