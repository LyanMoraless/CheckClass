import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { AttendanceRetentionPendingGateService } from './attendance-retention-pending-gate.service';

// Frente 10 technology decision item 4: no denormalized "blocked" column —
// this is the one query expressing the gate against attendance_pending_review
// for all four RULE-RET-01 source tables.
describe('AttendanceRetentionPendingGateService', () => {
  function buildService(blocked: boolean) {
    const manager = createMockEntityManager();
    manager.query.mockResolvedValue([{ blocked }]);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const service = new AttendanceRetentionPendingGateService(tenantContext as never);
    return { service, manager };
  }

  test('test_monthHasBlockingPendingReview_queryResolvesTrue_returnsTrue', async () => {
    const { service } = buildService(true);

    const result = await service.monthHasBlockingPendingReview('tenant-a-id', new Date('2026-06-01'), new Date('2026-07-01'));

    expect(result).toBe(true);
  });

  test('test_monthHasBlockingPendingReview_queryResolvesFalse_returnsFalse', async () => {
    const { service } = buildService(false);

    const result = await service.monthHasBlockingPendingReview('tenant-a-id', new Date('2026-06-01'), new Date('2026-07-01'));

    expect(result).toBe(false);
  });

  test('test_monthHasBlockingPendingReview_noRowReturned_defaultsToFalse', async () => {
    const manager = createMockEntityManager();
    manager.query.mockResolvedValue([]);
    const service = new AttendanceRetentionPendingGateService(createMockTenantContext(manager, 'tenant-a-id') as never);

    const result = await service.monthHasBlockingPendingReview('tenant-a-id', new Date('2026-06-01'), new Date('2026-07-01'));

    expect(result).toBe(false);
  });

  test('test_monthHasBlockingPendingReview_queryCoversAllFourSourceTables_andExcludesTerminalReviews', async () => {
    const { service, manager } = buildService(false);

    await service.monthHasBlockingPendingReview('tenant-a-id', new Date('2026-06-01'), new Date('2026-07-01'));

    const [query, params] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/session_attendance_consolidation/);
    expect(query).toMatch(/presence_interval/);
    expect(query).toMatch(/identification_checkin/);
    expect(query).toMatch(/raw_identification_event/);
    // The two-hop join for raw_identification_event (Frente 10 technology
    // decision item 4): via identification_checkin.raw_identification_event_id.
    expect(query).toMatch(/raw_identification_event_id/);
    // Only non-terminal (unresolved) pending reviews block.
    expect(query).toMatch(/resolved_at IS NULL/);
    expect(params).toEqual(['tenant-a-id', new Date('2026-06-01'), new Date('2026-07-01')]);
  });
});
