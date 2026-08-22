import { api, buildQuery } from '../../lib/api-client';

export interface SessionRegisterEntry {
  personId: string;
  fullName: string;
  // LEFT JOINed against session_attendance_consolidation on the backend —
  // null here means the rules engine hasn't evaluated this session yet
  // (e.g. it hasn't ended), not an actual "no status" attendance state.
  status: 'present' | 'absent' | 'pending' | null;
  attendancePercentage: number | null;
  totalPresenceMinutes: number | null;
  pendingReason: string | null;
}

export interface PersonHistoryEntry {
  classSessionId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'present' | 'absent' | 'pending';
  attendancePercentage: number;
  pendingReason: string | null;
}

export interface ClassGroupSummaryEntry {
  personId: string;
  fullName: string;
  sessionsEvaluated: number;
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  attendanceRate: number | null;
}

export async function getSessionRegister(classSessionId: string): Promise<SessionRegisterEntry[]> {
  return api.get(`/v1/register/session/${classSessionId}`);
}

export async function getPersonHistory(personId: string, classGroupId?: string): Promise<PersonHistoryEntry[]> {
  return api.get(`/v1/register/person/${personId}${buildQuery({ classGroupId })}`);
}

export async function getClassGroupSummary(classGroupId: string): Promise<ClassGroupSummaryEntry[]> {
  return api.get(`/v1/register/class-group/${classGroupId}`);
}
