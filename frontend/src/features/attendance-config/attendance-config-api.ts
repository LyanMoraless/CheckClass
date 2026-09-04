import { api } from '../../lib/api-client';

export type ConfigScopeType = 'institution' | 'course' | 'class_group';
export type PostToleranceBehavior = 'block_checkin' | 'deny_presence' | 'register_only';
// AccumulatedFrequencyPeriod (accumulated-frequency-period.enum.ts): Controle
// B's reporting period. Exactly these three values for every institution —
// not extensible like the factor list, and there is no free/custom
// periodicity, so this is a select, never a free-text field.
export type AccumulatedFrequencyPeriod = 'bimester' | 'trimester' | 'semester';

export interface AttendanceConfig {
  id: string;
  scopeType: ConfigScopeType;
  scopeId: string | null;
  // Controle A (RULE-ATT-04): did the student stay for enough of THIS class.
  minAttendancePercentage: string;
  // Controle B (RULE-FREQ-01/02, upsert-config.dto.ts): did the student
  // attend enough of the classes ACROSS THE REPORTING PERIOD. A different
  // question from minAttendancePercentage above, not a rename of it — see
  // the grouped fieldset in attendance-config-page.tsx, which exists
  // specifically so the two are never read as the same knob.
  minAccumulatedFrequencyPercentage: string;
  accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod;
  toleranceMinutes: number;
  postToleranceBehavior: PostToleranceBehavior;
}

export interface UpsertConfigInput {
  scopeType: ConfigScopeType;
  scopeId?: string;
  minAttendancePercentage: number;
  // Both REQUIRED, not optional — upsert-config.dto.ts's UpsertConfigDto has
  // no @IsOptional() on either: the attendance_config columns are NOT NULL
  // with no default, so a request missing them cannot create a row at all.
  minAccumulatedFrequencyPercentage: number;
  accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod;
  toleranceMinutes: number;
  postToleranceBehavior: PostToleranceBehavior;
}

export interface FactorType {
  id: string;
  code: string;
  name: string;
  isCustom: boolean;
}

export async function listConfigs(): Promise<AttendanceConfig[]> {
  return api.get('/v1/config');
}

export async function upsertConfig(input: UpsertConfigInput): Promise<{ configId: string }> {
  return api.post('/v1/config', input);
}

export async function setRequiredFactors(configId: string, factorTypeIds: string[]): Promise<void> {
  await api.post(`/v1/config/${configId}/required-factors`, { factorTypeIds });
}

export async function listFactorTypes(): Promise<FactorType[]> {
  return api.get('/v1/config/factor-types');
}
