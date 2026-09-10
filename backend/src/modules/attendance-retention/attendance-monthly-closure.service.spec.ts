import { createHash } from 'crypto';
import { AttendanceClosureDocumentEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { AttendanceMonthlyClosureService } from './attendance-monthly-closure.service';

// "Serviço de Fechamento Mensal" (RULE-RET-01, Frente 10 Estrutura proposta
// item 1): idempotent per (tenant, month), eligible only once the month is
// fully past the 60-day live window AND nothing in its scope is blocked by a
// non-terminal attendance_pending_review — generates a real, checksummed,
// object-storage artifact (never jsonb-inline raw content, Frente 10
// technology decision item 1) and a size-bounded summary row.
describe('AttendanceMonthlyClosureService', () => {
  function buildService(options: {
    existingDocument?: AttendanceClosureDocumentEntity | null;
    monthBlocked?: boolean;
    now?: Date;
    sourceRows?: {
      rawIdentificationEvents?: unknown[];
      identificationCheckins?: unknown[];
      presenceIntervals?: unknown[];
      sessionAttendanceConsolidations?: unknown[];
    };
  } = {}) {
    const closureRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.existingDocument ?? null),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([[AttendanceClosureDocumentEntity, closureRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);

    const sourceRows = {
      rawIdentificationEvents: options.sourceRows?.rawIdentificationEvents ?? [{ id: 'raw-1' }],
      identificationCheckins: options.sourceRows?.identificationCheckins ?? [{ id: 'checkin-1' }],
      presenceIntervals: options.sourceRows?.presenceIntervals ?? [{ id: 'interval-1' }],
      sessionAttendanceConsolidations: options.sourceRows?.sessionAttendanceConsolidations ?? [{ id: 'sac-1' }, { id: 'sac-2' }],
    };

    manager.query.mockImplementation((sql: string) => {
      if (/FROM raw_identification_event/.test(sql)) return Promise.resolve(sourceRows.rawIdentificationEvents);
      if (/FROM identification_checkin/.test(sql)) return Promise.resolve(sourceRows.identificationCheckins);
      if (/FROM presence_interval/.test(sql)) return Promise.resolve(sourceRows.presenceIntervals);
      if (/FROM session_attendance_consolidation/.test(sql)) return Promise.resolve(sourceRows.sessionAttendanceConsolidations);
      return Promise.resolve([]);
    });

    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const pendingGate = { monthHasBlockingPendingReview: jest.fn().mockResolvedValue(options.monthBlocked ?? false) };
    const storage = { upload: jest.fn().mockResolvedValue(undefined) };

    const service = new AttendanceMonthlyClosureService(tenantContext as never, pendingGate as never, storage as never);

    if (options.now) {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(options.now);
    }

    return { service, closureRepo, pendingGate, storage, manager };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  test('test_closeMonth_alreadyClosed_returnsExistingDocumentWithoutGeneratingAnything', async () => {
    const existing = { id: 'doc-1', tenantId: 'tenant-a-id', periodType: 'monthly', periodYear: 2026, periodMonth: 5 } as AttendanceClosureDocumentEntity;
    const { service, storage, pendingGate } = buildService({ existingDocument: existing });

    const outcome = await service.closeMonth('tenant-a-id', 2026, 5);

    expect(outcome).toEqual({ status: 'already_closed', document: existing });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(pendingGate.monthHasBlockingPendingReview).not.toHaveBeenCalled();
  });

  test('test_closeMonth_monthNotYetPast60Days_returnsNotYetEligible', async () => {
    // June 2026 ends 2026-07-01; +60 days = 2026-08-30. "Now" one day short.
    const { service, storage } = buildService({ now: new Date('2026-08-29T00:00:00.000Z') });

    const outcome = await service.closeMonth('tenant-a-id', 2026, 6);

    expect(outcome).toEqual({ status: 'not_yet_eligible', reason: 'month_not_past_live_window' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test('test_closeMonth_monthBlockedByNonTerminalPendingReview_returnsNotYetEligible', async () => {
    const { service, storage } = buildService({ now: new Date('2026-09-01T00:00:00.000Z'), monthBlocked: true });

    const outcome = await service.closeMonth('tenant-a-id', 2026, 6);

    expect(outcome).toEqual({ status: 'not_yet_eligible', reason: 'blocking_pending_review' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test('test_closeMonth_eligible_uploadsChecksummedArtifactAndPersistsSummaryRow', async () => {
    const { service, closureRepo, storage } = buildService({ now: new Date('2026-09-01T00:00:00.000Z') });

    const outcome = await service.closeMonth('tenant-a-id', 2026, 6);

    expect(outcome.status).toBe('created');
    expect(storage.upload).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = storage.upload.mock.calls[0];
    expect(key).toBe('tenant-a-id/monthly/2026-06.json');
    expect(contentType).toBe('application/json');

    const expectedChecksum = createHash('sha256').update(body as Buffer).digest('hex');

    expect(closureRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a-id',
        periodType: 'monthly',
        periodYear: 2026,
        periodMonth: 6,
        storageKey: 'tenant-a-id/monthly/2026-06.json',
        mimeType: 'application/json',
        checksumSha256: expectedChecksum,
        summary: {
          rawIdentificationEventCount: 1,
          identificationCheckinCount: 1,
          presenceIntervalCount: 1,
          sessionAttendanceConsolidationCount: 2,
        },
      }),
    );
  });

  test('test_closeMonth_sessionAttendanceConsolidationQuery_isDrivenByClassSessionJoin', async () => {
    // Same non-negotiable shape as Controle B's own countInWindow: consolidation
    // rows only exist per (session, person), so scoping "this month" has to go
    // through class_session.scheduled_start, not a non-existent own timestamp.
    const { service, manager } = buildService({ now: new Date('2026-09-01T00:00:00.000Z') });

    await service.closeMonth('tenant-a-id', 2026, 6);

    const sacCall = manager.query.mock.calls.find(([sql]) => /FROM session_attendance_consolidation/.test(sql as string));
    expect(sacCall).toBeDefined();
    const [sql] = sacCall as [string, unknown[]];
    expect(sql).toMatch(/JOIN class_session/);
    expect(sql).toMatch(/cs\.scheduled_start/);
  });
});
