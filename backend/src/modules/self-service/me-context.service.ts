import { Injectable } from '@nestjs/common';
import { TenantEntity } from '../../database/entities';
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
  // RULE-JUST-10: the Portal itself stays agnostic of institutionType (see
  // architecture-overview.md's addendum), but as of Frente 07 one feature
  // (Justificativa de Faltas) is faculdade-only, so the frontend needs this
  // value to decide whether to show that area's navigation at all — the
  // gate itself is still enforced server-side by
  // AbsenceJustificationAreaGateService, this is only for menu visibility.
  institutionType: string;
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
    const [isStudent, teaching, courseScope, institutionType] = await Promise.all([
      this.isStudent(personId),
      this.teachingClassGroups.getTeachingClassGroups(personId),
      this.leadershipScope.getCourseScope(personId),
      this.institutionType(),
    ]);

    const coordinating = await this.coordinatingCourses(courseScope.courseIds);

    return {
      isStudent,
      teaching,
      coordinating,
      isDirection: courseScope.allCourses,
      institutionType,
    };
  }

  // Read straight from the tenant registry, same call shape
  // ExamAvailabilityService.assertExamAreaEnabled() already uses for the
  // same table (not RLS-scoped — it has no tenant_id column of its own, id
  // IS the tenant). findOneByOrFail is safe here: a request never reaches
  // this service without an already-authenticated JWT for a tenantId that
  // exists. If that assumption were ever wrong, the raw EntityNotFoundError
  // would propagate uncaught into a generic 500 (it is not a NestJS
  // HttpException) — accepted deliberately, not caught defensively, same as
  // findOneByOrFail's other structurally-guaranteed-valid-FK uses in this
  // codebase; see
  // test_getContext_tenantNotFound_propagatesEntityNotFoundErrorUncaught in
  // me-context.service.spec.ts for the pinned-down behavior.
  private async institutionType(): Promise<string> {
    const tenantId = this.tenantContext.getTenantId();
    const tenant = await this.tenantContext.getManager().getRepository(TenantEntity).findOneByOrFail({ id: tenantId });
    return tenant.institutionType;
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
