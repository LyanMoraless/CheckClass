import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { IsNull } from 'typeorm';
import { AttendanceClosureDocumentEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ATTENDANCE_RETENTION_MONTHS_PER_ANNUAL_CONSOLIDATION } from './attendance-retention.constants';
import { AttendanceRetentionStorageService } from './attendance-retention-storage.service';

export type AnnualConsolidationOutcome =
  | { status: 'consolidated'; document: AttendanceClosureDocumentEntity; consolidatedMonthlyDocumentIds: string[] }
  | { status: 'not_enough_monthly_documents'; unconsolidatedCount: number };

// "Serviço de Consolidação Anual" (architecture-overview.md, Frente 10,
// Estrutura proposta item 4). Auto-conditional, same shape the Frente 10
// technology decision calls for (item 2): runs, checks whether 12
// un-consolidated monthly documents already exist for this tenant, and is a
// clean no-op otherwise — a script can call this on every invocation without
// tracking its own "did I already run this year" state.
//
// RULE-RET-02: folds the OLDEST 12 still-un-consolidated monthly documents
// (consolidated_into_document_id IS NULL) into one annual document, then
// erases their CONTENT only (storage_key -> NULL, content_deleted_at
// stamped) — the metadata row survives, same posture as
// AbsenceJustificationAttachmentEntity.deletedAt (see the entity's own
// header for why). "12" is read as a ROLLING WINDOW, not calendar-year
// alignment — Frente 10 architecture Open Question 6, unconfirmed; this is
// the literal cardinality RULE-RET-02 states, not a resolution of that
// question forced here.
@Injectable()
export class AttendanceAnnualConsolidationService {
  private readonly logger = new Logger(AttendanceAnnualConsolidationService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly storage: AttendanceRetentionStorageService,
  ) {}

  async consolidateNext(tenantId: string): Promise<AnnualConsolidationOutcome> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(AttendanceClosureDocumentEntity);

    const unconsolidated = await repository.find({
      where: { tenantId, periodType: 'monthly', consolidatedIntoDocumentId: IsNull() },
      order: { periodYear: 'ASC', periodMonth: 'ASC' },
    });

    if (unconsolidated.length < ATTENDANCE_RETENTION_MONTHS_PER_ANNUAL_CONSOLIDATION) {
      return { status: 'not_enough_monthly_documents', unconsolidatedCount: unconsolidated.length };
    }

    const batch = unconsolidated.slice(0, ATTENDANCE_RETENTION_MONTHS_PER_ANNUAL_CONSOLIDATION);
    // The batch's most recent month's calendar year — the closest available
    // single "year" label for a 12-month rolling window that may not align
    // to a calendar year (see the class header). Only used as the annual
    // row's period_year column; the batch itself is the authoritative record
    // of exactly which 12 months this consolidation covers.
    const consolidationYear = batch[batch.length - 1].periodYear;

    const summary = {
      consolidatedMonths: batch.map((doc) => ({
        year: doc.periodYear,
        month: doc.periodMonth,
        checksumSha256: doc.checksumSha256,
      })),
    };
    const body = Buffer.from(JSON.stringify(summary), 'utf8');
    const checksumSha256 = createHash('sha256').update(body).digest('hex');
    const storageKey = `${tenantId}/annual/${consolidationYear}-${batch[0].id}.json`;

    await this.storage.upload(storageKey, body, 'application/json');

    const annualDocument = await repository.save(
      repository.create({
        tenantId,
        periodType: 'annual',
        periodYear: consolidationYear,
        periodMonth: null,
        summary,
        storageKey,
        mimeType: 'application/json',
        sizeBytes: body.byteLength,
        checksumSha256,
      }),
    );

    for (const monthlyDocument of batch) {
      // eslint-disable-next-line no-await-in-loop -- sequential, at most 12
      // rows, unattended annual job (same posture as
      // AbsenceJustificationAttachmentService.sweepDueAttachments's loop).
      await this.eliminateMonthlyContent(monthlyDocument, annualDocument.id);
    }

    this.logger.log(
      `Annual closure generated for tenant ${tenantId}, consolidating ${batch.length} monthly documents into ${annualDocument.id}.`,
    );
    return { status: 'consolidated', document: annualDocument, consolidatedMonthlyDocumentIds: batch.map((doc) => doc.id) };
  }

  private async eliminateMonthlyContent(monthlyDocument: AttendanceClosureDocumentEntity, annualDocumentId: string): Promise<void> {
    if (monthlyDocument.storageKey) {
      await this.storage.delete(monthlyDocument.storageKey);
    }
    await this.tenantContext
      .getManager()
      .getRepository(AttendanceClosureDocumentEntity)
      .update(
        { id: monthlyDocument.id },
        { storageKey: null, contentDeletedAt: new Date(), consolidatedIntoDocumentId: annualDocumentId },
      );
  }
}
