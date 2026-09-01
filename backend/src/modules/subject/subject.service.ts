import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassGroupEntity, CourseEntity, SubjectEntity } from '../../database/entities';
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

  // RULE-INST-08: deleting a Matéria cascades to its Turmas — via
  // RULE-INST-13, the whole deletion is rejected tudo-ou-nada (nothing
  // deleted) if ANY of those turmas has recorded attendance activity, rather
  // than silently deleting what it can and skipping the rest (same pattern
  // already established by SessionGenerationService/ScheduleRegenerationService
  // elsewhere in this pivot). Authority: hasAuthorityOverCourse — deleting a
  // Matéria is a course-level action (RULE-INST-09), same check already used
  // by ClassGroupService.create() when creating a turma under a course.
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

    const classGroups = await manager.getRepository(ClassGroupEntity).find({ where: { subjectId }, select: ['id'] });
    const classGroupIds = classGroups.map((classGroup) => classGroup.id);

    await this.deletionOrchestrator.assertAllDeletable(classGroupIds);
    for (const classGroupId of classGroupIds) {
      await this.deletionOrchestrator.deleteClassGroupUnchecked(manager, classGroupId);
    }
    await manager.getRepository(SubjectEntity).delete({ id: subjectId });
  }
}
