import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { AttendanceRetentionArchiveLookupService } from './attendance-retention-archive-lookup.service';

// RULE-RET-01 mobile-app note: a session that fell out of the live 60-day
// window reads as "archived", never as if it had never existed — but ONLY
// when a monthly attendance_closure_document actually confirms the purge;
// otherwise this conservatively reports nothing (see the service's own
// header for why, and the current RLS gap that makes the closure-document
// check always resolve to "not found" today).
describe('AttendanceRetentionArchiveLookupService', () => {
  function buildService(gapSessions: Array<{ class_session_id: string; scheduled_start: Date; scheduled_end: Date }>, hasClosureDocument: boolean) {
    const manager = createMockEntityManager();
    manager.query.mockImplementation((sql: string) => {
      if (/FROM class_session/.test(sql)) return Promise.resolve(gapSessions);
      if (/attendance_closure_document/.test(sql)) return Promise.resolve([{ exists: hasClosureDocument }]);
      return Promise.resolve([]);
    });
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const service = new AttendanceRetentionArchiveLookupService(tenantContext as never);
    return { service, manager };
  }

  test('test_findArchivedGapSessions_noGapSessions_returnsEmptyWithoutCheckingClosureDocuments', async () => {
    const { service, manager } = buildService([], true);

    const result = await service.findArchivedGapSessions('person-1');

    expect(result).toEqual([]);
    expect(manager.query.mock.calls.some(([sql]) => /attendance_closure_document/.test(sql as string))).toBe(false);
  });

  test('test_findArchivedGapSessions_gapSessionWithConfirmedClosureDocument_reportsArchived', async () => {
    const session = { class_session_id: 'session-old-1', scheduled_start: new Date('2026-03-05T10:00:00.000Z'), scheduled_end: new Date('2026-03-05T11:00:00.000Z') };
    const { service } = buildService([session], true);

    const result = await service.findArchivedGapSessions('person-1');

    expect(result).toEqual([{ classSessionId: 'session-old-1', scheduledStart: session.scheduled_start, scheduledEnd: session.scheduled_end }]);
  });

  test('test_findArchivedGapSessions_gapSessionWithoutClosureDocument_conservativelyReportsNothing', async () => {
    // The "estado inconsistente (sweep atrasado)" case — never claim
    // "archived" without a closure document confirming it.
    const session = { class_session_id: 'session-old-2', scheduled_start: new Date('2026-03-05T10:00:00.000Z'), scheduled_end: new Date('2026-03-05T11:00:00.000Z') };
    const { service } = buildService([session], false);

    const result = await service.findArchivedGapSessions('person-1');

    expect(result).toEqual([]);
  });

  test('test_findArchivedGapSessions_queriesByPersonEnrollmentAndOptionalClassGroup', async () => {
    const { service, manager } = buildService([], false);

    await service.findArchivedGapSessions('person-1', 'class-group-1');

    const [query, params] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/class_group_enrollment/);
    expect(query).toMatch(/LEFT JOIN session_attendance_consolidation/);
    expect(params).toEqual(['tenant-a-id', 'person-1', 'class-group-1', expect.any(Date)]);
  });

  test('test_findArchivedGapSessions_checksClosureDocumentByYearAndMonthOfEachGapSession', async () => {
    const session = { class_session_id: 'session-old-3', scheduled_start: new Date('2026-03-05T10:00:00.000Z'), scheduled_end: new Date('2026-03-05T11:00:00.000Z') };
    const { service, manager } = buildService([session], true);

    await service.findArchivedGapSessions('person-1');

    const closureCall = manager.query.mock.calls.find(([sql]) => /attendance_closure_document/.test(sql as string)) as [string, unknown[]];
    const [, params] = closureCall;
    expect(params).toEqual(['tenant-a-id', 2026, 3]);
  });
});
