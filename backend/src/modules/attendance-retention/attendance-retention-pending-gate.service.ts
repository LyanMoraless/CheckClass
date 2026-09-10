import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

// Frente 10 technology decision item 4: NO denormalized "blocked" column on
// any of the four RULE-RET-01 source tables — the gate against
// attendance_pending_review is a join evaluated fresh at query time,
// re-derived on every closure/purge run instead of kept in sync by a
// separate write path. Rejected explicitly for a job that runs at most
// monthly and is not latency-sensitive (architecture-overview.md, Frente 10
// technology decision).
//
// Correlation keys (same section): session_attendance_consolidation and
// presence_interval join attendance_pending_review directly by (tenant_id,
// class_session_id, person_id); identification_checkin the same way, except
// a row with class_session_id NULL (app-originated, no session to test
// against) never participates in the gate at all;
// raw_identification_event needs two hops, via
// identification_checkin.raw_identification_event_id.
//
// This service holds the COARSE, month-level gate only
// (monthHasBlockingPendingReview — used by AttendanceMonthlyClosureService
// to decide whether a (tenant, month) is "elegível" for closure at all,
// Estrutura proposta item 1). The FINE, row-level gate ("linha a linha",
// item 3) lives inline in AttendancePurgeService's own DELETE statements —
// deliberately not factored out here, because it has to be part of the same
// DELETE to be atomic with the deletion itself, and re-evaluates the same
// join a second time on purpose: a new pendência can open in the gap between
// a month passing this coarse check and the purge actually running, and only
// a row-level re-check at delete time catches that race.
@Injectable()
export class AttendanceRetentionPendingGateService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async monthHasBlockingPendingReview(tenantId: string, monthStart: Date, monthEndExclusive: Date): Promise<boolean> {
    const manager = this.tenantContext.getManager();

    const rows: Array<{ blocked: boolean }> = await manager.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM session_attendance_consolidation sac
        JOIN class_session cs ON cs.tenant_id = sac.tenant_id AND cs.id = sac.class_session_id
        JOIN attendance_pending_review apr
          ON apr.tenant_id = sac.tenant_id AND apr.class_session_id = sac.class_session_id AND apr.person_id = sac.person_id
        WHERE sac.tenant_id = $1 AND cs.scheduled_start >= $2 AND cs.scheduled_start < $3 AND apr.resolved_at IS NULL

        UNION ALL

        SELECT 1
        FROM presence_interval pi
        JOIN attendance_pending_review apr
          ON apr.tenant_id = pi.tenant_id AND apr.class_session_id = pi.class_session_id AND apr.person_id = pi.person_id
        WHERE pi.tenant_id = $1 AND pi.entry_at >= $2 AND pi.entry_at < $3 AND apr.resolved_at IS NULL

        UNION ALL

        SELECT 1
        FROM identification_checkin ic
        JOIN attendance_pending_review apr
          ON apr.tenant_id = ic.tenant_id AND apr.class_session_id = ic.class_session_id AND apr.person_id = ic.person_id
        WHERE ic.tenant_id = $1 AND ic.checkin_at >= $2 AND ic.checkin_at < $3
          AND ic.class_session_id IS NOT NULL AND apr.resolved_at IS NULL

        UNION ALL

        SELECT 1
        FROM raw_identification_event rie
        JOIN identification_checkin ic2 ON ic2.tenant_id = rie.tenant_id AND ic2.raw_identification_event_id = rie.id
        JOIN attendance_pending_review apr
          ON apr.tenant_id = ic2.tenant_id AND apr.class_session_id = ic2.class_session_id AND apr.person_id = ic2.person_id
        WHERE rie.tenant_id = $1 AND rie.received_at >= $2 AND rie.received_at < $3
          AND ic2.class_session_id IS NOT NULL AND apr.resolved_at IS NULL
      ) AS blocked
      `,
      [tenantId, monthStart, monthEndExclusive],
    );

    return rows[0]?.blocked ?? false;
  }
}
