import { NotFoundException } from '@nestjs/common';
import { ClassSessionEntity, InstitutionalLocationConfigEntity, RawLocationSignalEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { LocationVerificationService } from './location-verification.service';

// RULE-PRES-01(b)/RULE-PRES-09 — "Decisão de arquitetura — Fluxo de Chamada
// Redesenhado" (architecture-overview.md). Reference point used throughout:
// institution at (-23.561, -46.655), radius 50m (RULE-PRES-01/09's
// reference value). "far" coordinates below (~0.01deg offset, ~1.1km) are
// comfortably outside that radius; "same" coordinates are the reference
// point itself (distance 0, always inside).
describe('LocationVerificationService', () => {
  const REFERENCE = { latitude: -23.561, longitude: -46.655 };
  const INSIDE = { latitude: -23.561, longitude: -46.655 };
  const FAR_OUTSIDE = { latitude: -23.571, longitude: -46.655 };

  function buildService(options: {
    configRepo?: MockRepository;
    classSessionRepo?: MockRepository;
    rawLocationSignalRepo?: MockRepository;
  } = {}) {
    const configRepo =
      options.configRepo ??
      createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ ...REFERENCE, radiusMeters: 50 }) });
    const classSessionRepo =
      options.classSessionRepo ??
      createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'session-1', departureTimeoutMinutesSnapshot: 15 }) });
    const rawLocationSignalRepo = options.rawLocationSignalRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue([]) });

    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([
        [InstitutionalLocationConfigEntity, configRepo],
        [ClassSessionEntity, classSessionRepo],
        [RawLocationSignalEntity, rawLocationSignalRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const service = new LocationVerificationService(tenantContext as never);
    return { service, configRepo, classSessionRepo, rawLocationSignalRepo };
  }

  describe('isWithinInstitutionalRadius', () => {
    test('test_isWithinInstitutionalRadius_tenantHasNoConfig_returnsFalse', async () => {
      const configRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ configRepo });

      const result = await service.isWithinInstitutionalRadius('tenant-a-id', INSIDE);

      expect(result).toBe(false);
      expect(configRepo.findOneBy).toHaveBeenCalledWith({ tenantId: 'tenant-a-id' });
    });

    test('test_isWithinInstitutionalRadius_coordinateInsideRadius_returnsTrue', async () => {
      const { service } = buildService();

      const result = await service.isWithinInstitutionalRadius('tenant-a-id', INSIDE);

      expect(result).toBe(true);
    });

    test('test_isWithinInstitutionalRadius_coordinateOutsideRadius_returnsFalse', async () => {
      const { service } = buildService();

      const result = await service.isWithinInstitutionalRadius('tenant-a-id', FAR_OUTSIDE);

      expect(result).toBe(false);
    });
  });

  describe('evaluateDepartureFromClassLocation', () => {
    test('test_evaluateDepartureFromClassLocation_classSessionDoesNotExist_throwsNotFound', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ classSessionRepo });

      await expect(service.evaluateDepartureFromClassLocation('tenant-a-id', 'person-1', 'session-missing', INSIDE)).rejects.toThrow(
        NotFoundException,
      );
    });

    test('test_evaluateDepartureFromClassLocation_currentlyWithinRadius_reportsNoDeparture', async () => {
      const { service } = buildService();

      const result = await service.evaluateDepartureFromClassLocation('tenant-a-id', 'person-1', 'session-1', INSIDE);

      expect(result).toEqual({
        isWithinRadius: true,
        departureStartedAt: null,
        departureMinutesElapsed: 0,
        departureTimeoutMinutes: 15,
        prolongedDepartureDetected: false,
      });
    });

    test('test_evaluateDepartureFromClassLocation_outsideRadiusNoHistory_departureJustStartedNotProlonged', async () => {
      const rawLocationSignalRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { service } = buildService({ rawLocationSignalRepo });

      const result = await service.evaluateDepartureFromClassLocation('tenant-a-id', 'person-1', 'session-1', FAR_OUTSIDE);

      expect(result.isWithinRadius).toBe(false);
      expect(result.prolongedDepartureDetected).toBe(false);
      expect(result.departureMinutesElapsed).toBeLessThan(1);
      expect(result.departureStartedAt).toBeInstanceOf(Date);
    });

    test('test_evaluateDepartureFromClassLocation_continuousOutsideHistoryPastTimeout_prolongedDepartureDetected', async () => {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60000);
      const rawLocationSignalRepo = createMockRepository({
        find: jest.fn().mockResolvedValue([{ ...FAR_OUTSIDE, capturedAt: twentyMinutesAgo }]),
      });
      const { service } = buildService({ rawLocationSignalRepo });

      const result = await service.evaluateDepartureFromClassLocation('tenant-a-id', 'person-1', 'session-1', FAR_OUTSIDE);

      expect(result.isWithinRadius).toBe(false);
      expect(result.departureStartedAt).toEqual(twentyMinutesAgo);
      expect(result.departureMinutesElapsed).toBeGreaterThanOrEqual(15);
      expect(result.prolongedDepartureDetected).toBe(true);
    });

    test('test_evaluateDepartureFromClassLocation_continuousOutsideHistoryUnderTimeout_notProlonged', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
      const rawLocationSignalRepo = createMockRepository({
        find: jest.fn().mockResolvedValue([{ ...FAR_OUTSIDE, capturedAt: fiveMinutesAgo }]),
      });
      const { service } = buildService({ rawLocationSignalRepo });

      const result = await service.evaluateDepartureFromClassLocation('tenant-a-id', 'person-1', 'session-1', FAR_OUTSIDE);

      expect(result.departureStartedAt).toEqual(fiveMinutesAgo);
      expect(result.prolongedDepartureDetected).toBe(false);
    });

    // History (most recent first): still-outside reading at T2, then a
    // WITHIN-radius reading at T1 (the moment the student last returned) —
    // the continuous departure only started right after T1, at T2, not at
    // T1 itself and not at any reading further back.
    test('test_evaluateDepartureFromClassLocation_historyShowsAReturnBeforeTheCurrentDeparture_startsCountingFromAfterTheReturn', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60000);
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60000);
      const rawLocationSignalRepo = createMockRepository({
        find: jest.fn().mockResolvedValue([
          { ...FAR_OUTSIDE, capturedAt: tenMinutesAgo },
          { ...INSIDE, capturedAt: twentyMinutesAgo },
        ]),
      });
      const { service } = buildService({ rawLocationSignalRepo });

      const result = await service.evaluateDepartureFromClassLocation('tenant-a-id', 'person-1', 'session-1', FAR_OUTSIDE);

      expect(result.departureStartedAt).toEqual(tenMinutesAgo);
      expect(result.prolongedDepartureDetected).toBe(false);
    });

    // room-presence's retroactive caller (getSessionProjectedInterval,
    // RULE-PRES-08) passes the session's own scheduledEnd here instead of
    // relying on the default "now" — otherwise a departure evaluated long
    // after class ended would read as far more "elapsed" than it actually
    // was during the session itself.
    test('test_evaluateDepartureFromClassLocation_asOfDateProvided_computesElapsedRelativeToItInsteadOfNow', async () => {
      const tenMinutesBeforeAsOf = new Date('2026-08-21T11:50:00.000Z');
      const asOfDate = new Date('2026-08-21T12:00:00.000Z'); // session's own scheduledEnd
      const rawLocationSignalRepo = createMockRepository({
        find: jest.fn().mockResolvedValue([{ ...FAR_OUTSIDE, capturedAt: tenMinutesBeforeAsOf }]),
      });
      const { service } = buildService({ rawLocationSignalRepo });

      const result = await service.evaluateDepartureFromClassLocation(
        'tenant-a-id',
        'person-1',
        'session-1',
        FAR_OUTSIDE,
        asOfDate,
      );

      // 10 minutes elapsed as of asOfDate — under the 15-minute threshold —
      // even though real wall-clock "now" (when this test actually runs) is
      // long after 2026-08-21.
      expect(result.departureMinutesElapsed).toBeCloseTo(10, 5);
      expect(result.prolongedDepartureDetected).toBe(false);
    });

    test('test_evaluateDepartureFromClassLocation_readsHistoryScopedToPersonSessionAndClassMonitoringSignalType', async () => {
      const rawLocationSignalRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { service } = buildService({ rawLocationSignalRepo });

      await service.evaluateDepartureFromClassLocation('tenant-a-id', 'person-1', 'session-1', FAR_OUTSIDE);

      expect(rawLocationSignalRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-a-id', personId: 'person-1', classSessionId: 'session-1', signalType: 'class_monitoring' },
        order: { capturedAt: 'DESC' },
      });
    });
  });
});
