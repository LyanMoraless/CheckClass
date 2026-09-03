import { api, buildQuery } from '../../lib/api-client';

// RULE-INST-14: a Turma is a cohort of a Curso that studies N Matérias —
// `subjectIds` is the set (possibly empty: a turma survives losing its last
// matéria), sent inline by the list endpoint so the screen doesn't need one
// request per turma to render it.
export interface ClassGroup {
  id: string;
  courseId: string;
  subjectIds: string[];
  name: string;
  roomId: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
}

export interface CreateClassGroupInput {
  courseId: string;
  // Optional: a turma can be created first and composed afterwards.
  subjectIds?: string[];
  name: string;
  roomId?: string;
  termStartDate?: string;
  termEndDate?: string;
}

export interface ClassGroupSubject {
  id: string;
  classGroupId: string;
  subjectId: string;
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

export async function listClassGroups(filter: { courseId?: string; subjectId?: string } = {}): Promise<ClassGroup[]> {
  return api.get(`/v1/class-groups${buildQuery(filter)}`);
}

export async function createClassGroup(input: CreateClassGroupInput): Promise<ClassGroup> {
  return api.post('/v1/class-groups', input);
}

export async function listClassGroupSubjects(classGroupId: string): Promise<ClassGroupSubject[]> {
  return api.get(`/v1/class-groups/${classGroupId}/subjects`);
}

export async function addClassGroupSubject(classGroupId: string, subjectId: string): Promise<ClassGroupSubject> {
  return api.post(`/v1/class-groups/${classGroupId}/subjects`, { subjectId });
}

// RULE-INST-08 addendum: removes this matéria's slots and aulas from the
// turma only — the turma survives, even when this was its last matéria. The
// backend answers 409 if that matéria's aulas already have presença
// registrada (RULE-INST-13), surfaced like any other mutation error.
export async function removeClassGroupSubject(classGroupId: string, subjectId: string): Promise<void> {
  await api.delete(`/v1/class-groups/${classGroupId}/subjects/${subjectId}`);
}

export async function listEnrollments(classGroupId: string): Promise<Enrollment[]> {
  return api.get(`/v1/class-groups/${classGroupId}/enrollments`);
}

export async function enrollPerson(classGroupId: string, input: EnrollPersonInput): Promise<Enrollment> {
  return api.post(`/v1/class-groups/${classGroupId}/enrollments`, input);
}
