import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CourseEntity, LeadershipAssignmentEntity, LeadershipRoleEntity, PersonEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

const COURSE_COORDINATOR_ROLE_NAME = 'Coordenador de Curso';

export interface AssignCourseCoordinatorInput {
  personId: string;
  courseId: string;
}

export interface CourseCoordinatorAssignmentEntry {
  id: string;
  personId: string;
  personFullName: string;
  courseId: string;
  courseName: string;
  createdAt: Date;
}

// Item 7 of the Backend Agent's handoff for the Portal de Autoatendimento
// pivot (architecture-overview.md, "Decisão de arquitetura — Portal de
// Autoatendimento Web, estrutura", point 5): before this module, there was
// NO way to promote anyone to Coordenador de Curso — only Direção (granted
// automatically at onboarding, TenantBootstrapService) and Professor
// (granted automatically on turma enrollment, RULE-INST-05) ever got a
// leadership_assignment row. This reuses the existing leadership_role/
// leadership_assignment tables and RULE-INST-09 course-wide scope
// (courseId set, classGroupId NULL) as-is — it is not a new business rule,
// just the administrative CRUD that was missing.
//
// TEACHER_LEADERSHIP_ROLE_NAME's exact-string-match precedent
// (class-group.service.ts) applies here too: COURSE_COORDINATOR_ROLE_NAME
// must keep matching FACULDADE_LEADERSHIP_ROLES's "Coordenador de Curso"
// seed (tenant-bootstrap.service.ts) literally. A tenant not seeded with the
// faculdade leadership chain (e.g. escola, or a non-faculdade tenant type)
// has no such role — every operation below fails loudly with a clear error
// instead of silently doing nothing (same choice already made for the
// analogous "Professor" role lookup).
@Injectable()
export class CourseCoordinatorAssignmentService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async assign(input: AssignCourseCoordinatorInput): Promise<LeadershipAssignmentEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const person = await manager.getRepository(PersonEntity).findOneBy({ id: input.personId });
    if (!person) {
      throw new NotFoundException(`person ${input.personId} not found`);
    }

    const course = await manager.getRepository(CourseEntity).findOneBy({ id: input.courseId });
    if (!course) {
      throw new NotFoundException(`course ${input.courseId} not found`);
    }

    const coordinatorRole = await this.findCoordinatorRole(manager);

    const assignmentRepository = manager.getRepository(LeadershipAssignmentEntity);
    const existing = await assignmentRepository.findOneBy({
      personId: input.personId,
      courseId: input.courseId,
      leadershipRoleId: coordinatorRole.id,
    });
    if (existing) {
      // Already a coordinator of this course — same idempotent precedent as
      // ClassGroupService.enroll() for an existing enrollment, not an error.
      return existing;
    }

    return assignmentRepository.save(
      assignmentRepository.create({
        tenantId,
        personId: input.personId,
        leadershipRoleId: coordinatorRole.id,
        courseId: input.courseId,
        classGroupId: null,
      }),
    );
  }

  async list(): Promise<CourseCoordinatorAssignmentEntry[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        la.id AS "id",
        la.person_id AS "personId",
        p.full_name AS "personFullName",
        la.course_id AS "courseId",
        c.name AS "courseName",
        la.created_at AS "createdAt"
      FROM leadership_assignment la
      JOIN leadership_role lr ON lr.id = la.leadership_role_id
      JOIN person p ON p.id = la.person_id
      JOIN course c ON c.id = la.course_id
      WHERE la.tenant_id = $1 AND lr.name = $2
      ORDER BY c.name ASC, p.full_name ASC
      `,
      [tenantId, COURSE_COORDINATOR_ROLE_NAME],
    );
  }

  async revoke(assignmentId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const coordinatorRole = await this.findCoordinatorRole(manager);

    const assignmentRepository = manager.getRepository(LeadershipAssignmentEntity);
    // Scoped to the coordinator role on purpose — this endpoint must never
    // be usable to revoke a Professor's or Direção's leadership_assignment
    // by guessing/discovering their id; it only ever touches the rows it
    // itself is responsible for.
    const assignment = await assignmentRepository.findOneBy({ id: assignmentId, leadershipRoleId: coordinatorRole.id });
    if (!assignment) {
      throw new NotFoundException(`course coordinator assignment ${assignmentId} not found`);
    }

    await assignmentRepository.delete({ id: assignmentId });
  }

  private async findCoordinatorRole(manager: EntityManager): Promise<LeadershipRoleEntity> {
    const role = await manager.getRepository(LeadershipRoleEntity).findOneBy({ name: COURSE_COORDINATOR_ROLE_NAME });
    if (!role) {
      throw new NotFoundException(
        `leadership_role "${COURSE_COORDINATOR_ROLE_NAME}" not found for this tenant — this tenant likely wasn't seeded with the faculdade leadership chain (TenantBootstrapService)`,
      );
    }
    return role;
  }
}
