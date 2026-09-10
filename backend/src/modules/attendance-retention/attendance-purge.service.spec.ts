import { AttendanceClosureDocumentEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { AttendancePurgeService } from './attendance-purge.service';

// "Serviço de Expurgo" (RULE-RET-01, Frente 10 Estrutura proposta item 3):
// only ever purges a (tenant, month) whose closure document already exists,
// and re-checks the pending-review gate row by row (RULE-ATT-11/RULE-RET-01
// exception extended to source rows, approved 2026-09-09).
describe('AttendancePurgeService', () => {
  function buildService(options: { closureDocument?: AttendanceClosureDocumentEntity | null; deletedCountsByTable?: Record<string, number> } = {}) {
    const closureRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(
        options.closureDocument === undefined
          ? ({ id: 'doc-1', tenantId: 'tenant-a-id', periodType: 'monthly', periodYear: 2026, periodMonth: 6 } as AttendanceClosureDocumentEntity)
          : options.closureDocument,
      ),
    });
    const repositoriesByEntity = new Map<unknown, MockRepository>([[AttendanceClosureDocumentEntity, closureRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);

    const counts = {
      presence_interval: options.deletedCountsByTable?.presence_interval ?? 3,
      identification_checkin: options.deletedCountsByTable?.identification_checkin ?? 4,
      raw_identification_event: options.deletedCountsByTable?.raw_identification_event ?? 5,
      session_attendance_consolidation: options.deletedCountsByTable?.session_attendance_consolidation ?? 6,
    };

    manager.query.mockImplementation((sql: string) => {
      const makeRows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `row-${i}` }));
      // Real Postgres driver shape for DELETE...RETURNING is a TUPLE,
      // `[rows, rowCount]` — never `rows` directly (confirmed against
      // node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:198-206).
      // A bare-array mock here would have let the every-DELETE-returns-a-
      // fixed-length-2-tuple bug (Testing Agent finding, AttendancePurgeService
      // always reporting 2 rows purged regardless of the real count) pass
      // silently.
      const makeDeleteResult = (n: number) => Promise.resolve([makeRows(n), n]);
      if (/DELETE FROM presence_interval/.test(sql)) return makeDeleteResult(counts.presence_interval);
      if (/DELETE FROM identification_checkin/.test(sql)) return makeDeleteResult(counts.identification_checkin);
      if (/DELETE FROM raw_identification_event/.test(sql)) return makeDeleteResult(counts.raw_identification_event);
      if (/DELETE FROM session_attendance_consolidation/.test(sql)) return makeDeleteResult(counts.session_attendance_consolidation);
      return Promise.resolve([]);
    });

    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const service = new AttendancePurgeService(tenantContext as never);
    return { service, manager, closureRepo };
  }

  test('test_purgeMonth_noClosureDocument_skipsWithoutDeletingAnything', async () => {
    const { service, manager } = buildService({ closureDocument: null });

    const outcome = await service.purgeMonth('tenant-a-id', 2026, 6);

    expect(outcome).toEqual({ status: 'skipped', reason: 'no_closure_document' });
    expect(manager.query.mock.calls.some(([sql]) => /^\s*DELETE/.test(sql as string))).toBe(false);
  });

  test('test_purgeMonth_closureDocumentExists_deletesFromAllFourSourceTablesAndReturnsCounts', async () => {
    const { service } = buildService();

    const outcome = await service.purgeMonth('tenant-a-id', 2026, 6);

    expect(outcome).toEqual({
      status: 'purged',
      counts: {
        rawIdentificationEventDeleted: 5,
        identificationCheckinDeleted: 4,
        presenceIntervalDeleted: 3,
        sessionAttendanceConsolidationDeleted: 6,
      },
    });
  });

  test('test_purgeMonth_deletesIdentificationCheckinBeforeRawIdentificationEvent', async () => {
    // FK ordering (identification_checkin.raw_identification_event_id has no
    // ON DELETE CASCADE) — see the service's own header.
    const { service, manager } = buildService();

    await service.purgeMonth('tenant-a-id', 2026, 6);

    const checkinIndex = manager.query.mock.calls.findIndex(([sql]) => /DELETE FROM identification_checkin/.test(sql as string));
    const eventIndex = manager.query.mock.calls.findIndex(([sql]) => /DELETE FROM raw_identification_event/.test(sql as string));
    expect(checkinIndex).toBeGreaterThanOrEqual(0);
    expect(eventIndex).toBeGreaterThan(checkinIndex);
  });

  test('test_purgeMonth_everyDeleteExcludesRowsBlockedByNonTerminalPendingReview', async () => {
    const { service, manager } = buildService();

    await service.purgeMonth('tenant-a-id', 2026, 6);

    const deleteCalls = manager.query.mock.calls.filter(([sql]) => /^\s*DELETE FROM/.test(sql as string));
    expect(deleteCalls).toHaveLength(4);
    for (const [sql] of deleteCalls) {
      expect(sql).toMatch(/resolved_at IS NULL/);
    }
  });

  // Testing Agent finding, dedicated regression test: each *Deleted count must
  // reflect the ACTUAL number of rows purged, not a fixed 2 — the symptom of
  // reading `.length` off the undestructured `[rows, rowCount]` tuple
  // real Postgres driver hands back for DELETE...RETURNING (see each private
  // delete method's own comment). Deliberately uses four DIFFERENT counts,
  // none of them 2, so this test cannot pass by coincidence the way a
  // same-value assertion could.
  test('test_purgeMonth_deletedCountsReflectActualRowsPurged_notAFixedTupleLength', async () => {
    const { service } = buildService({
      deletedCountsByTable: {
        presence_interval: 7,
        identification_checkin: 11,
        raw_identification_event: 0,
        session_attendance_consolidation: 3,
      },
    });

    const outcome = await service.purgeMonth('tenant-a-id', 2026, 6);

    expect(outcome).toEqual({
      status: 'purged',
      counts: {
        presenceIntervalDeleted: 7,
        identificationCheckinDeleted: 11,
        rawIdentificationEventDeleted: 0,
        sessionAttendanceConsolidationDeleted: 3,
      },
    });
  });

  test('test_purgeMonth_sessionAttendanceConsolidationDelete_scopedByClassSessionJoin', async () => {
    const { service, manager } = buildService();

    await service.purgeMonth('tenant-a-id', 2026, 6);

    const [sql] = manager.query.mock.calls.find(([s]) => /DELETE FROM session_attendance_consolidation/.test(s as string)) as [
      string,
      unknown[],
    ];
    expect(sql).toMatch(/USING class_session/);
    expect(sql).toMatch(/cs\.scheduled_start/);
  });
});
