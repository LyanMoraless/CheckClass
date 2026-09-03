import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

export interface TeachingClassGroupEntry {
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: a turma studies N matérias — RULE-INST-05 keeps the
  // professor bound to the whole turma, not to one of its matérias, so this
  // list stays turma-level and just shows the full set.
  subjectNames: string[];
  courseName: string;
}

// GET /v1/me/teaching-class-groups (architecture-overview.md, "Decisão de
// arquitetura — Portal de Autoatendimento Web, estrutura"): the turmas where
// this person has class_group_enrollment.role = 'teacher'. RULE-INST-05's
// co-docência is covered by construction here — every teacher of a turma has
// their own enrollment row, so a turma with multiple teachers simply shows
// up for each of them independently, no extra logic needed. Reused by
// MeContextService for the "teaching" field of GET /v1/me/context, so this
// query lives in exactly one place.
@Injectable()
export class TeachingClassGroupsService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async getTeachingClassGroups(personId: string): Promise<TeachingClassGroupEntry[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        cg.id AS "classGroupId",
        cg.name AS "classGroupName",
        subs.names AS "subjectNames",
        c.name AS "courseName"
      FROM class_group_enrollment cge
      JOIN class_group cg ON cg.id = cge.class_group_id
      JOIN course c ON c.id = cg.course_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(array_agg(s.name ORDER BY s.name), '{}'::text[]) AS names
        FROM class_group_subject cgs
        JOIN subject s ON s.id = cgs.subject_id
        WHERE cgs.class_group_id = cg.id
      ) subs ON TRUE
      WHERE cge.tenant_id = $1 AND cge.person_id = $2 AND cge.role = 'teacher'
      ORDER BY c.name ASC, cg.name ASC
      `,
      [tenantId, personId],
    );
  }
}
