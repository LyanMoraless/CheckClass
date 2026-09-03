import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  ClassGroupEnrollmentEntity,
  ClassGroupEntity,
  ClassGroupSubjectEntity,
  CourseEntity,
  LeadershipAssignmentEntity,
  LeadershipRoleEntity,
  RoomEntity,
  SubjectEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ClassGroupDeletionOrchestrator } from '../class-group-deletion/class-group-deletion-orchestrator.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

const TEACHER_LEADERSHIP_ROLE_NAME = 'Professor';

// RULE-INST-11: fixed 4-value enum (Ativo/Trancado/Formado/Evadido), free
// transitions between all four, no state machine (confirmed) — English
// naming favors actual academic-English terms over literal translation.
// Shared with UpdateEnrollmentStatusDto's @IsIn so the DTO and the service
// never drift out of sync on the valid-values list.
export const ENROLLMENT_STATUSES = ['active', 'on_leave', 'graduated', 'withdrawn'] as const;

// A turma's subject list arrives from a multi-select form (RULE-INST-14's
// montar-turma screen) — a repeated id there is a UI artifact, not a request
// to link twice, and linkSubject's own no-op would already absorb it. Dedupe
// up front anyway so the loop does one pass per real matéria.
function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

export interface CreateClassGroupInput {
  // RULE-INST-14: the turma belongs to a Curso, not to a single Matéria. Its
  // matérias are a separate, editable set (subjectIds below, then
  // addSubject/removeSubject) — deliberately optional here so a coordinator
  // can create the turma first and compose it afterwards, which is also the
  // only way the "turma sem matéria" state stays reachable by construction.
  courseId: string;
  subjectIds?: string[];
  name: string;
  // RULE-INST-07: room lives on the turma itself (schema already migrated —
  // see AddClassGroupScheduleFields). RULE-INST-10 (schedule-conflict
  // detection over this room) is explicitly out of scope here — a future,
  // separate ScheduleConflictDetectionService task
  // (architecture-overview.md, "Cronograma automático").
  roomId?: string;
  // ISO date strings ("YYYY-MM-DD"), matching @IsDateString() on the DTO —
  // passed straight through to the `date`-typed columns.
  termStartDate?: string;
  termEndDate?: string;
}

// RULE-INST-14: a turma read from the list screen without its matérias is
// unusable — the set is the thing that replaced the old single subject column.
export type ListedClassGroup = ClassGroupEntity & { subjectIds: string[] };

export interface EnrollInput {
  classGroupId: string;
  personId: string;
  role: string;
}

export interface UnenrollInput {
  classGroupId: string;
  personId: string;
}

export interface UpdateEnrollmentStatusInput {
  classGroupId: string;
  personId: string;
  status: string;
}

