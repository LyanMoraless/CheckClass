import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassGroupEntity, SubjectEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { AttendanceRegisterService, ClassGroupSummaryEntry } from '../attendance-register/attendance-register.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

// GET /v1/me/class-groups/:classGroupId/attendance (architecture-overview.md,
// "Decisão de arquitetura — Portal de Autoatendimento Web, estrutura", item
// 2): the Professor/Coordenador de Curso/Direção variant of the admin-facing
// AttendanceRegisterController.getClassGroupSummary() (gated on
// VIEW_ATTENDANCE_REGISTER). Delegates to the exact same
// AttendanceRegisterService method — no duplicated presence-reading logic —
// but authorizes via LeadershipScopeService.hasAuthorityOverClassGroup()
// instead of a permission-group check: "novo idioma de autorização" the
// architecture decision calls out (leitura escopada por cadeia de
// liderança, same RULE-ATT-12/RULE-INST-09 branches already used for
// pending-review resolution and montar/editar turma, just applied to a read
// instead of a write for the first time).
@Injectable()
export class MeClassGroupAttendanceService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly attendanceRegister: AttendanceRegisterService,
  ) {}

  async getAttendanceForAuthorizedClassGroup(personId: string, classGroupId: string): Promise<ClassGroupSummaryEntry[]> {
    const manager = this.tenantContext.getManager();

    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }
    // RULE-INST-14: course is the turma's own column again — same resolution
    // ClassGroupService/PendingReviewService now use.
    const authorized = await this.leadershipScope.hasAuthorityOverClassGroup(
      personId,
      classGroup.courseId,
      classGroupId,
    );
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${personId} has no leadership authority over class_group ${classGroupId} (RULE-ATT-12/RULE-INST-09)`,
      );
    }

    return this.attendanceRegister.getClassGroupSummary(classGroupId);
  }
}
