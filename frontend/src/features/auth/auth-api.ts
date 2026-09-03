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

export interface RoleContextTeachingEntry {
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: a turma studies N matérias — plural, and empty for a
  // turma that currently has none.
  subjectNames: string[];
  courseName: string;
}

export interface RoleContextCoordinatingEntry {
  courseId: string;
  courseName: string;
}

// "Decisão de arquitetura — Portal de Autoatendimento Web, estrutura
// (2026-09-02)": dedicated endpoint, not a JWT claim — a role assignment
// (RULE-INST-05) can change mid-session without forcing a new login, unlike
// a claim baked into the token at login time. Drives which of the four
// role-scoped nav groups app-shell.tsx shows; flags are independent, not
// mutually exclusive (a person can be Professor and Coordenador at once).
export interface RoleContext {
  isStudent: boolean;
  teaching: RoleContextTeachingEntry[];
  coordinating: RoleContextCoordinatingEntry[];
  isDirection: boolean;
}

export async function fetchMyRoleContext(): Promise<RoleContext> {
  return api.get('/v1/me/context');
}
