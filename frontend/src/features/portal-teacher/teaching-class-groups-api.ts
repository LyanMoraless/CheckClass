import { api } from '../../lib/api-client';

// GET /v1/me/teaching-class-groups — lists class_group_enrollment rows with
// role = 'teacher' for the authenticated person, which covers co-docência
// (RULE-INST-05) by construction, no extra logic needed on either side.
export interface TeachingClassGroupEntry {
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: a turma studies N matérias — plural, and empty for a
  // turma that currently has none.
  subjectNames: string[];
  courseName: string;
}

export async function listMyTeachingClassGroups(): Promise<TeachingClassGroupEntry[]> {
  return api.get('/v1/me/teaching-class-groups');
}
