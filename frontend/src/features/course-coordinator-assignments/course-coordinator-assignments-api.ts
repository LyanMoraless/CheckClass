import { api } from '../../lib/api-client';

// "Decisão de arquitetura — Portal de Autoatendimento Web, estrutura",
// item 5: minimal admin CRUD to assign the "Coordenador de Curso"
// leadership_role (leadership-role.entity.ts / leadership-assignment.entity.ts,
// same LeadershipScopeService precedent already used by RULE-INST-09 and
// RULE-ATT-12) to a person, scoped to a course. Confirmed against the actual
// backend implementation
// (backend/src/modules/leadership-assignment/course-coordinator-assignment.*):
// path is /v1/course-coordinator-assignments, gated on
// manage_institution_structure — no new Permission was introduced for this.
export interface CourseCoordinatorAssignment {
  id: string;
  personId: string;
  personFullName: string;
  courseId: string;
  courseName: string;
  createdAt: string;
}

export interface CreateCourseCoordinatorAssignmentInput {
  personId: string;
  courseId: string;
}

// POST returns the raw leadership_assignment row (id/tenantId/personId/
// leadershipRoleId/courseId/classGroupId/timestamps), not the joined shape
// list() returns — this feature only needs id/personId/courseId out of it,
// so only those are typed here.
export interface CreatedCourseCoordinatorAssignment {
  id: string;
  personId: string;
  courseId: string;
}

export async function listCourseCoordinatorAssignments(): Promise<CourseCoordinatorAssignment[]> {
  return api.get('/v1/course-coordinator-assignments');
}

export async function createCourseCoordinatorAssignment(
  input: CreateCourseCoordinatorAssignmentInput,
): Promise<CreatedCourseCoordinatorAssignment> {
  return api.post('/v1/course-coordinator-assignments', input);
}

export async function revokeCourseCoordinatorAssignment(assignmentId: string): Promise<void> {
  await api.delete(`/v1/course-coordinator-assignments/${assignmentId}`);
}
