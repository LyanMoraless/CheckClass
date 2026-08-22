import { AttendanceFactorTypeEntity, RawIdentificationEventEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockInsertQueryBuilder,
  createMockRepository,
  createMockTenantContext,
} from '../../../test/unit/support/mock-entity-manager';
import { IdentificationService } from './identification.service';

// Covers only the app check-in (RULE-ATT-06's confirmed note) branches added
// to IdentificationService — resolving personId from the payload embedded by
// AppCheckinService (never re-derived from a device signal, since there is
// none) and carrying through the class_session AppCheckinService already
// resolved (no room signal to key off of), rather than re-testing the
// pre-existing device-path behavior (covered today by the integration spec).
describe('IdentificationService — app check-in event handling', () => {
  const rawEvent = {
    id: 'raw-event-1',
    tenantId: 'tenant-a-id',
    deviceId: null,
    eventType: 'APP_CHECKIN',
    idempotencyKey: 'idem-1',
    rawPayload: {
      capturedAt: '2026-08-22T10:00:00.000Z',
      roomId: null,
      data: { personId: 'person-1', classSessionId: 'session-1' },
    },
  };

  function buildService(options: { insertedCheckinId?: string | null } = {}) {
    const rawEventRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(rawEvent) });
    const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-app-checkin' }) });

    const repositoriesByEntity = new Map([
      [RawIdentificationEventEntity, rawEventRepo],
      [AttendanceFactorTypeEntity, factorTypeRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(options.insertedCheckinId ?? 'checkin-1'));

    const tenantContext = createMockTenantContext(manager);
    const queue = { sendWithManager: jest.fn().mockResolvedValue(undefined) };
    const service = new IdentificationService(tenantContext as never, queue as never);
    return { service, manager, queue, factorTypeRepo };
  }

  test('test_processRawEvent_appCheckinEvent_resolvesPersonFromPayloadAndUsesEmbeddedClassSession', async () => {
    const { service, manager, queue } = buildService();

    await service.processRawEvent('raw-event-1');

    const insertBuilder = manager.createQueryBuilder.mock.results[0].value;
    expect(insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 'person-1',
        classSessionId: 'session-1',
        attendanceFactorTypeId: 'factor-app-checkin',
      }),
    );
    expect(queue.sendWithManager).toHaveBeenCalledWith(
      'deduplicate-checkin',
      { checkinId: 'checkin-1', tenantId: 'tenant-a-id' },
      manager,
    );
  });

  test('test_processRawEvent_appCheckinEvent_missingPersonIdInPayload_logsAndDropsWithoutCreatingCheckin', async () => {
    const rawEventWithoutPerson = {
      ...rawEvent,
      rawPayload: { capturedAt: rawEvent.rawPayload.capturedAt, roomId: null, data: { classSessionId: 'session-1' } },
    };
    const rawEventRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(rawEventWithoutPerson) });
    const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-app-checkin' }) });
    const manager = createMockEntityManager(
      new Map([
        [RawIdentificationEventEntity, rawEventRepo],
        [AttendanceFactorTypeEntity, factorTypeRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const queue = { sendWithManager: jest.fn().mockResolvedValue(undefined) };
    const service = new IdentificationService(tenantContext as never, queue as never);

    await service.processRawEvent('raw-event-1');

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });
});
