import { InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';
import { RawLocationSignalEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockInsertQueryBuilder,
  createMockRepository,
  createMockTenantContext,
  MockEntityManager,
} from '../../../test/unit/support/mock-entity-manager';
import { ClassMonitoringSignalService } from './class-monitoring-signal.service';
import { ReportClassMonitoringSignalDto } from './dto/report-class-monitoring-signal.dto';

// RULE-PRES-09: server clock only for raw_location_signal.captured_at, never
// anything client-supplied — every test runs under fake timers with a fixed
// system time so assertions about "what timestamp was used" are exact.
describe('ClassMonitoringSignalService', () => {
  const personId = 'person-1';
  const serverNowIso = '2026-09-17T10:00:00.000Z';
  const dto: ReportClassMonitoringSignalDto = {
    idempotencyKey: 'idem-key-1',
    classSessionId: 'session-1',
    latitude: -23.561,
    longitude: -46.655,
    accuracyMeters: 12,
    isMocked: false,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(serverNowIso));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function buildService(options: { insertedId?: string | null } = {}) {
    const rawLocationSignalRepo = createMockRepository();
    const manager = createMockEntityManager(new Map([[RawLocationSignalEntity, rawLocationSignalRepo]]));
    const insertedId = 'insertedId' in options ? (options.insertedId ?? null) : 'signal-1';
    manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(insertedId));

    const tenantContext = createMockTenantContext(manager);
    const service = new ClassMonitoringSignalService(tenantContext as never);
    return { service, manager, rawLocationSignalRepo };
  }

  function mockEnrolledInProgressSessionRows(manager: MockEntityManager, rows: Array<{ id: string }>) {
    manager.query.mockResolvedValue(rows);
  }

  test('test_report_enrolledSessionInProgress_insertsClassMonitoringSignal', async () => {
    const { service, manager } = buildService();
    mockEnrolledInProgressSessionRows(manager, [{ id: 'session-1' }]);

    const result = await service.report(personId, dto);

    expect(result).toEqual({ created: true, signalId: 'signal-1' });
    const insertBuilder = manager.createQueryBuilder.mock.results[0].value;
    expect(insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a-id',
        signalType: 'class_monitoring',
        classSessionId: 'session-1',
        rawIdentificationEventId: null,
        personId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
        isMocked: dto.isMocked,
        capturedAt: new Date(serverNowIso),
        idempotencyKey: dto.idempotencyKey,
      }),
    );
  });

  test('test_report_queriesByTenantPersonSessionAndServerCurrentTimeWindow', async () => {
    const { service, manager } = buildService();
    mockEnrolledInProgressSessionRows(manager, [{ id: 'session-1' }]);

    await service.report(personId, dto);

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_group_enrollment'), [
      'tenant-a-id',
      personId,
      dto.classSessionId,
      serverNowIso,
    ]);
  });

  test('test_report_sessionNotEnrolledOrNotInProgress_throwsUnprocessableEntityWithoutInserting', async () => {
    const { service, manager } = buildService();
    mockEnrolledInProgressSessionRows(manager, []);

    await expect(service.report(personId, dto)).rejects.toThrow(UnprocessableEntityException);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  // Security/code-review-style discipline mirrored from AppCheckinService: a
  // maliciously-crafted request carrying a smuggled capturedAt (as if
  // validation/whitelisting were somehow bypassed) must have zero effect —
  // resolution and persistence are still keyed off the server clock.
  test('test_report_clientSuppliedTimestampInRequestBody_hasNoEffectOnResolutionOrPersistence', async () => {
    const { service, manager } = buildService();
    mockEnrolledInProgressSessionRows(manager, [{ id: 'session-1' }]);
    const dtoWithSmuggledCapturedAt = {
      ...dto,
      capturedAt: '1970-01-01T00:00:00.000Z',
    } as unknown as ReportClassMonitoringSignalDto;

    await service.report(personId, dtoWithSmuggledCapturedAt);

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_group_enrollment'), [
      'tenant-a-id',
      personId,
      dto.classSessionId,
      serverNowIso,
    ]);
    const insertBuilder = manager.createQueryBuilder.mock.results[0].value;
    expect(insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({ capturedAt: new Date(serverNowIso) }));
  });

  test('test_report_idempotencyKeyAlreadyExistsForTenant_returnsExistingSignalWithoutInsertingAgain', async () => {
    const rawLocationSignalRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'existing-signal' }),
    });
    const { service, manager } = buildService({ insertedId: null });
    (manager.getRepository as jest.Mock).mockReturnValue(rawLocationSignalRepo);
    mockEnrolledInProgressSessionRows(manager, [{ id: 'session-1' }]);

    const result = await service.report(personId, dto);

    expect(result).toEqual({ created: false, signalId: 'existing-signal' });
    expect(rawLocationSignalRepo.findOneBy).toHaveBeenCalledWith({ idempotencyKey: dto.idempotencyKey });
  });

  test('test_report_idempotencyConflictButNoExistingRowFound_throwsInternalServerError', async () => {
    const rawLocationSignalRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service, manager } = buildService({ insertedId: null });
    (manager.getRepository as jest.Mock).mockReturnValue(rawLocationSignalRepo);
    mockEnrolledInProgressSessionRows(manager, [{ id: 'session-1' }]);

    await expect(service.report(personId, dto)).rejects.toThrow(InternalServerErrorException);
  });
});
