import { apiClient } from '../../lib/api-client';

// GET /v1/me/coordinated-class-groups — same endpoint the web dashboard's
// portal-leadership/coordinated-class-groups-api.ts calls. Lists every turma
// under the courses the caller coordinates (Coordenador de Curso), or every
// turma in the tenant for Direção/Reitoria (RULE-INST-09's automatic
// allCourses inheritance) — the backend alone resolves which one from the
// caller's identity, with no client-side distinction between the two roles.
// A person with neither role simply gets an empty list here, same idiom as
// pending-reviews-api.ts.
export interface CoordinatedClassGroupEntry {
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: a turma studies N matérias — plural, and empty for a turma
  // that currently has none.
  subjectNames: string[];
  courseName: string;
}

export async function listMyCoordinatedClassGroups(): Promise<CoordinatedClassGroupEntry[]> {
  return apiClient.get<CoordinatedClassGroupEntry[]>('/v1/me/coordinated-class-groups');
}

// GET /v1/me/class-groups/:classGroupId/attendance — mirrors the web
// dashboard's portal-class-group-attendance/class-group-attendance-api.ts
// exactly. Gated server-side by LeadershipScopeService.hasAuthorityOverClassGroup()
// instead of a permission-group check; a 403 here is not handled specially,
// it surfaces through the normal ErrorBanner path.
export interface ClassGroupAttendanceEntry {
  personId: string;
  fullName: string;
  sessionsEvaluated: number;
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  attendanceRate: number | null;
}

export async function getClassGroupAttendance(classGroupId: string): Promise<ClassGroupAttendanceEntry[]> {
  return apiClient.get<ClassGroupAttendanceEntry[]>(`/v1/me/class-groups/${classGroupId}/attendance`);
}
