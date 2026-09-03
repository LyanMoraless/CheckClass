import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { TeachingClassGroupEntry, TeachingClassGroupsService } from './teaching-class-groups.service';

export interface CoordinatingCourseEntry {
  courseId: string;
  courseName: string;
}

export interface MeContext {
  isStudent: boolean;
  teaching: TeachingClassGroupEntry[];
  coordinating: CoordinatingCourseEntry[];
  isDirection: boolean;
}

// GET /v1/me/context (architecture-overview.md, "Decisão de arquitetura —
// Portal de Autoatendimento Web, estrutura"): the single read that drives
// which of the Portal's navigation groups (Aluno/Professor/Coordenador/
// Direção) a person sees, resolved fresh on every call rather than baked
// into a JWT claim — a role gained/lost mid-session (e.g. RULE-INST-05's
// automatic grant/revoke) must be reflected without forcing a new login. A
// person can see more than one group at once (Portal pivot, "Gaps
// resolvidos — segunda rodada", item 6) — the four fields below are
// independent, not mutually exclusive.
@Injectable()
export class MeContextService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly teachingClassGroups: TeachingClassGroupsService,
  ) {}

  async getContext(personId: string): Promise<MeContext> {
    const [isStudent, teaching, courseScope] = await Promise.all([
      this.isStudent(personId),
      this.teachingClassGroups.getTeachingClassGroups(personId),
      this.leadershipScope.getCourseScope(personId),
    ]);

    const coordinating = await this.coordinatingCourses(courseScope.courseIds);

    return {
      isStudent,
      teaching,
      coordinating,
      isDirection: courseScope.allCourses,
    };
  }

  private async isStudent(personId: string): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows = await manager.query(
      `SELECT 1 FROM class_group_enrollment WHERE tenant_id = $1 AND person_id = $2 AND role = 'student' LIMIT 1`,
      [tenantId, personId],
    );
    return rows.length > 0;
  }

  // Course names for the courseIds LeadershipScopeService.getCourseScope()
  // already resolved as course-wide (coordinator) — deliberately does NOT
  // list every course when isDirection is true: Direção's institution-wide
  // reach is represented by the isDirection flag alone, not by an
  // artificially-expanded "coordinating" list (GET
  // /v1/me/coordinated-class-groups is where the allCourses expansion
  // actually happens, for turmas).
  private async coordinatingCourses(courseIds: string[]): Promise<CoordinatingCourseEntry[]> {
    if (courseIds.length === 0) {
      return [];
    }

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `SELECT id AS "courseId", name AS "courseName" FROM course WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY name ASC`,
      [tenantId, courseIds],
    );
  }
}
