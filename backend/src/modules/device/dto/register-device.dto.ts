import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  deviceType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalIdentifier: string;
}
