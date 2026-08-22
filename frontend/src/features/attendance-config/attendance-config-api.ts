import { api } from '../../lib/api-client';

export type ConfigScopeType = 'institution' | 'course' | 'class_group';
export type PostToleranceBehavior = 'block_checkin' | 'deny_presence' | 'register_only';

export interface AttendanceConfig {
  id: string;
  scopeType: ConfigScopeType;
  scopeId: string | null;
  minAttendancePercentage: string;
  toleranceMinutes: number;
  postToleranceBehavior: PostToleranceBehavior;
}

export interface UpsertConfigInput {
  scopeType: ConfigScopeType;
  scopeId?: string;
  minAttendancePercentage: number;
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
