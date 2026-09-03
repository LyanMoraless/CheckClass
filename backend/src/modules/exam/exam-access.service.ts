import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassGroupEntity, ExamEntity, SubjectEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { ExamRlsContextService } from './exam-rls-context.service';

// The one and only management/audit authorization path of the exam module
// (RULE-EXAM-16, Security control 2). It does not implement any authority
// rule of its own — it delegates to the already-official
// LeadershipScopeService, exactly like MeClassGroupAttendanceService does,
// so Professor (turma), Coordenador de Curso (courses they coordinate) and
// Direção/Reitoria (institution-wide) all resolve through the same branches
// as everywhere else in the project.
//
// It exists as a service rather than a helper because it pairs the
// authorization decision with the side effect that must follow it: enabling
// app.exam_management_scope only AFTER the check passed. Keeping those two
// steps in one place is what prevents a future caller from turning the GUC
// on without having earned it.
@Injectable()
export class ExamAccessService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly examRlsContext: ExamRlsContextService,
  ) {}

  // Used when there is no exam yet (creating one) or when listing a class
  // group's exams.
  async authorizeClassGroup(personId: string, classGroupId: string): Promise<void> {
    const manager = this.tenantContext.getManager();

    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }
    // RULE-INST-03: the course lives one hop up, through the turma's
    // subject — same resolution ClassGroupService/MeClassGroupAttendanceService
    // already use.
    const subject = await manager.getRepository(SubjectEntity).findOneByOrFail({ id: classGroup.subjectId });

    const authorized = await this.leadershipScope.hasAuthorityOverClassGroup(personId, subject.courseId, classGroupId);
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${personId} has no leadership authority over class_group ${classGroupId} (RULE-EXAM-16)`,
      );
    }

    await this.examRlsContext.applyManagementScope();
  }

  async authorizeExam(personId: string, examId: string): Promise<ExamEntity> {
    const exam = await this.tenantContext.getManager().getRepository(ExamEntity).findOneBy({ id: examId });
    if (!exam) {
      throw new NotFoundException(`exam ${examId} not found`);
    }

    await this.authorizeClassGroup(personId, exam.classGroupId);
    return exam;
  }
}
