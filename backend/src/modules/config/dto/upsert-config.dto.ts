import { IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ConfigScopeType } from '../config-scope-type.enum';
import { PostToleranceBehavior } from '../post-tolerance-behavior.enum';

export class UpsertConfigDto {
  @IsEnum(ConfigScopeType)
  scopeType: ConfigScopeType;

  @IsUUID()
  @IsOptional()
  scopeId?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  minAttendancePercentage: number;

  @IsInt()
  @Min(0)
  toleranceMinutes: number;

  @IsEnum(PostToleranceBehavior)
  postToleranceBehavior: PostToleranceBehavior;
}
