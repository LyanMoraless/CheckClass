import { api } from '../../lib/api-client';

// RULE-INST-01: fixed three-value enum — only "faculdade" has detailed
// institution-management behavior this round, but all three are valid
// choices on the onboarding form itself.
export type InstitutionType = 'faculdade' | 'escola' | 'empresa';

export interface OnboardingStatus {
  configured: boolean;
}

export interface CreateInstitutionOnboardingInput {
  institutionName: string;
  cnpj: string;
  institutionType: InstitutionType;
  addressZipCode: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement?: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  rootFullName: string;
  rootCpf: string;
  rootPassword: string;
}

// Public, unauthenticated endpoints (RULE-INST-02) — `api.get`/`api.post`
// simply omit the Authorization header when there's no stored token, which
// is always the case here since this screen only exists before any login.
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  return api.get('/v1/institution-onboarding/status');
}

export async function createInstitutionOnboarding(input: CreateInstitutionOnboardingInput): Promise<void> {
  await api.post('/v1/institution-onboarding', input);
}
