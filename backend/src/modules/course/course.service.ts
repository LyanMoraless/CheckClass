import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { ClassGroupEntity, CourseEntity, SubjectEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ClassGroupDeletionOrchestrator } from '../class-group-deletion/class-group-deletion-orchestrator.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

export interface CreateCourseInput {
  name: string;
  code?: string;
}

@Injectable()
export class CourseService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly deletionOrchestrator: ClassGroupDeletionOrchestrator,
  ) {}

  async create(input: CreateCourseInput): Promise<CourseEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(CourseEntity);
    return repository.save(repository.create({ tenantId, name: input.name, code: input.code ?? null }));
  }

  async list(): Promise<CourseEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(CourseEntity).find();
  }

  // RULE-INST-08: deleting a Curso cascades to its Matérias and, through
  // them, their Turmas — via RULE-INST-13, tudo-ou-nada blocked if ANY turma
  // anywhere in that cascade has recorded attendance activity (same
  // tudo-ou-nada precedent used by SubjectService.delete, one level down).
  // Authority: hasAuthorityOverCourse directly against this courseId — no
  // subject hop needed, this IS the course.
  async delete(courseId: string, authenticatedPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();

    const course = await manager.getRepository(CourseEntity).findOneBy({ id: courseId });
    if (!course) {
      throw new NotFoundException(`course ${courseId} not found`);
    }

    const authorized = await this.leadershipScope.hasAuthorityOverCourse(authenticatedPersonId, courseId);
    if (!authorized) {
      throw new ForbiddenException(`Person ${authenticatedPersonId} has no leadership authority over course ${courseId} (RULE-INST-09)`);
    }

    const subjects = await manager.getRepository(SubjectEntity).find({ where: { courseId }, select: ['id'] });
    const subjectIds = subjects.map((subject) => subject.id);

    const classGroups = subjectIds.length
      ? await manager.getRepository(ClassGroupEntity).find({ where: { subjectId: In(subjectIds) }, select: ['id'] })
      : [];
    const classGroupIds = classGroups.map((classGroup) => classGroup.id);

    await this.deletionOrchestrator.assertAllDeletable(classGroupIds);
    for (const classGroupId of classGroupIds) {
      await this.deletionOrchestrator.deleteClassGroupUnchecked(manager, classGroupId);
    }
    if (subjectIds.length) {
      await manager.getRepository(SubjectEntity).delete({ id: In(subjectIds) });
    }
    await manager.getRepository(CourseEntity).delete({ id: courseId });
  }
}
