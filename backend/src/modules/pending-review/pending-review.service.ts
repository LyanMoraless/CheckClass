import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import {
  AttendancePendingReviewEntity,
  ClassGroupEntity,
  ClassSessionEntity,
  LeadershipAssignmentEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export type PendingReviewDecision = 'present' | 'absent';

// "Fila/Estado de Pendências de Revisão Manual" (architecture-overview.md):
// never resolves itself (RULE-ATT-11 — no expiration, no auto-decision).
// Resolution is authorized to anyone in the direct leadership chain above
// the session's specific class_group — professor of that turma,
// coordinator/director of its course, or the institution's top role
// (RULE-ATT-12); not exclusive to one level.
@Injectable()
export class PendingReviewService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async listUnresolved(): Promise<AttendancePendingReviewEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(AttendancePendingReviewEntity).findBy({ resolvedAt: IsNull() });
  }

  async resolve(pendingReviewId: string, resolvingPersonId: string, decision: PendingReviewDecision, note?: string): Promise<void> {
    if (decision !== 'present' && decision !== 'absent') {
      throw new BadRequestException('decision must be "present" or "absent"');
    }

    const manager = this.tenantContext.getManager();

    const pending = await manager.getRepository(AttendancePendingReviewEntity).findOneBy({ id: pendingReviewId });
    if (!pending) {
      throw new NotFoundException(`attendance_pending_review ${pendingReviewId} not found`);
    }
    if (pending.resolvedAt) {
      // RULE-ATT-11 covers non-expiration; a review that HAS been resolved
      // stays resolved — this isn't a re-review workflow.
      throw new BadRequestException('This pending review has already been resolved');
    }

    const session = await manager.getRepository(ClassSessionEntity).findOneByOrFail({ id: pending.classSessionId });
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneByOrFail({ id: session.classGroupId });

    const authorized = await this.isAuthorizedToResolve(manager, resolvingPersonId, classGroup.courseId, classGroup.id);
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${resolvingPersonId} is not in the direct leadership chain above class_group ${classGroup.id} (RULE-ATT-12)`,
      );
    }

    const resolvedAt = new Date();
    await manager
      .getRepository(AttendancePendingReviewEntity)
      .update({ id: pendingReviewId }, { resolvedAt, resolvedByPersonId: resolvingPersonId, resolutionNote: note ?? null });

    await manager
      .getRepository(SessionAttendanceConsolidationEntity)
      .update(
        { classSessionId: pending.classSessionId, personId: pending.personId },
        { status: decision, resolvedByPersonId: resolvingPersonId, resolvedAt },
      );
  }

  // RULE-ATT-12 literally scopes authority to "a aula/turma em questão" — an
  // assignment authorizes resolution when it reaches this specific
  // class_group: either scoped exactly to it, scoped to the whole course
  // (class_group_id NULL), or institution-wide (course_id NULL, which
  // reaches every course and therefore every class_group).
  private async isAuthorizedToResolve(
    manager: EntityManager,
    personId: string,
    courseId: string,
    classGroupId: string,
  ): Promise<boolean> {
    const count = await manager.getRepository(LeadershipAssignmentEntity).count({
      where: [
        { personId, courseId, classGroupId },
        { personId, courseId, classGroupId: IsNull() },
        { personId, courseId: IsNull() },
      ],
    });
    return count > 0;
  }
}
