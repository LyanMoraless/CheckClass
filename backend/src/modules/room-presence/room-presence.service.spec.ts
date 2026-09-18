import {
  AttendanceFactorTypeEntity,
  ClassSessionEntity,
  IdentificationCheckinEntity,
  RawLocationSignalEntity,
  RoomPresenceEventEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockInsertQueryBuilder,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { LocationVerificationService } from '../location-verification/location-verification.service';
import { RoomPresenceService } from './room-presence.service';

// RULE-PRES-04/05/06/07/08 (attendance-presence-flow-rules.md). Structural
// precedent: device-binding — a dedicated read primitive owning its own
// state, never written to by identification_checkin's own pipeline.
describe('RoomPresenceService', () => {
  function buildService(options: {
    checkinRepo?: MockRepository;
    factorTypeRepo?: MockRepository;
    roomPresenceEventRepo?: MockRepository;
    classSessionRepo?: MockRepository;
    rawLocationSignalRepo?: MockRepository;
    locationVerificationService?: Partial<LocationVerificationService>;
    insertedId?: string | null;
  } = {}) {
    const checkinRepo = options.checkinRepo ?? createMockRepository();
    const factorTypeRepo = options.factorTypeRepo ?? createMockRepository();
    const roomPresenceEventRepo = options.roomPresenceEventRepo ?? createMockRepository();
    const classSessionRepo = options.classSessionRepo ?? createMockRepository();
    const rawLocationSignalRepo = options.rawLocationSignalRepo ?? createMockRepository({ findOne: jest.fn().mockResolvedValue(null) });

    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([
        [IdentificationCheckinEntity, checkinRepo],
        [AttendanceFactorTypeEntity, factorTypeRepo],
        [RoomPresenceEventEntity, roomPresenceEventRepo],
        [ClassSessionEntity, classSessionRepo],
        [RawLocationSignalEntity, rawLocationSignalRepo],
      ]),
    );
    const insertedId = 'insertedId' in options ? options.insertedId ?? null : 'room-presence-event-1';
    manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(insertedId));

    const tenantContext = createMockTenantContext(manager);
    const locationVerificationService = {
      evaluateDepartureFromClassLocation: jest.fn(),
      ...options.locationVerificationService,
    } as unknown as LocationVerificationService;

    const service = new RoomPresenceService(tenantContext as never, locationVerificationService);
    return { service, manager, checkinRepo, factorTypeRepo, roomPresenceEventRepo, classSessionRepo, rawLocationSignalRepo, locationVerificationService };
  }

  describe('recordFromCheckin', () => {
    const baseCheckin = {
      id: 'checkin-1',
      tenantId: 'tenant-a-id',
      personId: 'person-1',
      classSessionId: 'session-1',
      attendanceFactorTypeId: 'factor-room-entry',
      checkinAt: new Date('2026-08-21T10:00:00.000Z'),
      isDuplicate: false,
    };

    test('test_recordFromCheckin_checkinNotFound_doesNothing', async () => {
      const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, manager } = buildService({ checkinRepo });

      await service.recordFromCheckin('missing-checkin');

      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    test('test_recordFromCheckin_checkinIsDuplicate_doesNotRecord', async () => {
      const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ ...baseCheckin, isDuplicate: true }) });
      const { service, manager } = buildService({ checkinRepo });

      await service.recordFromCheckin(baseCheckin.id);

      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    test('test_recordFromCheckin_checkinHasNoClassSession_doesNotRecord', async () => {
      const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ ...baseCheckin, classSessionId: null }) });
      const { service, manager } = buildService({ checkinRepo });

      await service.recordFromCheckin(baseCheckin.id);

      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    test('test_recordFromCheckin_factorIsNotRoomEntryOrExit_doesNotRecord', async () => {
      const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(baseCheckin) });
      const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-facial', code: 'FACIAL_CHECKIN' }) });
      const { service, manager } = buildService({ checkinRepo, factorTypeRepo });

      await service.recordFromCheckin(baseCheckin.id);

      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    test('test_recordFromCheckin_roomEntryFactor_insertsEntryDirection', async () => {
      const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(baseCheckin) });
      const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-room-entry', code: 'ROOM_ENTRY' }) });
      const { service, manager } = buildService({ checkinRepo, factorTypeRepo });

      await service.recordFromCheckin(baseCheckin.id);

      const insertBuilder = manager.createQueryBuilder.mock.results[0].value;
      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-a-id',
          personId: 'person-1',
          classSessionId: 'session-1',
          direction: 'entry',
          identificationCheckinId: 'checkin-1',
          occurredAt: baseCheckin.checkinAt,
        }),
      );
      expect(insertBuilder.orIgnore).toHaveBeenCalled();
    });

    test('test_recordFromCheckin_roomExitFactor_insertsExitDirection', async () => {
      const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(baseCheckin) });
      const factorTypeRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'factor-room-exit', code: 'ROOM_EXIT' }) });
      const { service, manager } = buildService({ checkinRepo, factorTypeRepo });

      await service.recordFromCheckin(baseCheckin.id);

      const insertBuilder = manager.createQueryBuilder.mock.results[0].value;
      expect(insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({ direction: 'exit' }));
    });
  });

  describe('isPresentForSession', () => {
    test('test_isPresentForSession_atLeastOneEntryRow_returnsTrue', async () => {
      const roomPresenceEventRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.isPresentForSession('person-1', 'session-1');

      expect(result).toBe(true);
      expect(roomPresenceEventRepo.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-a-id', personId: 'person-1', classSessionId: 'session-1', direction: 'entry' },
      });
    });

    test('test_isPresentForSession_noEntryRow_returnsFalse', async () => {
      const roomPresenceEventRepo = createMockRepository({ count: jest.fn().mockResolvedValue(0) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.isPresentForSession('person-1', 'session-1');

      expect(result).toBe(false);
    });
  });

  describe('countActiveInRoom', () => {
    test('test_countActiveInRoom_queriesLatestDirectionPerPerson_returnsCount', async () => {
      const { service, manager } = buildService();
      manager.query.mockResolvedValueOnce([{ count: '3' }]);

      const asOf = new Date('2026-09-17T10:15:00.000Z');
      const result = await service.countActiveInRoom('session-1', asOf);

      expect(result).toBe(3);
      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('DISTINCT ON (person_id)'), [
        'tenant-a-id',
        'session-1',
        asOf.toISOString(),
      ]);
    });

    test('test_countActiveInRoom_defaultsAsOfToNow_stillReturnsCount', async () => {
      const { service, manager } = buildService();
      manager.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.countActiveInRoom('session-1');

      expect(result).toBe(0);
      expect(manager.query).toHaveBeenCalled();
    });
  });

  describe('getSessionProjectedInterval', () => {
    const entryRow = (iso: string) => ({ direction: 'entry', occurredAt: new Date(iso) });
    const exitRow = (iso: string) => ({ direction: 'exit', occurredAt: new Date(iso) });

    test('test_getSessionProjectedInterval_matchedEntryExit_returnsClosedInterval', async () => {
      const rows = [entryRow('2026-08-21T10:00:00.000Z'), exitRow('2026-08-21T10:20:00.000Z')];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result).toEqual({
        closedIntervals: [{ entryAt: rows[0].occurredAt, exitAt: rows[1].occurredAt }],
        hasOpenInterval: false,
        openIntervalEntryAt: null,
      });
    });

    test('test_getSessionProjectedInterval_multipleEntryExitPairs_sumsAsDistinctIntervals', async () => {
      const rows = [
        entryRow('2026-08-21T10:00:00.000Z'),
        exitRow('2026-08-21T10:20:00.000Z'),
        entryRow('2026-08-21T10:30:00.000Z'),
        exitRow('2026-08-21T11:00:00.000Z'),
      ];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result.closedIntervals).toHaveLength(2);
      expect(result.hasOpenInterval).toBe(false);
    });

    test('test_getSessionProjectedInterval_unmatchedExitWithNoPrecedingEntry_isIgnored', async () => {
      const rows = [exitRow('2026-08-21T09:00:00.000Z'), entryRow('2026-08-21T10:00:00.000Z'), exitRow('2026-08-21T10:20:00.000Z')];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result.closedIntervals).toHaveLength(1);
      expect(result.closedIntervals[0]).toEqual({ entryAt: rows[1].occurredAt, exitAt: rows[2].occurredAt });
    });

    // RULE-PRES-08 priority 1: tag-out already covered by the matched-pair
    // case above (a present exit row closes the interval directly, no
    // precedence needed). The tests below cover priority 2/3 — no exit row
    // at all.

    test('test_getSessionProjectedInterval_noExitButProlongedDepartureDetected_closesAtDepartureStartedAt', async () => {
      // RULE-PRES-08 priority 2: no tag-out, but location-verification
      // detects a sustained departure — closes the interval at
      // departureStartedAt instead of leaving it open.
      const openEntryAt = new Date('2026-08-21T10:00:00.000Z');
      const rows = [entryRow('2026-08-21T10:00:00.000Z')];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const scheduledEnd = new Date('2026-08-21T12:00:00.000Z');
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'session-1', scheduledEnd }) });
      const latestReadingCapturedAt = new Date('2026-08-21T11:00:00.000Z');
      const rawLocationSignalRepo = createMockRepository({
        findOne: jest.fn().mockResolvedValue({ latitude: '-23.571', longitude: '-46.655', capturedAt: latestReadingCapturedAt }),
      });
      const departureStartedAt = new Date('2026-08-21T11:40:00.000Z');
      const locationVerificationService = {
        evaluateDepartureFromClassLocation: jest.fn().mockResolvedValue({
          isWithinRadius: false,
          departureStartedAt,
          departureMinutesElapsed: 20,
          departureTimeoutMinutes: 15,
          prolongedDepartureDetected: true,
        }),
      };
      const { service, classSessionRepo: sessionRepo } = buildService({
        roomPresenceEventRepo,
        classSessionRepo,
        rawLocationSignalRepo,
        locationVerificationService,
      });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result).toEqual({
        closedIntervals: [{ entryAt: openEntryAt, exitAt: departureStartedAt }],
        hasOpenInterval: false,
        openIntervalEntryAt: null,
      });
      expect(locationVerificationService.evaluateDepartureFromClassLocation).toHaveBeenCalledWith(
        'tenant-a-id',
        'person-1',
        'session-1',
        { latitude: -23.571, longitude: -46.655 },
        scheduledEnd,
      );
      expect(sessionRepo.findOneBy).toHaveBeenCalledWith({ id: 'session-1', tenantId: 'tenant-a-id' });
    });

    test('test_getSessionProjectedInterval_noExitAndNoLocationSignalHistory_staysOpen', async () => {
      // RULE-PRES-08 priority 3: neither tag-out nor a usable location
      // signal exists — stays open (missing_exit pending review is
      // AttendanceRulesEngineService's job, unchanged).
      const rows = [entryRow('2026-08-21T10:00:00.000Z')];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'session-1', scheduledEnd: new Date() }) });
      const rawLocationSignalRepo = createMockRepository({ findOne: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ roomPresenceEventRepo, classSessionRepo, rawLocationSignalRepo });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result).toEqual({ closedIntervals: [], hasOpenInterval: true, openIntervalEntryAt: rows[0].occurredAt });
    });

    test('test_getSessionProjectedInterval_departureDetectedButNotProlonged_staysOpen', async () => {
      const rows = [entryRow('2026-08-21T10:00:00.000Z')];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'session-1', scheduledEnd: new Date() }) });
      const rawLocationSignalRepo = createMockRepository({
        findOne: jest.fn().mockResolvedValue({ latitude: '-23.571', longitude: '-46.655', capturedAt: new Date() }),
      });
      const locationVerificationService = {
        evaluateDepartureFromClassLocation: jest.fn().mockResolvedValue({
          isWithinRadius: false,
          departureStartedAt: new Date(),
          departureMinutesElapsed: 5,
          departureTimeoutMinutes: 15,
          prolongedDepartureDetected: false,
        }),
      };
      const { service } = buildService({ roomPresenceEventRepo, classSessionRepo, rawLocationSignalRepo, locationVerificationService });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result.hasOpenInterval).toBe(true);
    });

    test('test_getSessionProjectedInterval_noCheckinsAtAll_returnsEmptyClosed', async () => {
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result).toEqual({ closedIntervals: [], hasOpenInterval: false, openIntervalEntryAt: null });
    });

    // Edge case not previously covered: two consecutive ROOM_ENTRY rows with
    // no ROOM_EXIT between them (device/dedup anomaly — a second tag-in
    // before the first was ever closed out). The service logs a warning and
    // treats the LATER entry as the active one; the earlier entry is
    // silently dropped rather than producing a spurious extra interval.
    test('test_getSessionProjectedInterval_twoConsecutiveEntriesWithNoExitBetween_treatsLaterEntryAsActive', async () => {
      const firstEntryAt = new Date('2026-08-21T10:00:00.000Z');
      const secondEntryAt = new Date('2026-08-21T10:05:00.000Z');
      const exitAt = new Date('2026-08-21T10:20:00.000Z');
      const rows = [entryRow(firstEntryAt.toISOString()), entryRow(secondEntryAt.toISOString()), exitRow(exitAt.toISOString())];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result).toEqual({
        closedIntervals: [{ entryAt: secondEntryAt, exitAt }],
        hasOpenInterval: false,
        openIntervalEntryAt: null,
      });
    });

    // Two ROOM_EXIT rows in a row with nothing to pair the second one with —
    // both are unmatched-exit cases (the first pairs correctly, the trailing
    // one has no preceding open entry) and must both be ignored rather than
    // throwing or fabricating a negative-length interval.
    test('test_getSessionProjectedInterval_twoConsecutiveUnmatchedExits_bothIgnoredAfterThePairedOne', async () => {
      const entryAt = new Date('2026-08-21T10:00:00.000Z');
      const firstExitAt = new Date('2026-08-21T10:20:00.000Z');
      const secondExitAt = new Date('2026-08-21T10:25:00.000Z');
      const rows = [entryRow(entryAt.toISOString()), exitRow(firstExitAt.toISOString()), exitRow(secondExitAt.toISOString())];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const { service } = buildService({ roomPresenceEventRepo });

      const result = await service.getSessionProjectedInterval('person-1', 'session-1');

      expect(result.closedIntervals).toEqual([{ entryAt, exitAt: firstExitAt }]);
      expect(result.hasOpenInterval).toBe(false);
    });

    // RULE-PRES-08 priority 2's second leg (explicit app logout) has no
    // backend signal yet — resolveExplicitLogoutAt is hardcoded to return
    // null (see that method's own comment, a documented gap, not a bug).
    // This test pins that behavior down explicitly: an open interval with no
    // tag-out ALWAYS falls through to the location-departure check, never
    // short-circuits on a logout signal that doesn't exist. If a real logout
    // signal is ever wired in, this test should start failing and needs to
    // be revisited alongside it.
    test('test_getSessionProjectedInterval_noExitRow_alwaysEvaluatesLocationDepartureNeverAnExplicitLogoutSignal', async () => {
      const rows = [entryRow('2026-08-21T10:00:00.000Z')];
      const roomPresenceEventRepo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'session-1', scheduledEnd: new Date() }) });
      const rawLocationSignalRepo = createMockRepository({ findOne: jest.fn().mockResolvedValue(null) });
      const { service, locationVerificationService } = buildService({ roomPresenceEventRepo, classSessionRepo, rawLocationSignalRepo });

      await service.getSessionProjectedInterval('person-1', 'session-1');

      // No location signal history at all AND no logout signal exists (gap):
      // evaluateDepartureFromClassLocation is never even reached in this
      // specific case (no reading to evaluate — see resolveDepartureExitAt's
      // own early return), which is itself proof no logout short-circuit
      // fired first to close the interval a different way.
      expect(locationVerificationService.evaluateDepartureFromClassLocation).not.toHaveBeenCalled();
    });
  });
});
