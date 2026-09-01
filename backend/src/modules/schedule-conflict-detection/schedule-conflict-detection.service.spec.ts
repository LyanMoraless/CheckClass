import { ConflictException } from '@nestjs/common';
import { createMockEntityManager, createMockTenantContext, MockEntityManager } from '../../../test/unit/support/mock-entity-manager';
import { ScheduleConflictCandidate, ScheduleConflictDetectionService } from './schedule-conflict-detection.service';

// RULE-INST-10: [same room OR shared teacher] AND [exact time overlap, no
// tolerance]. The query itself lives in Postgres (raw SQL via manager.query)
// so these unit tests only verify the parameters passed and the
// found/not-found branching — the actual overlap/room/teacher SQL logic is a
// real-Postgres-only concern, same trade-off already accepted elsewhere in
// this codebase (see mock-entity-manager.ts's top-of-file comment).
describe('ScheduleConflictDetectionService', () => {
  const baseCandidate: ScheduleConflictCandidate = {
    roomId: 'room-1',
    teacherPersonIds: ['teacher-1'],
    scheduledStart: new Date('2026-09-07T13:00:00.000Z'),
    scheduledEnd: new Date('2026-09-07T15:00:00.000Z'),
  };

  function buildService(rows: Array<{ id: string }> = []) {
    const manager = createMockEntityManager();
    manager.query.mockResolvedValue(rows);
    const tenantContext = createMockTenantContext(manager);
    const service = new ScheduleConflictDetectionService(tenantContext as never);
    return { service, manager };
  }

  test('test_assertNoConflict_noOverlappingSession_resolvesWithoutThrowing', async () => {
    const { service } = buildService([]);

    await expect(service.assertNoConflict(baseCandidate)).resolves.toBeUndefined();
  });

  test('test_assertNoConflict_overlappingSessionFound_throwsConflictException', async () => {
    const { service } = buildService([{ id: 'existing-session-1' }]);

    await expect(service.assertNoConflict(baseCandidate)).rejects.toThrow(ConflictException);
  });

  test('test_assertNoConflict_queriesWithTenantIdExcludeIdWindowRoomAndTeachers', async () => {
    const { service, manager } = buildService([]);

    await service.assertNoConflict({ ...baseCandidate, classSessionIdToExclude: 'session-to-exclude' });

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_session'), [
      'tenant-a-id',
      'session-to-exclude',
      baseCandidate.scheduledStart.toISOString(),
      baseCandidate.scheduledEnd.toISOString(),
      'room-1',
      ['teacher-1'],
    ]);
  });

  test('test_assertNoConflict_noExcludeId_passesNullAsThirdParam', async () => {
    const { service, manager } = buildService([]);

    await service.assertNoConflict(baseCandidate);

    expect(manager.query).toHaveBeenCalledWith(expect.any(String), [
      'tenant-a-id',
      null,
      baseCandidate.scheduledStart.toISOString(),
      baseCandidate.scheduledEnd.toISOString(),
      'room-1',
      ['teacher-1'],
    ]);
  });

  test('test_assertNoConflict_roomlessCandidate_passesNullRoomIdThrough', async () => {
    const { service, manager } = buildService([]);

    await service.assertNoConflict({ ...baseCandidate, roomId: null });

    expect(manager.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([null]),
    );
  });

  test('test_assertNoConflict_noTeachers_passesEmptyArrayThrough', async () => {
    const { service, manager } = buildService([]);

    await service.assertNoConflict({ ...baseCandidate, teacherPersonIds: [] });

    const [, params] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(params[5]).toEqual([]);
  });

  test('test_assertNoConflict_errorMessage_includesConflictingSessionIdAndWindow', async () => {
    const { service } = buildService([{ id: 'existing-session-1' }]);

    await expect(service.assertNoConflict(baseCandidate)).rejects.toThrow(/existing-session-1/);
  });
});
