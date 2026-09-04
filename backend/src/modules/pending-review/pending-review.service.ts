import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  AttendancePendingReviewEntity,
  ClassGroupEntity,
  ClassSessionEntity,
  SessionAttendanceConsolidationEntity,
  SubjectEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { AttendanceFrequencyEngineService } from '../attendance-frequency/attendance-frequency-engine.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

export type PendingReviewDecision = 'present' | 'absent';

// "Fila/Estado de Pendências de Revisão Manual" (architecture-overview.md):
// never resolves itself (RULE-ATT-11 — no expiration, no auto-decision).
// Resolution is authorized to anyone in the direct leadership chain above
// the session's specific class_group — professor of that turma,
// coordinator/director of its course, or the institution's top role
// (RULE-ATT-12); not exclusive to one level.
@Injectable()
export class PendingReviewService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly frequencyEngine: AttendanceFrequencyEngineService,
  ) {}

  async listUnresolved(): Promise<AttendancePendingReviewEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(AttendancePendingReviewEntity).findBy({ resolvedAt: IsNull() });
  }

  // Leadership-chain-scoped variant for the mobile Professor use case
  // (RULE-ATT-12): "list only the pending reviews this person is authorized
  // to resolve, given their leadership assignments" — the inverse of the
  // per-review LeadershipScopeService.hasAuthorityOverClassGroup() check
  // resolve() already runs, applied as a filter over every unresolved review
  // instead of a single one.
  // Deliberately does NOT reuse/alter listUnresolved() (VIEW_ATTENDANCE_REGISTER
  // -gated, tenant-wide, the web admin dashboard's existing contract) — this
  // is a separate, narrower view with its own authorization mechanism, not a
  // permission-group concept (same reasoning as resolve() itself).
  //
  // Performance finding (N+1): this used to loop over every unresolved
  // review doing a session lookup + a class_group lookup + a leadership
  // count query per row — 3 round trips per review. Rewritten as one query:
  // the join to class_session/class_group is now inline, and the leadership
  // check is a correlated EXISTS against leadership_assignment expressing
  // the EXACT same three RULE-ATT-12 branches
  // LeadershipScopeService.hasAuthorityOverClassGroup() checks per-row today
  // (class_group-scoped match, OR whole-course with class_group_id NULL, OR
  // institution-wide with course_id NULL).
  // RULE-INST-03: class_group has no course_id of its own anymore — the join
  // now goes one hop further, through subject, to reach the course_id
  // leadership_assignment is scoped by.
  async listUnresolvedForPerson(personId: string): Promise<AttendancePendingReviewEntity[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows: AttendancePendingReviewEntity[] = await manager.query(
      `
      SELECT
        r.id AS "id",
        r.tenant_id AS "tenantId",
        r.class_session_id AS "classSessionId",
        r.person_id AS "personId",
        r.reason AS "reason",
        r.resolved_by_person_id AS "resolvedByPersonId",
        r.resolved_at AS "resolvedAt",
        r.resolution_note AS "resolutionNote",
        r.created_at AS "createdAt"
      FROM attendance_pending_review r
      JOIN class_session cs ON cs.id = r.class_session_id
      JOIN class_group cg ON cg.id = cs.class_group_id
      WHERE r.tenant_id = $1
        AND r.resolved_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM leadership_assignment la
          WHERE la.tenant_id = $1
            AND la.person_id = $2
            AND (
              (la.course_id = cg.course_id AND la.class_group_id = cg.id)
              OR (la.course_id = cg.course_id AND la.class_group_id IS NULL)
              OR la.course_id IS NULL
            )
        )
      ORDER BY r.created_at ASC
      `,
      [tenantId, personId],
    );

    return rows;
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

    const authorized = await this.leadershipScope.hasAuthorityOverClassGroup(resolvingPersonId, classGroup.courseId, classGroup.id);
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

    // Controle B (RULE-FREQ-06), stacked on top of the two updates above and
    // running in the SAME transaction — resolving a pending review is one of
    // the points where a session_attendance_consolidation row becomes
    // definitive, and the accumulated frequency is only ever recomputed from
    // definitive rows (RULE-FREQ-05.1).
    //
    // ORDER MATTERS: this call has to come AFTER the consolidation update,
    // never before. The recompute is query-driven, not incremental — it
    // re-reads the consolidation rows itself — so calling it first would read
    // the pre-resolution state and write a warning based on the pending row
    // this method just decided.
    await this.frequencyEngine.recalculateForSessionPerson(pending.classSessionId, pending.personId);
  }
}
