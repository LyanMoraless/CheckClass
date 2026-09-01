import { api, buildQuery } from '../../lib/api-client';

export interface Subject {
  id: string;
  tenantId: string;
  courseId: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubjectInput {
  courseId: string;
  name: string;
  code?: string;
}

export async function listSubjects(courseId?: string): Promise<Subject[]> {
  return api.get(`/v1/subjects${buildQuery({ courseId })}`);
}

export async function createSubject(input: CreateSubjectInput): Promise<Subject> {
  return api.post('/v1/subjects', input);
}
