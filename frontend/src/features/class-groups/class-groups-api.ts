import { api, buildQuery } from '../../lib/api-client';

export interface ClassGroup {
  id: string;
  courseId: string;
  name: string;
}

export interface CreateClassGroupInput {
  courseId: string;
  name: string;
}

export interface Enrollment {
  id: string;
  classGroupId: string;
  personId: string;
  role: 'student' | 'teacher';
}

export interface EnrollPersonInput {
  personId: string;
  role: 'student' | 'teacher';
}

export interface ClassSession {
  id: string;
  classGroupId: string;
  roomId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CreateClassSessionInput {
  classGroupId: string;
  roomId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export async function listClassGroups(courseId?: string): Promise<ClassGroup[]> {
  return api.get(`/v1/class-groups${buildQuery({ courseId })}`);
}

export async function createClassGroup(input: CreateClassGroupInput): Promise<ClassGroup> {
  return api.post('/v1/class-groups', input);
}

export async function listEnrollments(classGroupId: string): Promise<Enrollment[]> {
  return api.get(`/v1/class-groups/${classGroupId}/enrollments`);
}

export async function enrollPerson(classGroupId: string, input: EnrollPersonInput): Promise<Enrollment> {
  return api.post(`/v1/class-groups/${classGroupId}/enrollments`, input);
}

export async function listClassSessions(classGroupId?: string): Promise<ClassSession[]> {
  return api.get(`/v1/class-sessions${buildQuery({ classGroupId })}`);
}

export async function createClassSession(input: CreateClassSessionInput): Promise<{ classSessionId: string }> {
  return api.post('/v1/class-sessions', input);
}
