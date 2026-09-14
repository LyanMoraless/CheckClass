import { apiClient } from '../../lib/api-client';

// Mirrors MyScheduleEntry (my-schedule.service.ts) exactly, as returned by
// GET /v1/me/schedule (RULE-ATT-15's self-scoped read, me.controller.ts).
// classGroupName/subjectName/roomName/status were added when the warnings
// feature needed to resolve a classSessionId to a readable "matéria — turma"
// label (see warnings-feed.ts) — they were already part of the backend
// response but had never been modeled on this side since ScheduleScreen
// didn't need them.
export interface ScheduleEntry {
  classSessionId: string;
  classGroupId: string;
  classGroupName: string;
  subjectName: string;
  roomId: string | null;
  roomName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'scheduled' | 'edited' | 'cancelled';
}

export async function listMySchedule(): Promise<ScheduleEntry[]> {
  return apiClient.get<ScheduleEntry[]>('/v1/me/schedule');
}
