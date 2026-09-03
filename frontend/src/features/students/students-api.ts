import { api } from '../../lib/api-client';

// RULE-INST-11 (business-rules/references/institution-management-rules.md):
// fixed 4-value enum, transitions are free between all of them (no state
// machine) — mirrored here as a union, not an open string, so a typo in a
// label lookup fails at compile time instead of silently falling back.
export type EnrollmentStatus = 'active' | 'on_leave' | 'graduated' | 'withdrawn';

export interface StudentEnrollment {
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: a turma studies N matérias — plural, and empty for a
  // turma that currently has none.
  subjectNames: string[];
  courseName: string;
  enrollmentStatus: EnrollmentStatus;
}

export interface Student {
  personId: string;
  fullName: string;
  hasLoginCredential: boolean;
  // A person can have 0 (backend already filters those out of this list — see
  // GET /v1/students contract), 1, or several simultaneous enrollments —
  // RULE-ATT-06 already treats being in more than one class group at once as
  // normal elsewhere in the system.
  enrollments: StudentEnrollment[];
}

// Gated MANAGE_USERS server-side (RULE-INST-12) — same permission already
// used by GET /v1/users, reused rather than a new permission for this screen.
export async function listStudents(): Promise<Student[]> {
  return api.get('/v1/students');
}
