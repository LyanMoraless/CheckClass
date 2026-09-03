import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  AttendancePendingReviewEntity,
  ClassGroupEnrollmentEntity,
  ClassGroupEntity,
  ClassGroupScheduleSlotEntity,
  ClassGroupSubjectEntity,
  ClassSessionEntity,
  ClassSessionRequiredFactorEntity,
  IdentificationCheckinEntity,
  PresenceIntervalEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

// RULE-INST-13: cascading a Turma deletion (whether requested directly, or
// reached via a Curso/Matéria cascade under RULE-INST-08) is blocked if the
// turma already has recorded attendance activity. The rule's literal text
// names only session_attendance_consolidation ("presença consolidada"), but
// this orchestrator reads that conservatively/broadly on purpose: an
// attendance_pending_review, or any identification_checkin/presence_interval
// row, are all real device/attendance activity tied to a session of this
// turma that a hard delete (RULE-INST-08 — no soft-delete/archive exists in
// this schema) would otherwise silently and permanently destroy, with a past
// session that simply hasn't been processed by the attendance rules engine
// yet being the concrete gap a literal consolidation-only check would miss.
// Blocking on all four is therefore a deliberately wider reading than the
// rule's bare text, chosen to protect data/audit integrity — the same
// priority already given to LGPD-driven retention elsewhere in this project
// (data-retention-rules.md) — over delete convenience. Documented here as a
// technical decision, not a business-rule reinterpretation, should this need
// revisiting later.
//
// Authorization (RULE-INST-09) is explicitly NOT this orchestrator's job —
// every caller (ClassGroupService, SubjectService, CourseService) must run
// its own LeadershipScopeService check before invoking anything here.
@Injectable()
export class ClassGroupDeletionOrchestrator {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Throws ConflictException, deletes nothing, if this one class_group has
  // recorded attendance activity.
  async assertDeletable(classGroupId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const blocked = await this.hasAttendanceActivity(manager, await this.findSessionIds(manager, { classGroupId }));
    if (blocked) {
      throw new ConflictException(
        `class_group ${classGroupId} cannot be deleted: it has recorded attendance activity (RULE-INST-13)`,
      );
    }
  }

  // Validates every classGroupId in a batch BEFORE deleting any of them —
  // tudo-ou-nada, the same pattern already established elsewhere in this
  // pivot (SessionGenerationService/ScheduleRegenerationService's conflict
  // checks): a Curso/Matéria deletion that would cascade into even one
  // blocked Turma fails as a whole, with nothing deleted, instead of quietly
  // deleting everything it could and skipping the rest.
  async assertAllDeletable(classGroupIds: string[]): Promise<void> {
    for (const classGroupId of classGroupIds) {
      await this.assertDeletable(classGroupId);
    }
  }

  // Deletes exactly one class_group and everything scoped to it. Re-checks
  // deletability itself, so it's safe to call standalone (e.g. from
  // ClassGroupService's own DELETE endpoint).
  async deleteClassGroup(classGroupId: string): Promise<void> {
    await this.assertDeletable(classGroupId);
    const manager = this.tenantContext.getManager();
    await this.deleteClassGroupUnchecked(manager, classGroupId);
  }

  // Internal: deletes without re-checking deletability. Used by
  // CourseService's cascade, which already ran assertAllDeletable for the
  // whole batch up front — re-querying attendance activity a second time per
  // turma would be redundant.
  async deleteClassGroupUnchecked(manager: EntityManager, classGroupId: string): Promise<void> {
    const sessionIds = (
      await manager.getRepository(ClassSessionEntity).find({ where: { classGroupId }, select: ['id'] })
    ).map((session) => session.id);

    if (sessionIds.length > 0) {
      await manager.getRepository(ClassSessionRequiredFactorEntity).delete({ classSessionId: In(sessionIds) });
      await manager.getRepository(ClassSessionEntity).delete({ id: In(sessionIds) });
    }
    await manager.getRepository(ClassGroupScheduleSlotEntity).delete({ classGroupId });
    await manager.getRepository(ClassGroupSubjectEntity).delete({ classGroupId });
    await manager.getRepository(ClassGroupEnrollmentEntity).delete({ classGroupId });
    await manager.getRepository(ClassGroupEntity).delete({ id: classGroupId });
  }

  // RULE-INST-14 + RULE-INST-08 addendum: the narrower sibling of
  // deleteClassGroup — unlinks ONE matéria from ONE turma. Everything scoped
  // to that pairing goes (its recurring slots, its generated sessions, their
  // required-factor snapshots); the turma itself, its enrollments, its other
  // matérias and their sessions are all left untouched. Removing the turma's
  // LAST matéria is explicitly allowed: the turma survives with zero subjects
  // (user-confirmed, 2026-09-03), waiting for a new one to be linked.
  //
  // Same RULE-INST-13 protection as a full turma deletion, but scoped to this
  // matéria's own sessions: a matéria whose sessions already carry attendance
  // activity cannot be silently unlinked (which would destroy that history),
  // even when the rest of the turma is untouched.
  async assertSubjectRemovable(classGroupId: string, subjectId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const sessionIds = await this.findSessionIds(manager, { classGroupId, subjectId });
    if (await this.hasAttendanceActivity(manager, sessionIds)) {
      throw new ConflictException(
        `subject ${subjectId} cannot be removed from class_group ${classGroupId}: its sessions have recorded attendance activity (RULE-INST-13)`,
      );
    }
  }

  async removeSubjectFromClassGroup(manager: EntityManager, classGroupId: string, subjectId: string): Promise<void> {
    const sessionIds = await this.findSessionIds(manager, { classGroupId, subjectId });

    if (sessionIds.length > 0) {
      await manager.getRepository(ClassSessionRequiredFactorEntity).delete({ classSessionId: In(sessionIds) });
      await manager.getRepository(ClassSessionEntity).delete({ id: In(sessionIds) });
    }
    await manager.getRepository(ClassGroupScheduleSlotEntity).delete({ classGroupId, subjectId });
    await manager.getRepository(ClassGroupSubjectEntity).delete({ classGroupId, subjectId });
  }

  private async findSessionIds(
    manager: EntityManager,
    where: { classGroupId: string; subjectId?: string },
  ): Promise<string[]> {
    const sessions = await manager.getRepository(ClassSessionEntity).find({ where, select: ['id'] });
    return sessions.map((session) => session.id);
  }

  private async hasAttendanceActivity(manager: EntityManager, sessionIds: string[]): Promise<boolean> {
    if (sessionIds.length === 0) {
      return false;
    }

    const [consolidationCount, pendingReviewCount, checkinCount, presenceIntervalCount] = await Promise.all([
      manager.getRepository(SessionAttendanceConsolidationEntity).count({ where: { classSessionId: In(sessionIds) } }),
      manager.getRepository(AttendancePendingReviewEntity).count({ where: { classSessionId: In(sessionIds) } }),
      manager.getRepository(IdentificationCheckinEntity).count({ where: { classSessionId: In(sessionIds) } }),
      manager.getRepository(PresenceIntervalEntity).count({ where: { classSessionId: In(sessionIds) } }),
    ]);

    return consolidationCount > 0 || pendingReviewCount > 0 || checkinCount > 0 || presenceIntervalCount > 0;
  }
}
