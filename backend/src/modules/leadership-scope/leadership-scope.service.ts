import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { LeadershipAssignmentEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

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
}
