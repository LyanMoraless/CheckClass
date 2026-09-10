import { IsInt, Min } from 'class-validator';

export class UpsertDeviceBindingConfigDto {
  @IsInt()
  @Min(1)
  inactivityTimeoutMinutes: number;
}
