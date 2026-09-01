import { api, buildQuery } from '../../lib/api-client';

export interface ClassGroup {
  id: string;
  subjectId: string;
  name: string;
  roomId: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
}

export interface CreateClassGroupInput {
  subjectId: string;
  name: string;
  roomId?: string;
  termStartDate?: string;
  termEndDate?: string;
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

export async function listClassGroups(subjectId?: string): Promise<ClassGroup[]> {
  return api.get(`/v1/class-groups${buildQuery({ subjectId })}`);
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