// RULE-INST-09: montar/editar turma requires leadership authority over the
// turma's course, cumulatively with the MANAGE_INSTITUTION_STRUCTURE
// permission already gated at the controller (RULE-INST-12) — never as an
// alternative to it.
@Injectable()
export class ClassGroupService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly deletionOrchestrator: ClassGroupDeletionOrchestrator,
  ) {}

  async create(input: CreateClassGroupInput, authenticatedPersonId: string): Promise<ClassGroupEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const course = await manager.getRepository(CourseEntity).findOneBy({ id: input.courseId });
    if (!course) {
      throw new NotFoundException(`course ${input.courseId} not found`);
    }

    // Same "validate FK exists, 404 if not" precedent as SubjectService.create
    // for courseId (itself following AreaService/CameraService) — roomId is a
    // direct user input here (RULE-INST-07's turma-level room), not one
    // internally inherited/COALESCEd from elsewhere, so it gets the same
    // treatment.
    if (input.roomId) {
      const room = await manager.getRepository(RoomEntity).findOneBy({ id: input.roomId });
      if (!room) {
        throw new NotFoundException(`room ${input.roomId} not found`);
      }
    }

    // No class_group exists yet for this turma-to-be — authority is checked
    // against the whole course (coordinator) or institution-wide (Direção/
    // Reitoria), never a class_group-scoped assignment (there is nothing to
    // scope to yet).
    const authorized = await this.leadershipScope.hasAuthorityOverCourse(authenticatedPersonId, input.courseId);
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${authenticatedPersonId} has no leadership authority over course ${input.courseId} (RULE-INST-09)`,
      );
    }

    const repository = manager.getRepository(ClassGroupEntity);
    const classGroup = await repository.save(
      repository.create({
        tenantId,
        courseId: input.courseId,
        name: input.name,
        roomId: input.roomId ?? null,
        // ClassGroupEntity's `date`-typed columns are Date | null — the DTO
        // hands this an @IsDateString() ISO string, converted here at the
        // service boundary.
        termStartDate: input.termStartDate ? new Date(input.termStartDate) : null,
        termEndDate: input.termEndDate ? new Date(input.termEndDate) : null,
      }),
    );

    for (const subjectId of dedupe(input.subjectIds ?? [])) {
      await this.linkSubject(manager, tenantId, classGroup, subjectId);
    }

    return classGroup;
  }

  // RULE-INST-14: a turma's native filter is its course again — the matéria
  // is no longer a property of the turma, so "turmas desta matéria" is a
  // different question, answered by joining class_group_subject
  // (subjectId below), not by filtering a column. Each row carries its
  // subjectIds: the list screen has to show a set now, and resolving it per
  // row from the client would be one request per turma.
  async list(filter?: { courseId?: string; subjectId?: string }): Promise<ListedClassGroup[]> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(ClassGroupEntity);
    const linkRepository = manager.getRepository(ClassGroupSubjectEntity);

    let classGroups: ClassGroupEntity[];
    if (filter?.subjectId) {
      const links = await linkRepository.find({ where: { subjectId: filter.subjectId }, select: ['classGroupId'] });
      const classGroupIds = links.map((link) => link.classGroupId);
      if (classGroupIds.length === 0) {
        return [];
      }
      classGroups = await repository.findBy(
        filter.courseId ? { id: In(classGroupIds), courseId: filter.courseId } : { id: In(classGroupIds) },
      );
    } else {
      classGroups = filter?.courseId ? await repository.findBy({ courseId: filter.courseId }) : await repository.find();
    }

    if (classGroups.length === 0) {
      return [];
    }

    const allLinks = await linkRepository.findBy({ classGroupId: In(classGroups.map((group) => group.id)) });
    return classGroups.map((classGroup) => ({
      ...classGroup,
      subjectIds: allLinks.filter((link) => link.classGroupId === classGroup.id).map((link) => link.subjectId),
    }));
  }

  // RULE-INST-14: the turma's set of matérias — read, add, remove. Read is
  // ungated beyond the controller's MANAGE_INSTITUTION_STRUCTURE, same
  // read-only shape as listEnrollments; the two writes are montar-turma
  // actions and carry the full cumulative RULE-INST-09 check.
  async listSubjects(classGroupId: string): Promise<ClassGroupSubjectEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(ClassGroupSubjectEntity).find({ where: { classGroupId } });
  }

  async addSubject(classGroupId: string, subjectId: string, authenticatedPersonId: string): Promise<ClassGroupSubjectEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const classGroup = await this.resolveClassGroup(manager, classGroupId);
    await this.assertAuthorityOverClassGroup(authenticatedPersonId, classGroup.courseId, classGroup.id);

    return this.linkSubject(manager, tenantId, classGroup, subjectId);
  }

  // RULE-INST-14 + RULE-INST-08 addendum: unlinking a matéria removes that
  // matéria's slots and sessions from this turma and nothing else. Removing
  // the LAST one is allowed — the turma survives empty (user-confirmed,
  // 2026-09-03), keeping its enrollments and its history, waiting for a new
  // matéria. Blocked only by RULE-INST-13, scoped to this matéria's own
  // sessions (ClassGroupDeletionOrchestrator.assertSubjectRemovable).
  async removeSubject(classGroupId: string, subjectId: string, authenticatedPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();

    const classGroup = await this.resolveClassGroup(manager, classGroupId);
    await this.assertAuthorityOverClassGroup(authenticatedPersonId, classGroup.courseId, classGroup.id);

    const link = await manager.getRepository(ClassGroupSubjectEntity).findOneBy({ classGroupId, subjectId });
    if (!link) {
      // Same "referenced entity not found" convention as unenroll's missing
      // enrollment — there is no already-removed state to return instead.
      throw new NotFoundException(`subject ${subjectId} is not linked to class_group ${classGroupId}`);
    }

    await this.deletionOrchestrator.assertSubjectRemovable(classGroupId, subjectId);
    await this.deletionOrchestrator.removeSubjectFromClassGroup(manager, classGroupId, subjectId);
  }

  // RULE-INST-05: assigning a teacher to a turma automatically grants them
  // pending-review resolution authority for that specific turma (RULE-ATT-12)
  // — a class_group-scoped leadership_assignment, created alongside the
  // enrollment itself. No extra manager.transaction() wrapping is needed
  // here: TenantContextService.runWithTenant already runs the whole
  // request inside one DB transaction (see tenant-context.service.ts), so
  // both writes below already commit/roll back together. Co-docência
  // (RULE-INST-05, third round): every teacher's assignment is independent,
  // granted per enrollment — never shared across the turma's teachers.
  async enroll(input: EnrollInput, authenticatedPersonId: string): Promise<ClassGroupEnrollmentEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const classGroup = await this.resolveClassGroup(manager, input.classGroupId);
    await this.assertAuthorityOverClassGroup(authenticatedPersonId, classGroup.courseId, classGroup.id);

    const repository = manager.getRepository(ClassGroupEnrollmentEntity);
    const existing = await repository.findOneBy({ classGroupId: input.classGroupId, personId: input.personId });
    if (existing) {
      return existing; // already enrolled — not an error
    }

    const enrollment = await repository.save(
      repository.create({ tenantId, classGroupId: input.classGroupId, personId: input.personId, role: input.role }),
    );

    if (input.role === 'teacher') {
      await this.grantTeacherLeadership(manager, tenantId, input.personId, classGroup.courseId, classGroup.id);
    }

    return enrollment;
  }

  async listEnrollments(classGroupId: string): Promise<ClassGroupEnrollmentEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(ClassGroupEnrollmentEntity).findBy({ classGroupId });
  }

  // Symmetric to enroll() (RULE-INST-05, second round): removing a teacher
  // from a turma automatically revokes ONLY the class_group-scoped
  // leadership_assignment that THIS exact enrollment granted — never a
  // broader course-wide or institution-wide assignment the person may
  // separately hold, and never another co-teacher's independent assignment
  // on the same turma (third round — co-docência).
  async unenroll(input: UnenrollInput, authenticatedPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();

    const classGroup = await this.resolveClassGroup(manager, input.classGroupId);
    await this.assertAuthorityOverClassGroup(authenticatedPersonId, classGroup.courseId, classGroup.id);

    const enrollmentRepository = manager.getRepository(ClassGroupEnrollmentEntity);
    const enrollment = await enrollmentRepository.findOneBy({
      classGroupId: input.classGroupId,
      personId: input.personId,
    });
    if (!enrollment) {
      // Symmetric-idempotency counterpart of enroll()'s silent no-op: there
      // is no already-removed state to fall back to return, so this
      // follows the same "referenced entity not found" NotFoundException
      // convention already used across the codebase (e.g. CameraService,
      // AreaService, SubjectService).
      throw new NotFoundException(
        `class_group_enrollment for person ${input.personId} in class_group ${input.classGroupId} not found`,
      );
    }

    await enrollmentRepository.delete({ id: enrollment.id });

    if (enrollment.role === 'teacher') {
      await manager.getRepository(LeadershipAssignmentEntity).delete({
        personId: input.personId,
        courseId: classGroup.courseId,
        classGroupId: input.classGroupId,
      });
    }
  }

  // RULE-INST-11: free transitions between the four enrollment_status
  // values, no state machine — status is validated as one of
  // ENROLLMENT_STATUSES (UpdateEnrollmentStatusDto's @IsIn) and applied
  // as-is, regardless of the enrollment's current value. Authorization: same
  // cumulative check as enroll/unenroll (MANAGE_INSTITUTION_STRUCTURE at the
  // controller + hasAuthorityOverClassGroup here) — this is part of the
  // turma's composition/management, not the separate Tela Alunos read screen
  // (RULE-INST-12's MANAGE_USERS applies there, not to this write).
  async updateEnrollmentStatus(input: UpdateEnrollmentStatusInput, authenticatedPersonId: string): Promise<ClassGroupEnrollmentEntity> {
    const manager = this.tenantContext.getManager();

    const classGroup = await this.resolveClassGroup(manager, input.classGroupId);
    await this.assertAuthorityOverClassGroup(authenticatedPersonId, classGroup.courseId, classGroup.id);

    const enrollmentRepository = manager.getRepository(ClassGroupEnrollmentEntity);
    const enrollment = await enrollmentRepository.findOneBy({
      classGroupId: input.classGroupId,
      personId: input.personId,
    });
    if (!enrollment) {
      throw new NotFoundException(
        `class_group_enrollment for person ${input.personId} in class_group ${input.classGroupId} not found`,
      );
    }

    await enrollmentRepository.update({ id: enrollment.id }, { enrollmentStatus: input.status });
    return enrollmentRepository.findOneByOrFail({ id: enrollment.id });
  }

  // RULE-INST-08/13: deleting a turma directly. Authority is checked here
  // (RULE-INST-09, same as enroll/unenroll/updateEnrollmentStatus) — the
  // orchestrator itself deliberately does not check authorization, only
  // deletability (attendance activity).
  async delete(classGroupId: string, authenticatedPersonId: string): Promise<void> {
    const classGroup = await this.resolveClassGroup(this.tenantContext.getManager(), classGroupId);
    await this.assertAuthorityOverClassGroup(authenticatedPersonId, classGroup.courseId, classGroup.id);
    await this.deletionOrchestrator.deleteClassGroup(classGroupId);
  }

  // RULE-INST-14: the subject hop that used to be needed to reach the course
  // is gone — class_group.courseId is the turma's own column again, which is
  // also the only thing that still works for a turma with zero matérias.
  private async resolveClassGroup(manager: EntityManager, classGroupId: string): Promise<ClassGroupEntity> {
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }
    return classGroup;
  }

  // RULE-INST-14: a turma may only study matérias of its OWN course — the
  // invariant the schema deliberately does not encode (a composite FK would
  // buy nothing here), so it is enforced at exactly this one write path,
  // shared by create() and addSubject(). Re-linking an already-linked matéria
  // is a silent no-op, same idempotency choice as enroll().
  private async linkSubject(
    manager: EntityManager,
    tenantId: string,
    classGroup: ClassGroupEntity,
    subjectId: string,
  ): Promise<ClassGroupSubjectEntity> {
    const subject = await manager.getRepository(SubjectEntity).findOneBy({ id: subjectId });
    if (!subject) {
      throw new NotFoundException(`subject ${subjectId} not found`);
    }
    if (subject.courseId !== classGroup.courseId) {
      throw new BadRequestException(
        `subject ${subjectId} belongs to course ${subject.courseId}, not to class_group ${classGroup.id}'s course ${classGroup.courseId} (RULE-INST-14)`,
      );
    }

    const repository = manager.getRepository(ClassGroupSubjectEntity);
    const existing = await repository.findOneBy({ classGroupId: classGroup.id, subjectId });
    if (existing) {
      return existing;
    }

    return repository.save(repository.create({ tenantId, classGroupId: classGroup.id, subjectId }));
  }

  private async assertAuthorityOverClassGroup(personId: string, courseId: string, classGroupId: string): Promise<void> {
    const authorized = await this.leadershipScope.hasAuthorityOverClassGroup(personId, courseId, classGroupId);
    if (!authorized) {
      throw new ForbiddenException(`Person ${personId} has no leadership authority over class_group ${classGroupId} (RULE-INST-09)`);
    }
  }

  // RULE-INST-05: resolves the leadership_role row named "Professor" to
  // attach to the class_group-scoped leadership_assignment a teacher
  // enrollment grants. TenantBootstrapService seeds this row (along with
  // "Coordenador de Curso"/"Direção/Reitoria") for faculdade tenants at
  // onboarding time — TEACHER_LEADERSHIP_ROLE_NAME above must keep matching
  // that seed literally. There is still no leadership_role CRUD anywhere in
  // this codebase (no admin module) — creating/renaming roles after
  // onboarding is out of scope for this task, so a missing "Professor" role
  // (e.g. a non-faculdade tenant, which gets no seeding at all) fails loudly
  // with a clear, actionable error instead of silently skipping the
  // automatic grant or guessing an id.
  private async grantTeacherLeadership(
    manager: EntityManager,
    tenantId: string,
    personId: string,
    courseId: string,
    classGroupId: string,
  ): Promise<void> {
    const professorRole = await manager.getRepository(LeadershipRoleEntity).findOneBy({ name: TEACHER_LEADERSHIP_ROLE_NAME });
    if (!professorRole) {
      throw new NotFoundException(
        `leadership_role "${TEACHER_LEADERSHIP_ROLE_NAME}" not found for this tenant — register it before assigning a teacher to a turma`,
      );
    }

    const repository = manager.getRepository(LeadershipAssignmentEntity);
    await repository.save(
      repository.create({ tenantId, personId, leadershipRoleId: professorRole.id, courseId, classGroupId }),
    );
  }
}
