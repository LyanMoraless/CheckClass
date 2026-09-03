import { api } from '../../lib/api-client';

// GET /v1/me/schedule, extended with readable names (RULE-ATT-15 self-scoped
// read — me.controller.ts / my-schedule.service.ts). Mirrors MyScheduleEntry
// exactly: no courseName here — the confirmed scope for this extension was
// "nomes de matéria/turma/sala" (subject/turma/sala) only, and roomId/roomName
// are nullable because a class_session can have neither its own room nor a
// class_group-level fallback room set.
export type StudentScheduleSessionStatus = 'scheduled' | 'edited' | 'cancelled';

export interface StudentScheduleEntry {
  classSessionId: string;
  classGroupId: string;
  classGroupName: string;
  subjectName: string;
  roomId: string | null;
  roomName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: StudentScheduleSessionStatus;
}

export async function listMySchedule(): Promise<StudentScheduleEntry[]> {
  return api.get('/v1/me/schedule');
}
