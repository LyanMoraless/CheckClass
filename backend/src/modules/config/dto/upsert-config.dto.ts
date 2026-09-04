import { IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AccumulatedFrequencyPeriod } from '../accumulated-frequency-period.enum';
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

  // Controle B (RULE-FREQ-01 addendum / RULE-FREQ-02). Both are required, not
  // optional: the columns are NOT NULL with no default, so a request without
  // them cannot create an attendance_config row at all.
  @IsNumber()
  @Min(0)
  @Max(100)
  minAccumulatedFrequencyPercentage: number;

  @IsEnum(AccumulatedFrequencyPeriod)
  accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod;

  @IsInt()
  @Min(0)
  toleranceMinutes: number;

  @IsEnum(PostToleranceBehavior)
  postToleranceBehavior: PostToleranceBehavior;
}
