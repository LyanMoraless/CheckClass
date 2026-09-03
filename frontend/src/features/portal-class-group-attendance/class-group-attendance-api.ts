import { api } from '../../lib/api-client';

// GET /v1/me/class-groups/:classGroupId/attendance — "Decisão de
// arquitetura — Portal de Autoatendimento Web, estrutura (2026-09-02)":
// delegates to the existing, unchanged AttendanceRegisterService, gated by
// LeadershipScopeService.hasAuthorityOverClassGroup() instead of a
// permission-group check. Mirrors ClassGroupSummaryEntry
// (attendance-register-api.ts, backed by
// AttendanceRegisterController's GET /v1/register/class-group/:id) exactly —
// same per-student summary shape as the admin equivalent this reuses.
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
  return api.get(`/v1/me/class-groups/${classGroupId}/attendance`);
}
