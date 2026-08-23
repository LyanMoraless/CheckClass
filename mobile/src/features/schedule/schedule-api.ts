import { apiClient } from '../../lib/api-client';

// Mirrors MyScheduleEntry (my-schedule.service.ts) exactly, as returned by
// GET /v1/me/schedule (RULE-ATT-15's self-scoped read, me.controller.ts).
export interface ScheduleEntry {
  classSessionId: string;
  classGroupId: string;
  roomId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export async function listMySchedule(): Promise<ScheduleEntry[]> {
  return apiClient.get<ScheduleEntry[]>('/v1/me/schedule');
}
