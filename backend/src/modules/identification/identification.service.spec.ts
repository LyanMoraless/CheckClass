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
    const wristbandIdentity = { resolveByTagCode: jest.fn().mockResolvedValue(null) };
    const service = new IdentificationService(tenantContext as never, queue as never, wristbandIdentity as never);
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
    const wristbandIdentity = { resolveByTagCode: jest.fn().mockResolvedValue(null) };
    const service = new IdentificationService(tenantContext as never, queue as never, wristbandIdentity as never);

    await service.processRawEvent('raw-event-1');

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });
});

// RULE-INST-07: a device-originated event (with a room signal) must resolve
// to sessions generated automatically by the recurring grade — those are
// persisted with class_session.roomId = NULL on purpose ("inherit
// class_group.roomId"), not "no room". Regression coverage for the
// resolveClassSession query, which used to compare literally against
// session.roomId and would therefore never match such a session.
describe('IdentificationService — resolveClassSession effective room (RULE-INST-07)', () => {
  const rawEvent = {
    id: 'raw-event-2',
    tenantId: 'tenant-a-id',
    deviceId: 'device-1',
    eventType: 'TAG_CHECKIN',
    idempotencyKey: 'idem-2',
    rawPayload: {
      capturedAt: '2026-08-22T10:00:00.000Z',
      roomId: 'room-1',
      data: { tagCode: 'TAG-001' },
    },
  };

  function buildService() {
    const rawEventRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(rawEvent) });
    const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-tag-checkin' }) });

    const repositoriesByEntity = new Map([
      [RawIdentificationEventEntity, rawEventRepo],
      [AttendanceFactorTypeEntity, factorTypeRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    // Session found by effective room — this is the row a session with
    // class_session.room_id = NULL, inheriting class_group.room_id = 'room-1',
    // would produce.
    manager.query.mockResolvedValue([{ id: 'session-inheriting-room' }]);
    manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder('checkin-2'));

    const tenantContext = createMockTenantContext(manager);
    const queue = { sendWithManager: jest.fn().mockResolvedValue(undefined) };
    const wristbandIdentity = { resolveByTagCode: jest.fn().mockResolvedValue({ personId: 'person-2' }) };
    const service = new IdentificationService(tenantContext as never, queue as never, wristbandIdentity as never);
    return { service, manager, queue };
  }

  test('test_processRawEvent_deviceEventWithRoom_sessionHasNullRoomId_matchesByClassGroupEffectiveRoom', async () => {
    const { service, manager, queue } = buildService();

    await service.processRawEvent('raw-event-2');

    // The query must resolve the EFFECTIVE room (COALESCE(cs.room_id,
    // cg.room_id)), not session.roomId alone.
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(cs.room_id, cg.room_id)'),
      ['tenant-a-id', 'room-1', '2026-08-22T10:00:00.000Z'],
    );

    const insertBuilder = manager.createQueryBuilder.mock.results[0].value;
    expect(insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({ classSessionId: 'session-inheriting-room' }),
    );
    expect(queue.sendWithManager).toHaveBeenCalled();
  });
});
