import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassGroupSubjectEntity, CourseEntity, SubjectEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ClassGroupDeletionOrchestrator } from '../class-group-deletion/class-group-deletion-orchestrator.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

export interface CreateSubjectInput {
  courseId: string;
  name: string;
  code?: string;
}

// RULE-INST-03: Matéria sits between Curso and Turma — courseId is a
// required FK, so create() validates the course exists before saving
// (same "validate FK exists, 404 if not" pattern already used by
// AreaService.create for parentAreaId and CameraService.create for
// areaId).
@Injectable()
export class SubjectService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly deletionOrchestrator: ClassGroupDeletionOrchestrator,
  ) {}

  async create(input: CreateSubjectInput): Promise<SubjectEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const course = await manager.getRepository(CourseEntity).findOneBy({ id: input.courseId });
    if (!course) {
      throw new NotFoundException(`course ${input.courseId} not found`);
    }

    const repository = manager.getRepository(SubjectEntity);
    return repository.save(
      repository.create({ tenantId, courseId: input.courseId, name: input.name, code: input.code ?? null }),
    );
  }

  // Optional courseId filter — same shape as ClassGroupService.list's
  // subjectId filter — so the frontend can list a course's subjects when
  // assembling the Turma form (subjectId select scoped to the chosen course).
  async list(courseId?: string): Promise<SubjectEntity[]> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(SubjectEntity);
    return courseId ? repository.findBy({ courseId }) : repository.find();
  }

  // RULE-INST-08 (addendum, 2026-09-03): deleting a Matéria no longer
  // cascades into deleting Turmas. RULE-INST-14 made a turma a cohort of N
  // matérias, so a turma that also studies other matérias must obviously
  // survive — and the extreme case, the matéria being the turma's ONLY one,
  // was confirmed by the user to behave the same way, just taken to zero: the
  // turma survives empty, keeps its enrollments and history, and waits for a
  // new matéria. What IS removed, per turma, is exactly this matéria's own
  // footprint: the link, its recurring slots, its generated sessions.
  //
  // RULE-INST-13 still applies, now scoped to those sessions: tudo-ou-nada,
  // nothing is deleted anywhere if this matéria has recorded attendance
  // activity in ANY turma (same all-or-nothing precedent as before).
  // Authority: hasAuthorityOverCourse — deleting a Matéria is a course-level
  // action (RULE-INST-09), same check already used by
  // ClassGroupService.create() when creating a turma under a course.
  async delete(subjectId: string, authenticatedPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();

    const subject = await manager.getRepository(SubjectEntity).findOneBy({ id: subjectId });
    if (!subject) {
      throw new NotFoundException(`subject ${subjectId} not found`);
    }

    const authorized = await this.leadershipScope.hasAuthorityOverCourse(authenticatedPersonId, subject.courseId);
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${authenticatedPersonId} has no leadership authority over course ${subject.courseId} (RULE-INST-09)`,
      );
    }

    const links = await manager
      .getRepository(ClassGroupSubjectEntity)
      .find({ where: { subjectId }, select: ['classGroupId'] });
    const classGroupIds = links.map((link) => link.classGroupId);

    for (const classGroupId of classGroupIds) {
      await this.deletionOrchestrator.assertSubjectRemovable(classGroupId, subjectId);
    }
    for (const classGroupId of classGroupIds) {
      await this.deletionOrchestrator.removeSubjectFromClassGroup(manager, classGroupId, subjectId);
    }
    await manager.getRepository(SubjectEntity).delete({ id: subjectId });
  }
}
