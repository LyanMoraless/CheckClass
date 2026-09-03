import { api } from '../../lib/api-client';

// GET /v1/me/coordinated-class-groups — same shape as
// teaching-class-groups-api.ts's TeachingClassGroupEntry (confirmed
// explicitly in "Decisão de arquitetura — Portal de Autoatendimento Web,
// estrutura": "mesmo shape acima"). Lists every turma under the courses the
// person coordinates (LeadershipScopeService.getCourseScope) — or, for
// Direção, every turma in the tenant, since Direção inherits allCourses
// scope automatically (RULE-INST-09) with no client-side distinction
// needed: the backend alone decides the scope from the caller's identity.
export interface CoordinatedClassGroupEntry {
  classGroupId: string;
  classGroupName: string;
  subjectName: string;
  courseName: string;
}

export async function listMyCoordinatedClassGroups(): Promise<CoordinatedClassGroupEntry[]> {
  return api.get('/v1/me/coordinated-class-groups');
}
