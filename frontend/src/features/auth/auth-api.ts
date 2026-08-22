import { api } from '../../lib/api-client';
import type { Permission } from '../../types/permission';

export interface LoginInput {
  cpf: string;
  password: string;
}

export async function login(input: LoginInput): Promise<{ accessToken: string }> {
  return api.post('/v1/auth/login', input);
}

export async function fetchCurrentPerson(): Promise<{ personId: string; permissions: Permission[] }> {
  return api.get('/v1/auth/me');
}
