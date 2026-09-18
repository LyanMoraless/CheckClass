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
  // RULE-PRES-01(b): every scenario below that exercises the full pipeline
  // (network+geo+consent all passing, mocked in buildService's defaults)
  // needs coordinates present — the service treats their absence as a
  // failed geo gate regardless of what isWithinInstitutionalRadius would
  // have returned (see AppCheckinDto's own comment on why they're optional
  // at the wire level but functionally required for this path). The
  // dedicated "no coordinates" gate test below overrides this.
  const dto: AppCheckinDto = { idempotencyKey: 'idem-key-1', latitude: -23.561, longitude: -46.655 };
  const personId = 'person-1';
  const serverNowIso = '2026-08-22T10:00:00.000Z';

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(serverNowIso));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sourceIp = '198.51.100.9';

  function buildService(
    options: {
      factorTypeRepo?: MockRepository;
      insertedId?: string | null;
      withinNetwork?: boolean;
      withinRadius?: boolean;
      hasLocationConsent?: boolean;
    } = {},
  ) {
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
    const institutionalNetworkService = {
      isWithinInstitutionalNetwork: jest.fn().mockResolvedValue(options.withinNetwork ?? true),
    };
    const locationVerificationService = {
      isWithinInstitutionalRadius: jest.fn().mockResolvedValue(options.withinRadius ?? true),
    };
    const locationConsentService = {
      hasActiveConsent: jest.fn().mockResolvedValue(options.hasLocationConsent ?? true),
    };
    const service = new AppCheckinService(
      tenantContext as never,
      queue as never,
      institutionalNetworkService as never,
      locationVerificationService as never,
      locationConsentService as never,
    );
    return {
      service,
      manager,
      factorTypeRepo,
      rawEventRepo,
      queue,
      institutionalNetworkService,
      locationVerificationService,
      locationConsentService,
    };
  }

  function mockClassSessionRows(manager: MockEntityManager, rows: Array<{ id: string }>) {
    manager.query.mockResolvedValue(rows);
  }

  test('test_submit_singleActiveSessionFound_insertsRawEventAndEnqueuesIdentification', async () => {
    const { service, manager, queue } = buildService();
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    const result = await service.submit(personId, dto, sourceIp);

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

    await expect(service.submit(personId, dto, sourceIp)).rejects.toThrow(UnprocessableEntityException);

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  test('test_submit_overlappingActiveSessions_throwsUnprocessableEntityStopgapWithoutGuessing', async () => {
    // Gap — "Sobreposição de turmas simultâneas no check-in via app": not
    // confirmed, so this must reject rather than pick "first found"/"both".
    const { service, manager, queue } = buildService();
    mockClassSessionRows(manager, [{ id: 'session-1' }, { id: 'session-2' }]);

    await expect(service.submit(personId, dto, sourceIp)).rejects.toThrow(UnprocessableEntityException);

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

    const result = await service.submit(personId, dto, sourceIp);

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

    await expect(service.submit(personId, dto, sourceIp)).rejects.toThrow(InternalServerErrorException);
  });

  test('test_submit_appCheckinFactorTypeNotSeeded_throwsInternalServerErrorWithoutInserting', async () => {
    const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service, manager, queue } = buildService({ factorTypeRepo });
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    await expect(service.submit(personId, dto, sourceIp)).rejects.toThrow(InternalServerErrorException);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  test('test_resolveActiveClassSession_queriesByTenantPersonAndServerCurrentTimeWindow', async () => {
    const { service, manager } = buildService();
    mockClassSessionRows(manager, [{ id: 'session-1' }]);

    await service.submit(personId, dto, sourceIp);

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

    await service.submit(personId, dtoWithSmuggledCapturedAt, sourceIp);

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

    await expect(service.submit(personId, dto, sourceIp)).rejects.toThrow(UnprocessableEntityException);
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  // RULE-PRES-01/14 ("Decisão de arquitetura — Fluxo de Chamada
  // Redesenhado", architecture-overview.md's "Implementação — room-presence
  // e integração dos três gates"): consent (routing, checked first,
  // independently), network + geo (AND estrito). All three reuse the same
  // created:false/eventId:null shape as the idempotency-duplicate path so
  // the endpoint always still responds 200 OK (AppCheckinController's
  // existing `created ? 201 : 200`), never a 4xx/5xx — RULE-PRES-01's own
  // "login é permitido normalmente" / "sem trilha de auditoria".
  describe('RULE-PRES-01/14 three-gate check', () => {
    test('test_submit_noActiveLocationConsent_returnsWithoutInsertingAndNeverChecksNetworkOrGeo', async () => {
      // RULE-PRES-14/15: routing decision, not a gate failure — network/geo
      // are never even evaluated for this caller (caminho alternativo).
      const { service, manager, queue, institutionalNetworkService, locationVerificationService } = buildService({
        hasLocationConsent: false,
      });

      const result = await service.submit(personId, dto, sourceIp);

      expect(result).toEqual({ created: false, eventId: null });
      expect(institutionalNetworkService.isWithinInstitutionalNetwork).not.toHaveBeenCalled();
      expect(locationVerificationService.isWithinInstitutionalRadius).not.toHaveBeenCalled();
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(queue.sendWithManager).not.toHaveBeenCalled();
    });

    test('test_submit_outsideInstitutionalNetwork_returnsSuccessWithoutInsertingOrEnqueuing', async () => {
      const { service, manager, queue } = buildService({ withinNetwork: false });

      const result = await service.submit(personId, dto, sourceIp);

      expect(result).toEqual({ created: false, eventId: null });
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(queue.sendWithManager).not.toHaveBeenCalled();
    });

    test('test_submit_outsideInstitutionalRadius_returnsSuccessWithoutInsertingOrEnqueuing', async () => {
      const { service, manager, queue } = buildService({ withinRadius: false });

      const result = await service.submit(personId, dto, sourceIp);

      expect(result).toEqual({ created: false, eventId: null });
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(queue.sendWithManager).not.toHaveBeenCalled();
    });

    test('test_submit_bothNetworkAndRadiusFail_returnsSuccessWithoutInsertingOrEnqueuing', async () => {
      // Both anti-fraud legs failing at once (student neither on the
      // institutional network nor within the geographic radius) must take
      // the exact same silent-success path as either failing alone — no
      // special-cased behavior for the "fails both" combination.
      const { service, manager, queue } = buildService({ withinNetwork: false, withinRadius: false });

      const result = await service.submit(personId, dto, sourceIp);

      expect(result).toEqual({ created: false, eventId: null });
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(queue.sendWithManager).not.toHaveBeenCalled();
    });

    test('test_submit_coordinatesAbsentFromDto_treatedAsFailedGeoGateWithoutCallingLocationVerification', async () => {
      // RULE-PRES-15's caminho alternativo caller legitimately omits
      // coordinates (see AppCheckinDto's own comment) — but that path is
      // already routed away by the consent gate above. A caller WITH active
      // consent who nonetheless sends no coordinates must still fail-closed,
      // never silently skip the geo check.
      const dtoWithoutCoordinates = { idempotencyKey: 'idem-key-1' } as AppCheckinDto;
      const { service, manager, locationVerificationService } = buildService();

      const result = await service.submit(personId, dtoWithoutCoordinates, sourceIp);

      expect(result).toEqual({ created: false, eventId: null });
      expect(locationVerificationService.isWithinInstitutionalRadius).not.toHaveBeenCalled();
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    test('test_submit_allThreeGatesPass_proceedsToExistingPipeline', async () => {
      const { service, manager, institutionalNetworkService, locationVerificationService, locationConsentService } = buildService();
      mockClassSessionRows(manager, [{ id: 'session-1' }]);

      const result = await service.submit(personId, dto, sourceIp);

      expect(result).toEqual({ created: true, eventId: 'raw-event-1' });
      expect(locationConsentService.hasActiveConsent).toHaveBeenCalledWith(personId);
      expect(institutionalNetworkService.isWithinInstitutionalNetwork).toHaveBeenCalledWith('tenant-a-id', sourceIp);
      expect(locationVerificationService.isWithinInstitutionalRadius).toHaveBeenCalledWith('tenant-a-id', {
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
    });
  });
});
