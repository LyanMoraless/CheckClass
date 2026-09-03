import { api } from '../../lib/api-client';

// GET /v1/me/teaching-class-groups — lists class_group_enrollment rows with
// role = 'teacher' for the authenticated person, which covers co-docência
// (RULE-INST-05) by construction, no extra logic needed on either side.
export interface TeachingClassGroupEntry {
  classGroupId: string;
  classGroupName: string;
  subjectName: string;
  courseName: string;
}

export async function listMyTeachingClassGroups(): Promise<TeachingClassGroupEntry[]> {
  return api.get('/v1/me/teaching-class-groups');
}
