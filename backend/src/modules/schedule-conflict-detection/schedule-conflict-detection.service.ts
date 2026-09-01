import { ConflictException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

export interface ScheduleConflictCandidate {
  // The class_session being edited, so it doesn't conflict with itself.
  // Omitted when the candidate isn't persisted yet (e.g. bulk generation
  // from the recurring grade, ClassScheduleService.generateSessions).
  classSessionIdToExclude?: string;
  // The candidate's OWN effective room — already resolved by the caller
  // (session.roomId ?? session.classGroup.roomId, RULE-INST-07). null means
  // "no room assigned" — such a candidate can never conflict on room (it has
  // none to collide with), only on teacher.
  roomId: string | null;
  // Every teacher of the candidate's turma (class_group_enrollment.role =
  // 'teacher'), including co-docência (RULE-INST-05) — already resolved by
  // the caller.
  teacherPersonIds: string[];
  scheduledStart: Date;
  scheduledEnd: Date;
}

// RULE-INST-10: two sessions conflict when they [use the same room OR share
// at least one teacher] AND [overlap in time]. "Overlap" is confirmed as
// EXACT overlap, no tolerance/margin (architecture-overview.md's delegated
// decision) — two sessions that merely touch at a shared boundary (one ends
// exactly when the other starts) do NOT conflict, which is exactly what the
// strict `<`/`>` comparison below expresses (the standard half-open-interval
// overlap test: [start1, end1) intersects [start2, end2) iff
// start1 < end2 AND start2 < end1).
//
// Reused as the single shared primitive by every place class_session rows
// are created or pontually edited: SessionGenerationService (bulk, from the
// recurring grade — shared by ClassScheduleService.generateSessions and
// ScheduleRegenerationService.regenerateFutureSessions), ClassSessionService
// .createSession (manual creation, POST /v1/class-sessions), and
// ClassSessionService.editSession (pontual edit of horário/sala, RULE-INST-04
// third-round update, item #3) — none of them reimplements this check.
@Injectable()
export class ScheduleConflictDetectionService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async assertNoConflict(candidate: ScheduleConflictCandidate): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // Two independent conditions, combined with OR, each paired with the
    // exact-overlap time test above:
    //   1. Same effective room — COALESCE(cs.room_id, cg.room_id) mirrors
    //      RULE-INST-07's inheritance rule (a session's own pontual
    //      room override wins, else its turma's room). Only compared when
    //      the candidate itself has a room (`$5::uuid IS NOT NULL`) — a
    //      roomless candidate can't collide on room.
    //   2. At least one teacher in common — EXISTS against
    //      class_group_enrollment for the EXISTING session's own turma,
    //      matched against the candidate's already-resolved teacher list
    //      (`= ANY($6::uuid[])`), which naturally covers co-docência
    //      (RULE-INST-05): any one shared teacher is enough.
    // tenant_id is filtered explicitly (defense in depth) even though RLS
    // already scopes every query to the current tenant (RULE-TEN-01) — same
    // precedent as AppCheckinService's raw queries.
    const rows: Array<{ id: string }> = await manager.query(
      `
      SELECT cs.id
      FROM class_session cs
      JOIN class_group cg ON cg.id = cs.class_group_id
      WHERE cs.tenant_id = $1
        AND cs.status <> 'cancelled'
        AND ($2::uuid IS NULL OR cs.id <> $2::uuid)
        AND cs.scheduled_start < $4::timestamptz
        AND cs.scheduled_end > $3::timestamptz
        AND (
          ($5::uuid IS NOT NULL AND COALESCE(cs.room_id, cg.room_id) = $5::uuid)
          OR EXISTS (
            SELECT 1 FROM class_group_enrollment cge
            WHERE cge.class_group_id = cs.class_group_id
              AND cge.role = 'teacher'
              AND cge.person_id = ANY($6::uuid[])
          )
        )
      LIMIT 1
      `,
      [
        tenantId,
        candidate.classSessionIdToExclude ?? null,
        candidate.scheduledStart.toISOString(),
        candidate.scheduledEnd.toISOString(),
        candidate.roomId,
        candidate.teacherPersonIds,
      ],
    );

    if (rows.length > 0) {
      throw new ConflictException(
        `Schedule conflict (RULE-INST-10): class_session ${rows[0].id} already occupies the same room or shares a ` +
          `teacher with an overlapping time window (${candidate.scheduledStart.toISOString()} - ${candidate.scheduledEnd.toISOString()})`,
      );
    }
  }
}
