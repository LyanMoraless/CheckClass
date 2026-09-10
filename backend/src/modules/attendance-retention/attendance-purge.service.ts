import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AttendanceClosureDocumentEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { monthBounds } from './attendance-retention-month.util';

export interface AttendancePurgeCounts {
  rawIdentificationEventDeleted: number;
  identificationCheckinDeleted: number;
  presenceIntervalDeleted: number;
  sessionAttendanceConsolidationDeleted: number;
}

export type AttendancePurgeOutcome =
  | { status: 'purged'; counts: AttendancePurgeCounts }
  | { status: 'skipped'; reason: 'no_closure_document' };

// "Serviço de Expurgo" (architecture-overview.md, Frente 10, Estrutura
// proposta item 3) — a component DISTINCT from AttendanceMonthlyClosureService
// on purpose (same separation already used in Frente 07 between calculating
// a retention date and actually eliminating). Only ever purges a (tenant,
// month) whose monthly closure document has ALREADY been persisted
// successfully — generation and expurgo are sequential, never the reverse
// (RULE-RET-01's "gera... e os dados detalhados saem da base viva").
//
// No RLS GUC needed here beyond app.tenant_id (already set by
// TenantContextService.runWithTenant): the four RULE-RET-01 source tables
// already grant ordinary SELECT/DELETE to the app role under the plain
// tenant_isolation policy from the InitSchema migration. Only the closure
// document lookup below needs AttendanceRetentionRlsContextService's GUC —
// the CALLER (the close-month CLI script) is responsible for having applied
// it already, same precedent as the Frente 07 sweep script.
@Injectable()
export class AttendancePurgeService {
  private readonly logger = new Logger(AttendancePurgeService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  async purgeMonth(tenantId: string, year: number, month: number): Promise<AttendancePurgeOutcome> {
    const manager = this.tenantContext.getManager();
    const closure = await manager
      .getRepository(AttendanceClosureDocumentEntity)
      .findOneBy({ tenantId, periodType: 'monthly', periodYear: year, periodMonth: month });
    if (!closure) {
      return { status: 'skipped', reason: 'no_closure_document' };
    }

    const { monthStart, monthEndExclusive } = monthBounds(year, month);

    // Order matters: identification_checkin is deleted BEFORE
    // raw_identification_event. identification_checkin.raw_identification_
    // event_id is a bare FK (NO ON DELETE CASCADE, InitSchema migration), so
    // a checkin row still referencing an event would block that event's
    // deletion outright. Deleting this month's checkins first clears the
    // ordinary case (checkin_at and its event's received_at fall in the same
    // month — the norm, given RULE-RET-03's sub-minute dedup windows). The
    // rare theoretical cross-month split (a checkin dated into a LATER month
    // than its own event) surfaces as a genuine FK violation instead of a
    // silent inconsistency — this method lets that abort the whole (tenant,
    // month)'s purge (the surrounding transaction rolls back) rather than
    // work around it unverified.
    const presenceIntervalDeleted = await this.deletePresenceIntervals(manager, tenantId, monthStart, monthEndExclusive);
    const identificationCheckinDeleted = await this.deleteIdentificationCheckins(manager, tenantId, monthStart, monthEndExclusive);
    const rawIdentificationEventDeleted = await this.deleteRawIdentificationEvents(manager, tenantId, monthStart, monthEndExclusive);
    const sessionAttendanceConsolidationDeleted = await this.deleteSessionAttendanceConsolidations(
      manager,
      tenantId,
      monthStart,
      monthEndExclusive,
    );

    const counts: AttendancePurgeCounts = {
      rawIdentificationEventDeleted,
      identificationCheckinDeleted,
      presenceIntervalDeleted,
      sessionAttendanceConsolidationDeleted,
    };
    this.logger.log(`Purge complete for tenant ${tenantId}, ${year}-${month}: ${JSON.stringify(counts)}`);
    return { status: 'purged', counts };
  }

  // RULE-ATT-11/RULE-RET-01 exception, extended to source rows (Frente 10
  // architecture, approved 2026-09-09, Open Question 2 resolved YES): a row
  // tied to a non-terminal attendance_pending_review is never purged, even
  // past its 60-day mark. Re-evaluated here, row by row, even though
  // AttendanceMonthlyClosureService already checked the whole month moments
  // earlier — a new pendência can open in between, and only a row-level
  // re-check at delete time catches that race (see
  // AttendanceRetentionPendingGateService's own header).
  private async deletePresenceIntervals(manager: EntityManager, tenantId: string, monthStart: Date, monthEndExclusive: Date): Promise<number> {
    // Testing Agent finding, same root cause as
    // AttendanceFrequencyEngineService.applyAggregateDelta: TypeORM's
    // Postgres driver returns a TUPLE, `[rows, rowCount]`, for DELETE —
    // never `rows` directly. Reading `.length` off the undestructured tuple
    // is ALWAYS 2, regardless of how many rows were actually purged,
    // corrupting attendance_closure_document.summary's audit trail
    // (RULE-RET-01) while the deletion itself runs correctly.
    const [rows]: [Array<{ id: string }>, number] = await manager.query(
      `
      DELETE FROM presence_interval pi
      WHERE pi.tenant_id = $1 AND pi.entry_at >= $2 AND pi.entry_at < $3
        AND NOT EXISTS (
          SELECT 1 FROM attendance_pending_review apr
          WHERE apr.tenant_id = pi.tenant_id AND apr.class_session_id = pi.class_session_id AND apr.person_id = pi.person_id
            AND apr.resolved_at IS NULL
        )
      RETURNING pi.id
      `,
      [tenantId, monthStart, monthEndExclusive],
    );
    return rows.length;
  }

  private async deleteIdentificationCheckins(
    manager: EntityManager,
    tenantId: string,
    monthStart: Date,
    monthEndExclusive: Date,
  ): Promise<number> {
    // See deletePresenceIntervals' own comment: DELETE...RETURNING returns a
    // `[rows, rowCount]` tuple through this driver, not `rows` directly.
    const [rows]: [Array<{ id: string }>, number] = await manager.query(
      `
      DELETE FROM identification_checkin ic
      WHERE ic.tenant_id = $1 AND ic.checkin_at >= $2 AND ic.checkin_at < $3
        AND NOT (
          ic.class_session_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM attendance_pending_review apr
            WHERE apr.tenant_id = ic.tenant_id AND apr.class_session_id = ic.class_session_id AND apr.person_id = ic.person_id
              AND apr.resolved_at IS NULL
          )
        )
      RETURNING ic.id
      `,
      [tenantId, monthStart, monthEndExclusive],
    );
    return rows.length;
  }

  private async deleteRawIdentificationEvents(
    manager: EntityManager,
    tenantId: string,
    monthStart: Date,
    monthEndExclusive: Date,
  ): Promise<number> {
    // See deletePresenceIntervals' own comment: DELETE...RETURNING returns a
    // `[rows, rowCount]` tuple through this driver, not `rows` directly.
    const [rows]: [Array<{ id: string }>, number] = await manager.query(
      `
      DELETE FROM raw_identification_event rie
      WHERE rie.tenant_id = $1 AND rie.received_at >= $2 AND rie.received_at < $3
        AND NOT EXISTS (
          SELECT 1
          FROM identification_checkin ic2
          JOIN attendance_pending_review apr
            ON apr.tenant_id = ic2.tenant_id AND apr.class_session_id = ic2.class_session_id AND apr.person_id = ic2.person_id
          WHERE ic2.tenant_id = rie.tenant_id AND ic2.raw_identification_event_id = rie.id
            AND ic2.class_session_id IS NOT NULL AND apr.resolved_at IS NULL
        )
      RETURNING rie.id
      `,
      [tenantId, monthStart, monthEndExclusive],
    );
    return rows.length;
  }

  private async deleteSessionAttendanceConsolidations(
    manager: EntityManager,
    tenantId: string,
    monthStart: Date,
    monthEndExclusive: Date,
  ): Promise<number> {
    // See deletePresenceIntervals' own comment: DELETE...RETURNING returns a
    // `[rows, rowCount]` tuple through this driver, not `rows` directly.
    const [rows]: [Array<{ id: string }>, number] = await manager.query(
      `
      DELETE FROM session_attendance_consolidation sac
      USING class_session cs
      WHERE sac.tenant_id = $1 AND cs.tenant_id = sac.tenant_id AND cs.id = sac.class_session_id
        AND cs.scheduled_start >= $2 AND cs.scheduled_start < $3
        AND NOT EXISTS (
          SELECT 1 FROM attendance_pending_review apr
          WHERE apr.tenant_id = sac.tenant_id AND apr.class_session_id = sac.class_session_id AND apr.person_id = sac.person_id
            AND apr.resolved_at IS NULL
        )
      RETURNING sac.id
      `,
      [tenantId, monthStart, monthEndExclusive],
    );
    return rows.length;
  }
}
