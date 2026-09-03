import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

export interface CoordinatedClassGroupEntry {
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: a turma studies N matérias — plural by construction, and
  // empty for a turma that currently has none (RULE-INST-08 addendum).
  subjectNames: string[];
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
        subs.names AS "subjectNames",
        c.name AS "courseName"
      FROM class_group cg
      JOIN course c ON c.id = cg.course_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(array_agg(s.name ORDER BY s.name), '{}'::text[]) AS names
        FROM class_group_subject cgs
        JOIN subject s ON s.id = cgs.subject_id
        WHERE cgs.class_group_id = cg.id
      ) subs ON TRUE
      WHERE cg.tenant_id = $1 AND ($2::boolean OR cg.course_id = ANY($3::uuid[]))
      ORDER BY c.name ASC, cg.name ASC
      `,
      [tenantId, allCourses, courseIds],
    );
  }
}
