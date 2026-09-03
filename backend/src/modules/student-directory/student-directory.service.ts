import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

export interface StudentEnrollment {
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: a turma studies N matérias — the enrollment is to the turma
  // as a whole (RULE-INST-11), so this carries the turma's full set, empty
  // included.
  subjectNames: string[];
  courseName: string;
  enrollmentStatus: string;
}

export interface ListedStudent {
  personId: string;
  fullName: string;
  hasLoginCredential: boolean;
  enrollments: StudentEnrollment[];
}

interface StudentEnrollmentRow {
  personId: string;
  fullName: string;
  hasLoginCredential: boolean;
  classGroupId: string;
  classGroupName: string;
  subjectNames: string[];
  courseName: string;
  enrollmentStatus: string;
}

// Backs the dedicated "Alunos" screen (architecture-overview.md, "Escopo
// confirmado — Tela Alunos dedicada", RULE-INST-11) — distinct from the
// generic "Usuários" screen (PersonManagementService.list()), which shows
// name/login-credential only, with no notion of enrollment. RULE-INST-12:
// reuses MANAGE_USERS, no new permission and no LeadershipScopeService
// check (this is administrative reading of people, same reasoning already
// applied to GET /v1/users — not a "montar turma" action).
//
// "Aluno" here means: a person with at least one class_group_enrollment row
// with role = 'student' — NOT actor_type (a free label on the person,
// unrelated to class_group_enrollment.role, a per-turma role). A person
// with zero such rows (e.g. just registered, not yet placed in any turma)
// intentionally does not appear in this list, even if their actor_type
// happens to be "student": the screen exists specifically to show
// enrollment situation, so someone with no enrollment at all isn't a
// "student" in the sense this screen cares about yet. This is implemented
// naturally by INNER JOINing class_group_enrollment instead of a LEFT
// JOIN — no separate filtering step needed.
@Injectable()
export class StudentDirectoryService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async list(): Promise<ListedStudent[]> {
    const manager = this.tenantContext.getManager();
    const rows: StudentEnrollmentRow[] = await manager.query(`
      SELECT
        p.id AS "personId",
        p.full_name AS "fullName",
        (pc.id IS NOT NULL) AS "hasLoginCredential",
        cge.class_group_id AS "classGroupId",
        cg.name AS "classGroupName",
        subs.names AS "subjectNames",
        c.name AS "courseName",
        cge.enrollment_status AS "enrollmentStatus"
      FROM person p
      JOIN class_group_enrollment cge ON cge.person_id = p.id AND cge.role = 'student'
      JOIN class_group cg ON cg.id = cge.class_group_id
      JOIN course c ON c.id = cg.course_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(array_agg(s.name ORDER BY s.name), '{}'::text[]) AS names
        FROM class_group_subject cgs
        JOIN subject s ON s.id = cgs.subject_id
        WHERE cgs.class_group_id = cg.id
      ) subs ON TRUE
      LEFT JOIN person_credential pc ON pc.person_id = p.id
      ORDER BY p.full_name ASC, cg.name ASC
    `);

    return this.groupByPerson(rows);
  }

  // Flattened rows (one per enrollment) grouped in TypeScript rather than
  // via SQL aggregation (e.g. json_agg) — a person enrolled in several
  // turmas simultaneously is an already-known case in this project
  // (RULE-ATT-06, check-in), and grouping here keeps that fan-out easy to
  // read/test instead of hiding it inside a more complex query.
  private groupByPerson(rows: StudentEnrollmentRow[]): ListedStudent[] {
    const studentsByPersonId = new Map<string, ListedStudent>();

    for (const row of rows) {
      let student = studentsByPersonId.get(row.personId);
      if (!student) {
        student = {
          personId: row.personId,
          fullName: row.fullName,
          hasLoginCredential: row.hasLoginCredential,
          enrollments: [],
        };
        studentsByPersonId.set(row.personId, student);
      }

      student.enrollments.push({
        classGroupId: row.classGroupId,
        classGroupName: row.classGroupName,
        subjectNames: row.subjectNames,
        courseName: row.courseName,
        enrollmentStatus: row.enrollmentStatus,
      });
    }

    return [...studentsByPersonId.values()];
  }
}
