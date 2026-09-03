import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

export interface CoordinatedClassGroupEntry {
  classGroupId: string;
  classGroupName: string;
  subjectName: string;
  courseName: string;
}

// GET /v1/me/coordinated-class-groups (architecture-overview.md, "Decisão
// de arquitetura — Portal de Autoatendimento Web, estrutura"): Coordenador
// de Curso/Direção variant of TeachingClassGroupsService. Scope comes from
// LeadershipScopeService.getCourseScope() instead of a direct enrollment
// role — every turma under every course in courseIds, or every turma in the
// tenant when allCourses is true (Direção/Reitoria's institution-wide
// inheritance, "Gaps resolvidos — segunda rodada", item 4).
@Injectable()
export class CoordinatedClassGroupsService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
  ) {}

  async getCoordinatedClassGroups(personId: string): Promise<CoordinatedClassGroupEntry[]> {
    const { allCourses, courseIds } = await this.leadershipScope.getCourseScope(personId);
    if (!allCourses && courseIds.length === 0) {
      return [];
    }

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        cg.id AS "classGroupId",
        cg.name AS "classGroupName",
        sub.name AS "subjectName",
        c.name AS "courseName"
      FROM class_group cg
      JOIN subject sub ON sub.id = cg.subject_id
      JOIN course c ON c.id = sub.course_id
      WHERE cg.tenant_id = $1 AND ($2::boolean OR sub.course_id = ANY($3::uuid[]))
      ORDER BY c.name ASC, sub.name ASC, cg.name ASC
      `,
      [tenantId, allCourses, courseIds],
    );
  }
}
