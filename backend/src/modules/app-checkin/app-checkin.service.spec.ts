import { InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';
import { AttendanceFactorTypeEntity, RawIdentificationEventEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockInsertQueryBuilder,
  createMockRepository,
  createMockTenantContext,
  MockEntityManager,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { AppCheckinDto } from './dto/app-checkin.dto';
import { AppCheckinService } from './app-checkin.service';

// RULE-ATT-06's confirmed note: app check-in resolves its class session
// automatically from the caller's own active enrollments + the session
// in-progress right now (no room signal, unlike device check-in), then
// feeds the same downstream pipeline (raw_identification_event ->
// IDENTIFY_EVENT_QUEUE) as any other factor. The overlapping-sessions case
// is an explicit, unconfirmed gap (pending-decisions.md) — covered here as
// a safe-stopgap rejection, not a guess at real business behavior.
//
// Security/code-review finding + user decision (2026-08-22): capturedAt is
// no longer part of the client-facing contract, and "now" is exclusively the
// SERVER's own clock — every test here runs under jest fake timers with a
// fixed system time so assertions about "what timestamp was used" are exact
// and don't depend on wall-clock drift while the test runs.
describe('AppCheckinService', () => {
  const dto: AppCheckinDto = { idempotencyKey: 'idem-key-1' };
  const personId = 'person-1';
  const serverNowIso = '2026-08-22T10:00:00.000Z';

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(serverNowIso));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function buildService(options: { factorTypeRepo?: MockRepository; insertedId?: string | null } = {}) {
    const factorTypeRepo =
      options.factorTypeRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-app-checkin' }) });
    const rawEventRepo = createMockRepository();

    const repositoriesByEntity = new Map([
      [AttendanceFactorTypeEntity, factorTypeRepo],
      [RawIdentificationEventEntity, rawEventRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const insertedId = 'insertedId' in options ? options.insertedId ?? null : 'raw-event-1';
    manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(insertedId));

    const tenantContext = createMockTenantContext(manager);
    const queue = { sendWithManager: jest.fn().mockResolvedValue(undefined) };
    const service = new AppCheckinService(tenantContext as never, queue as never);
    return { service, manager, factorTypeRepo, rawEventRepo, queue };
  }

  function mockClassSessionRows(manager: MockEntityManager, rows: Array<{ id: string }>) {
    manager.query.mockResolvedValue(rows);
  }

  test('test_submit_singleActiveSessionFound_insertsRawEventAndEnqueuesIdentification', async () => {
    const { service, manager, queue } = buildService();
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    const result = await service.submit(personId, dto);

    expect(result).toEqual({ created: true, eventId: 'raw-event-1' });
    expect(manager.createQueryBuilder).toHaveBeenCalled();
    const insertBuilder = manager.createQueryBuilder.mock.results[0].value;
    expect(insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: null,
        eventType: 'APP_CHECKIN',
        idempotencyKey: dto.idempotencyKey,
        rawPayload: expect.objectContaining({
          capturedAt: serverNowIso,
          roomId: null,
          data: { personId, classSessionId: 'session-1' },
        }),
      }),
    );
    expect(queue.sendWithManager).toHaveBeenCalledWith(
      'identify-event',
      { rawEventId: 'raw-event-1', tenantId: 'tenant-a-id' },
      manager,
    );
  });

  test('test_submit_noActiveSessionForEnrollments_throwsUnprocessableEntityWithoutInsertingOrEnqueuing', async () => {
    const { service, manager, queue } = buildService();
    mockClassSessionRows(manager, []);

    await expect(service.submit(personId, dto)).rejects.toThrow(UnprocessableEntityException);

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  test('test_submit_overlappingActiveSessions_throwsUnprocessableEntityStopgapWithoutGuessing', async () => {
    // Gap — "Sobreposição de turmas simultâneas no check-in via app": not
    // confirmed, so this must reject rather than pick "first found"/"both".
    const { service, manager, queue } = buildService();
    mockClassSessionRows(manager, [{ id: 'session-1' }, { id: 'session-2' }]);

    await expect(service.submit(personId, dto)).rejects.toThrow(UnprocessableEntityException);

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  test('test_submit_idempotencyKeyAlreadyExistsForTenant_returnsExistingEventWithoutEnqueuingAgain', async () => {
    const rawEventRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'existing-raw-event' }),
    });
    const { service, manager, queue } = buildService({ insertedId: null });
    (manager.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === RawIdentificationEventEntity) return rawEventRepo;
      return createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-app-checkin' }) });
    });
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    const result = await service.submit(personId, dto);

    expect(result).toEqual({ created: false, eventId: 'existing-raw-event' });
    expect(rawEventRepo.findOneBy).toHaveBeenCalledWith({ idempotencyKey: dto.idempotencyKey });
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  test('test_submit_idempotencyConflictButNoExistingRowFound_throwsInternalServerError', async () => {
    const rawEventRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service, manager } = buildService({ insertedId: null });
    (manager.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === RawIdentificationEventEntity) return rawEventRepo;
      return createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-app-checkin' }) });
    });
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    await expect(service.submit(personId, dto)).rejects.toThrow(InternalServerErrorException);
  });

  test('test_submit_appCheckinFactorTypeNotSeeded_throwsInternalServerErrorWithoutInserting', async () => {
    const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service, manager, queue } = buildService({ factorTypeRepo });
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    await expect(service.submit(personId, dto)).rejects.toThrow(InternalServerErrorException);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  test('test_resolveActiveClassSession_queriesByTenantPersonAndServerCurrentTimeWindow', async () => {
    const { service, manager } = buildService();
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    await service.submit(personId, dto);

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_group_enrollment'), [
      'tenant-a-id',
      personId,
      serverNowIso,
    ]);
  });

  // Security/code-review finding + user decision (2026-08-22): no tolerance —
  // check-in resolution must be driven exclusively by the server's own clock,
  // never by anything the client sends. AppCheckinDto no longer even exposes
  // a capturedAt field, but this test goes further and simulates a
  // maliciously-crafted request body (as if validation/whitelisting were
  // somehow bypassed) carrying an implausible timestamp, to prove the extra
  // property has zero effect: resolution is still keyed off the injected
  // server clock (jest fake timers), not the request body.
  test('test_submit_clientSuppliedTimestampInRequestBody_hasNoEffectOnSessionResolution', async () => {
    const { service, manager } = buildService();
    mockClassSessionRows(manager, [{ id: 'session-1' }]);
    const dtoWithSmuggledCapturedAt = {
      ...dto,
      capturedAt: '1970-01-01T00:00:00.000Z', // implausible far-past value
    } as unknown as AppCheckinDto;

    await service.submit(personId, dtoWithSmuggledCapturedAt);

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_group_enrollment'), [
      'tenant-a-id',
      personId,
      serverNowIso,
    ]);
  });

  test('test_submit_offlineQueuedCheckinDeliveredAfterSessionEnded_stillResolvesAgainstServerNowAndFailsWithNoActiveSession', async () => {
    // Accepted consequence of the fix (explicitly not a bug): a check-in
    // that only reaches the server after its class session's window has
    // passed now legitimately gets "no active session", because resolution
    // never looks at when the client claims the tap happened.
    const { service, manager, queue } = buildService();
    mockClassSessionRows(manager, []); // no session's window contains server-now

    await expect(service.submit(personId, dto)).rejects.toThrow(UnprocessableEntityException);
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });
});
