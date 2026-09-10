import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { AttendanceClosureDocumentEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ATTENDANCE_CLOSURE_DOCUMENT_SUMMARY_MAX_BYTES, ATTENDANCE_RETENTION_LIVE_WINDOW_DAYS } from './attendance-retention.constants';
import { isMonthPastLiveWindow, monthBounds } from './attendance-retention-month.util';
import { AttendanceRetentionPendingGateService } from './attendance-retention-pending-gate.service';
import { AttendanceRetentionStorageService } from './attendance-retention-storage.service';

export interface MonthlyClosureSummary {
  rawIdentificationEventCount: number;
  identificationCheckinCount: number;
  presenceIntervalCount: number;
  sessionAttendanceConsolidationCount: number;
}

export type MonthlyClosureOutcome =
  | { status: 'created'; document: AttendanceClosureDocumentEntity }
  | { status: 'already_closed'; document: AttendanceClosureDocumentEntity }
  | { status: 'not_yet_eligible'; reason: 'month_not_past_live_window' | 'blocking_pending_review' };

// "Serviço de Fechamento Mensal" (architecture-overview.md, Frente 10,
// Estrutura proposta item 1). Idempotent per (tenant, month): a second call
// against an already-closed month is a no-op that returns the existing
// document, never a second one (the migration's
// attendance_closure_document_monthly_unique partial index is the last line
// of defense, this check is the first).
//
// A month is only "elegível" when BOTH:
//   1. the month has fully passed the 60-day live window (RULE-RET-01) —
//      isMonthPastLiveWindow, and
//   2. no row in the month's scope, across the four RULE-RET-01 source
//      tables, is tied to a non-terminal attendance_pending_review
//      (AttendanceRetentionPendingGateService, MONTH granularity).
// Not eligible is NOT an error — it is the ordinary "come back next month"
// outcome an unattended, re-runnable job needs to report cleanly rather than
// throw on.
@Injectable()
export class AttendanceMonthlyClosureService {
  private readonly logger = new Logger(AttendanceMonthlyClosureService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly pendingGate: AttendanceRetentionPendingGateService,
    private readonly storage: AttendanceRetentionStorageService,
  ) {}

  async closeMonth(tenantId: string, year: number, month: number): Promise<MonthlyClosureOutcome> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(AttendanceClosureDocumentEntity);

    const existing = await repository.findOneBy({ tenantId, periodType: 'monthly', periodYear: year, periodMonth: month });
    if (existing) {
      return { status: 'already_closed', document: existing };
    }

    const { monthStart, monthEndExclusive } = monthBounds(year, month);

    if (!isMonthPastLiveWindow(monthEndExclusive, new Date(), ATTENDANCE_RETENTION_LIVE_WINDOW_DAYS)) {
      return { status: 'not_yet_eligible', reason: 'month_not_past_live_window' };
    }
    if (await this.pendingGate.monthHasBlockingPendingReview(tenantId, monthStart, monthEndExclusive)) {
      return { status: 'not_yet_eligible', reason: 'blocking_pending_review' };
    }

    const [rawIdentificationEvents, identificationCheckins, presenceIntervals, sessionAttendanceConsolidations] = await Promise.all([
      manager.query(
        `SELECT * FROM raw_identification_event WHERE tenant_id = $1 AND received_at >= $2 AND received_at < $3 ORDER BY received_at ASC`,
        [tenantId, monthStart, monthEndExclusive],
      ),
      manager.query(
        `SELECT * FROM identification_checkin WHERE tenant_id = $1 AND checkin_at >= $2 AND checkin_at < $3 ORDER BY checkin_at ASC`,
        [tenantId, monthStart, monthEndExclusive],
      ),
      manager.query(
        `SELECT * FROM presence_interval WHERE tenant_id = $1 AND entry_at >= $2 AND entry_at < $3 ORDER BY entry_at ASC`,
        [tenantId, monthStart, monthEndExclusive],
      ),
      manager.query(
        `
        SELECT sac.*
        FROM session_attendance_consolidation sac
        JOIN class_session cs ON cs.tenant_id = sac.tenant_id AND cs.id = sac.class_session_id
        WHERE sac.tenant_id = $1 AND cs.scheduled_start >= $2 AND cs.scheduled_start < $3
        ORDER BY cs.scheduled_start ASC
        `,
        [tenantId, monthStart, monthEndExclusive],
      ),
    ]);

    const summary: MonthlyClosureSummary = {
      rawIdentificationEventCount: rawIdentificationEvents.length,
      identificationCheckinCount: identificationCheckins.length,
      presenceIntervalCount: presenceIntervals.length,
      sessionAttendanceConsolidationCount: sessionAttendanceConsolidations.length,
    };
    // Should be unreachable in practice — a handful of integer counters never
    // approaches 16 KB — but fails loudly in application code instead of
    // hitting the DB's attendance_closure_document_summary_size_check blind.
    const summaryBytes = Buffer.byteLength(JSON.stringify(summary), 'utf8');
    if (summaryBytes > ATTENDANCE_CLOSURE_DOCUMENT_SUMMARY_MAX_BYTES) {
      throw new Error(
        `attendance_closure_document summary for tenant ${tenantId} ${year}-${month} is ${summaryBytes} bytes, over the ${ATTENDANCE_CLOSURE_DOCUMENT_SUMMARY_MAX_BYTES}-byte ceiling`,
      );
    }

    // The raw, detailed content — never the summary above — is what
    // RULE-RET-01 means by "a instituição é orientada a copiar esse
    // fechamento para mídia física própria": a real, copyable artifact, not
    // just counts (Frente 10 technology decision item 1, rejecting jsonb
    // inline for exactly this reason).
    const content = {
      tenantId,
      periodType: 'monthly' as const,
      periodYear: year,
      periodMonth: month,
      generatedAt: new Date().toISOString(),
      rawIdentificationEvents,
      identificationCheckins,
      presenceIntervals,
      sessionAttendanceConsolidations,
    };
    const body = Buffer.from(JSON.stringify(content), 'utf8');
    const checksumSha256 = createHash('sha256').update(body).digest('hex');
    const storageKey = `${tenantId}/monthly/${year}-${String(month).padStart(2, '0')}.json`;

    await this.storage.upload(storageKey, body, 'application/json');

    const document = await repository.save(
      repository.create({
        tenantId,
        periodType: 'monthly',
        periodYear: year,
        periodMonth: month,
        summary: summary as unknown as Record<string, unknown>,
        storageKey,
        mimeType: 'application/json',
        sizeBytes: body.byteLength,
        checksumSha256,
      }),
    );

    this.logger.log(`Monthly closure generated for tenant ${tenantId}, ${year}-${month}: ${JSON.stringify(summary)}`);
    return { status: 'created', document };
  }
}
