import { Injectable } from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import { LeadershipAssignmentEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface CourseScope {
  allCourses: boolean;
  courseIds: string[];
}

// Shared authority-scope check, extracted from what used to be
// PendingReviewService.isAuthorizedToResolve() (RULE-ATT-12) — reused as-is
// by "montar turma" (RULE-INST-09, architecture-overview.md) instead of two
// parallel implementations of the same leadership_assignment scoping.
@Injectable()
export class LeadershipScopeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // RULE-ATT-12 literally scopes authority to "a aula/turma em questão" — an
  // assignment authorizes an action over this specific class_group when it
  // reaches it: either scoped exactly to it, scoped to the whole course
  // (class_group_id NULL), or institution-wide (course_id NULL, which
  // reaches every course and therefore every class_group).
  async hasAuthorityOverClassGroup(personId: string, courseId: string, classGroupId: string): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const count = await manager.getRepository(LeadershipAssignmentEntity).count({
      where: [
        { personId, courseId, classGroupId },
        { personId, courseId, classGroupId: IsNull() },
        { personId, courseId: IsNull() },
      ],
    });
    return count > 0;
  }

  // Course-wide variant, for flows with no specific class_group yet (e.g.
  // creating a brand-new turma under a course, RULE-INST-09) — only the two
  // branches above that don't depend on classGroupId: whole-course scope, or
  // institution-wide (courseId NULL). Deliberately excludes a
  // class_group-scoped assignment (a plain teacher of one turma under this
  // course does not thereby get authority to create ANOTHER turma under the
  // same course).
  async hasAuthorityOverCourse(personId: string, courseId: string): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const count = await manager.getRepository(LeadershipAssignmentEntity).count({
      where: [
        { personId, courseId, classGroupId: IsNull() },
        { personId, courseId: IsNull() },
      ],
    });
    return count > 0;
  }

  // Portal de Autoatendimento web (architecture-overview.md, "Decisão de
  // arquitetura — Portal de Autoatendimento Web, estrutura"): the listing
  // counterpart to hasAuthorityOverCourse's boolean check, reused both by
  // GET /v1/me/context (coordinating/isDirection) and by
  // GET /v1/me/coordinated-class-groups. Same course-wide branch semantics
  // as hasAuthorityOverCourse (courseId set AND classGroupId NULL) — a
  // class_group-scoped assignment (a plain teacher of one turma) is
  // deliberately excluded here too, same reasoning as that method: it
  // doesn't make someone a course coordinator. allCourses mirrors the
  // institution-wide branch (courseId NULL) — RULE-INST-09's confirmed
  // Direção/Reitoria auto-inheritance over every course.
  async getCourseScope(personId: string): Promise<CourseScope> {
    const manager = this.tenantContext.getManager();
    // No `select` here on purpose: a `select` array that omits the primary
    // key (`id`) silently breaks TypeORM's `find()` against this multi-OR
    // `where` shape — it was returning an empty result set even though the
    // matching row existed (found by running this against real Postgres,
    // not the mocked-repository unit test, which doesn't reproduce the
    // issue). Fetching full entities avoids it; the row count per person is
    // always tiny (their own leadership assignments), so there's no
    // meaningful cost to not narrowing the columns.
    const assignments = await manager.getRepository(LeadershipAssignmentEntity).find({
      where: [
        { personId, courseId: IsNull() },
        { personId, courseId: Not(IsNull()), classGroupId: IsNull() },
      ],
    });

    const allCourses = assignments.some((assignment) => assignment.courseId === null);
    const courseIds = [...new Set(assignments.filter((assignment) => assignment.courseId !== null).map((assignment) => assignment.courseId as string))];

    return { allCourses, courseIds };
  }
}
