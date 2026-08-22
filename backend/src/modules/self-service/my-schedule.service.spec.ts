import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { MyScheduleService } from './my-schedule.service';

// RULE-ATT-15: self-scoped "own schedule/calendar" read — pure composition
// of class_group_enrollment + class_session, scoped to the given personId
// and the current tenant (never any other person's rows).
describe('MyScheduleService', () => {
  function buildService(rows: unknown[] = []) {
    const manager = createMockEntityManager();
    manager.query.mockResolvedValue(rows);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const service = new MyScheduleService(tenantContext as never);
    return { service, manager };
  }

  test('test_getMySchedule_queriesByTenantAndGivenPersonIdOnly', async () => {
    const { service, manager } = buildService();

    await service.getMySchedule('student-1');

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_group_enrollment'), [
      'tenant-a-id',
      'student-1',
    ]);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_session'), ['tenant-a-id', 'student-1']);
  });

  test('test_getMySchedule_joinsEnrollmentToSessionOnClassGroupId_notOnAnyOtherPersonsEnrollment', async () => {
    const { service, manager } = buildService();

    await service.getMySchedule('student-1');

    const [query] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/JOIN class_session cs ON cs\.class_group_id = cge\.class_group_id/);
    expect(query).toMatch(/cge\.person_id = \$2/);
  });

  test('test_getMySchedule_returnsRowsResolvedFromTheQuery', async () => {
    const rows = [
      {
        classSessionId: 'session-1',
        classGroupId: 'class-group-1',
        roomId: 'room-1',
        scheduledStart: new Date('2026-08-24T13:00:00Z'),
        scheduledEnd: new Date('2026-08-24T15:00:00Z'),
      },
    ];
    const { service } = buildService(rows);

    const result = await service.getMySchedule('student-1');

    expect(result).toEqual(rows);
  });
});
