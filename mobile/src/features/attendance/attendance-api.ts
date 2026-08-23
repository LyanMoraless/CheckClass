import { apiClient } from '../../lib/api-client';

export type AttendanceStatus = 'present' | 'absent' | 'pending';

// Mirrors PersonHistoryEntry (attendance-register.service.ts) exactly, as returned by
// GET /v1/me/attendance (RULE-ATT-15's self-scoped read, me.controller.ts).
export interface AttendanceEntry {
  classSessionId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AttendanceStatus;
  attendancePercentage: number | null;
  pendingReason: string | null;
}

export async function listMyAttendance(classGroupId?: string): Promise<AttendanceEntry[]> {
  const query = classGroupId ? `?classGroupId=${encodeURIComponent(classGroupId)}` : '';
  return apiClient.get<AttendanceEntry[]>(`/v1/me/attendance${query}`);
}

export interface AttendanceSummary {
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  // Same present / (present + absent) formula the backend already uses for the admin-facing
  // class-group summary (ClassGroupSummaryEntry.attendanceRate) — computed client-side here
  // since /v1/me/attendance returns the raw per-session list, not a pre-aggregated rate.
  // RULE-ATT-11/RULE-ATT-07/09: a pending session is deliberately excluded from this ratio,
  // never silently counted as present or absent.
  attendanceRate: number | null;
}

export function summarizeAttendance(entries: AttendanceEntry[]): AttendanceSummary {
  const presentCount = entries.filter((entry) => entry.status === 'present').length;
  const absentCount = entries.filter((entry) => entry.status === 'absent').length;
  const pendingCount = entries.filter((entry) => entry.status === 'pending').length;
  const decided = presentCount + absentCount;
  return {
    presentCount,
    absentCount,
    pendingCount,
    attendanceRate: decided > 0 ? (presentCount / decided) * 100 : null,
  };
}
