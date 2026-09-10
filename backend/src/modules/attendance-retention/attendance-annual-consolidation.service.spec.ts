import { AttendanceClosureDocumentEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { AttendanceAnnualConsolidationService } from './attendance-annual-consolidation.service';

function monthlyDoc(id: string, year: number, month: number): AttendanceClosureDocumentEntity {
  return {
    id,
    tenantId: 'tenant-a-id',
    periodType: 'monthly',
    periodYear: year,
    periodMonth: month,
    storageKey: `tenant-a-id/monthly/${year}-${String(month).padStart(2, '0')}.json`,
    checksumSha256: `checksum-${id}`,
    consolidatedIntoDocumentId: null,
  } as AttendanceClosureDocumentEntity;
}

// "Serviço de Consolidação Anual" (RULE-RET-02, Frente 10 Estrutura proposta
// item 4): auto-conditional on 12 accumulated, still un-consolidated monthly
// documents — folds them into one annual document and erases only their
// CONTENT (metadata row survives), same posture as
// AbsenceJustificationAttachmentEntity.deletedAt.
describe('AttendanceAnnualConsolidationService', () => {
  function buildService(unconsolidatedDocs: AttendanceClosureDocumentEntity[]) {
    const closureRepo = createMockRepository({
      find: jest.fn().mockResolvedValue(unconsolidatedDocs),
      // Real TypeORM assigns the DB-generated id on save() — the default
      // mock (mock-entity-manager.ts) just echoes the input back, which
      // would leave annualDocument.id undefined for the rest of the
      // service's own logic (consolidated_into_document_id) to consume.
      save: jest.fn((entity: Record<string, unknown>) => Promise.resolve({ id: 'annual-doc-id', ...entity })),
    });
    const repositoriesByEntity = new Map<unknown, MockRepository>([[AttendanceClosureDocumentEntity, closureRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const storage = { upload: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) };

    const service = new AttendanceAnnualConsolidationService(tenantContext as never, storage as never);
    return { service, closureRepo, storage, manager };
  }

  test('test_consolidateNext_fewerThanTwelveUnconsolidatedDocuments_isNoOp', async () => {
    const docs = Array.from({ length: 11 }, (_, i) => monthlyDoc(`doc-${i}`, 2026, i + 1));
    const { service, storage } = buildService(docs);

    const outcome = await service.consolidateNext('tenant-a-id');

    expect(outcome).toEqual({ status: 'not_enough_monthly_documents', unconsolidatedCount: 11 });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  test('test_consolidateNext_exactlyTwelve_consolidatesAllOfThem', async () => {
    const docs = Array.from({ length: 12 }, (_, i) => monthlyDoc(`doc-${i}`, 2026, i + 1));
    const { service, closureRepo } = buildService(docs);

    const outcome = await service.consolidateNext('tenant-a-id');

    expect(outcome.status).toBe('consolidated');
    if (outcome.status === 'consolidated') {
      expect(outcome.consolidatedMonthlyDocumentIds).toEqual(docs.map((d) => d.id));
    }
    expect(closureRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a-id', periodType: 'annual', periodMonth: null }),
    );
  });

  test('test_consolidateNext_moreThanTwelve_onlyConsolidatesTheOldestTwelve', async () => {
    // 14 already-sorted (oldest-first) unconsolidated documents, spanning
    // into a second calendar year — repository.find applies the real
    // ordering (periodYear ASC, periodMonth ASC); the mock here just returns
    // them pre-sorted, exactly as the DB query would.
    const docs = [
      ...Array.from({ length: 12 }, (_, i) => monthlyDoc(`doc-${i}`, 2026, i + 1)),
      monthlyDoc('doc-12', 2027, 1),
      monthlyDoc('doc-13', 2027, 2),
    ];
    const { service } = buildService(docs);

    const outcome = await service.consolidateNext('tenant-a-id');

    expect(outcome.status).toBe('consolidated');
    if (outcome.status === 'consolidated') {
      expect(outcome.consolidatedMonthlyDocumentIds).toEqual(docs.slice(0, 12).map((d) => d.id));
    }
  });

  test('test_consolidateNext_eliminatesContentOfEachMonthlyDocument_metadataRowSurvives', async () => {
    const docs = Array.from({ length: 12 }, (_, i) => monthlyDoc(`doc-${i}`, 2026, i + 1));
    const { service, closureRepo, storage } = buildService(docs);

    await service.consolidateNext('tenant-a-id');

    // Content actually removed from object storage for every monthly doc.
    expect(storage.delete).toHaveBeenCalledTimes(12);
    for (const doc of docs) {
      expect(storage.delete).toHaveBeenCalledWith(doc.storageKey);
    }

    // Metadata row updated (storage_key -> NULL, content_deleted_at set,
    // consolidated_into_document_id set) — never a DELETE of the row itself.
    expect(closureRepo.delete).not.toHaveBeenCalled();
    for (const doc of docs) {
      expect(closureRepo.update).toHaveBeenCalledWith(
        { id: doc.id },
        expect.objectContaining({ storageKey: null, consolidatedIntoDocumentId: expect.any(String) }),
      );
    }
  });

  test('test_consolidateNext_annualDocumentSummary_recordsChecksumOfEachConsolidatedMonth', async () => {
    const docs = Array.from({ length: 12 }, (_, i) => monthlyDoc(`doc-${i}`, 2026, i + 1));
    const { service, closureRepo } = buildService(docs);

    await service.consolidateNext('tenant-a-id');

    const savedAnnual = closureRepo.save.mock.calls[0][0] as { summary: { consolidatedMonths: Array<{ checksumSha256: string }> } };
    expect(savedAnnual.summary.consolidatedMonths).toHaveLength(12);
    expect(savedAnnual.summary.consolidatedMonths.map((m) => m.checksumSha256)).toEqual(docs.map((d) => d.checksumSha256));
  });
});
