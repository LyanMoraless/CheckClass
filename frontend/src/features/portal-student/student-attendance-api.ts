import { api, buildQuery } from '../../lib/api-client';

// GET /v1/me/attendance — RULE-ATT-15 self-scoped read, unchanged by this
// pivot (me.controller.ts delegates to AttendanceRegisterService.getPersonHistory,
// same as the admin-facing PersonHistoryLookup in attendance-register-page.tsx).
// Mirrors PersonHistoryEntry (attendance-register-api.ts) exactly — same
// precedent mobile/src/features/attendance/attendance-api.ts already
// followed for this endpoint.
export interface StudentAttendanceEntry {
  classSessionId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'present' | 'absent' | 'pending';
  attendancePercentage: number;
  pendingReason: string | null;
}

// classGroupId is an optional filter already supported server-side
// (me.controller.ts's getMyAttendance takes @Query('classGroupId')) — lets a
// student narrow the list to a single turma when they have more than one.
export async function listMyAttendance(classGroupId?: string): Promise<StudentAttendanceEntry[]> {
  return api.get(`/v1/me/attendance${buildQuery({ classGroupId })}`);
}
