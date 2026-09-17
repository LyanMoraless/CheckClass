import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassGroupEnrollmentEntity, ClassSessionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import {
  ClassroomHeadcountReconciliationResult,
  ClassroomHeadcountReconciliationService,
} from '../classroom-headcount-reconciliation/classroom-headcount-reconciliation.service';

const TEACHER_ROLE = 'teacher';

// GET /v1/me/class-sessions/:classSessionId/headcount-alert
// (architecture-overview.md, "Decisão de arquitetura — Fluxo de Chamada
// Redesenhado", Estrutura proposta item 4: "canal exato... é detalhe do
// Frontend/Backend, não decidido"). Reuses the Portal de Autoatendimento
// Web's existing self-service surface — same idiom as
// MeClassGroupAttendanceService (a leadership-scoped read next to it in this
// same module) — rather than opening a brand-new notification channel.
//
// Authorization idiom here is narrower than MeClassGroupAttendanceService's
// leadership chain, deliberately: RULE-PRES-10's alert is about ONE session
// this specific person is teaching right now, not about anything within a
// leadership chain (coordenador/direção have no stated stake in this alert
// per the business rules read for this round) — so this checks
// class_group_enrollment.role = 'teacher' directly, the same enrollment-role
// test TeachingClassGroupsService already uses for "which turmas does this
// person teach" (RULE-INST-05).
@Injectable()
export class MeClassSessionHeadcountAlertService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reconciliationService: ClassroomHeadcountReconciliationService,
  ) {}

  async getHeadcountAlertForAuthorizedSession(
    personId: string,
    classSessionId: string,
  ): Promise<ClassroomHeadcountReconciliationResult> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId, tenantId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }

    const teachesThisClassGroup = await manager.getRepository(ClassGroupEnrollmentEntity).count({
      where: { tenantId, personId, classGroupId: session.classGroupId, role: TEACHER_ROLE },
    });
    if (teachesThisClassGroup === 0) {
      throw new ForbiddenException(
        `Person ${personId} does not teach class_group ${session.classGroupId} (RULE-PRES-10)`,
      );
    }

    return this.reconciliationService.evaluateSession(classSessionId);
  }
}
