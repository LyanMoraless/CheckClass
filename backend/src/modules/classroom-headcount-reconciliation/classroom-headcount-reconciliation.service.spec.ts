import { NotFoundException } from '@nestjs/common';
import { ClassSessionEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { RoomPresenceService } from '../room-presence/room-presence.service';
import { ClassroomHeadcountReconciliationService } from './classroom-headcount-reconciliation.service';

// RULE-PRES-10/11/12 (Bloco 4). Every DB access this service makes goes
// through manager.query — plain SELECTs, no repository builder chains other
// than the single ClassSessionEntity lookup — so the fixture below drives
// manager.query.mockResolvedValueOnce(...) calls IN THE EXACT ORDER
// evaluateSession() issues them: (1) resolveEffectiveRoomId, (2)
// findRecentCameraReadings, then (3a) countAppCheckinSatisfiedAsOf and (3b)
// RoomPresenceService.countActiveInRoom (mocked directly, not via manager)
// PER window, in window order (most recent window first).
describe('ClassroomHeadcountReconciliationService', () => {
  const NOW = new Date('2026-09-17T10:20:00.000Z');

  function buildService(options: { classSessionRepo?: MockRepository; roomPresenceService?: Partial<RoomPresenceService> } = {}) {
    const classSessionRepo = options.classSessionRepo ?? createMockRepository();
    const manager = createMockEntityManager(new Map([[ClassSessionEntity, classSessionRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const roomPresenceService = {
      countActiveInRoom: jest.fn().mockResolvedValue(0),
      ...options.roomPresenceService,
    } as unknown as RoomPresenceService;

    const service = new ClassroomHeadcountReconciliationService(tenantContext as never, roomPresenceService);
    return { service, manager, classSessionRepo, roomPresenceService };
  }

  const inProgressSession = {
    id: 'session-1',
    tenantId: 'tenant-a-id',
    status: 'scheduled',
    scheduledStart: new Date('2026-09-17T10:00:00.000Z'),
    scheduledEnd: new Date('2026-09-17T12:00:00.000Z'),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('evaluateSession', () => {
    test('test_evaluateSession_sessionNotFound_throwsNotFound', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ classSessionRepo });

      await expect(service.evaluateSession('missing-session')).rejects.toBeInstanceOf(NotFoundException);
    });

    test('test_evaluateSession_sessionCancelled_isIgnored', async () => {
      const classSessionRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ ...inProgressSession, status: 'cancelled' }),
      });
      const { service, manager } = buildService({ classSessionRepo });

      const result = await service.evaluateSession('session-1');

      expect(result).toEqual({ classSessionId: 'session-1', inProgress: false, roomId: null, windows: [], alertActive: false });
      // Ignored BEFORE any room/camera/app-checkin/room-presence query — a
      // cancelled or not-yet-started/already-ended session gets no reads at
      // all beyond the one findOneBy above.
      expect(manager.query).not.toHaveBeenCalled();
    });

    test('test_evaluateSession_sessionNotYetStarted_isIgnored', async () => {
      const classSessionRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ ...inProgressSession, scheduledStart: new Date('2026-09-17T11:00:00.000Z') }),
      });
      const { service, manager } = buildService({ classSessionRepo });

      const result = await service.evaluateSession('session-1');

      expect(result.inProgress).toBe(false);
      expect(manager.query).not.toHaveBeenCalled();
    });

    test('test_evaluateSession_sessionAlreadyEnded_isIgnored', async () => {
      const classSessionRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ ...inProgressSession, scheduledEnd: new Date('2026-09-17T10:00:00.000Z') }),
      });
      const { service, manager } = buildService({ classSessionRepo });

      const result = await service.evaluateSession('session-1');

      expect(result.inProgress).toBe(false);
      expect(manager.query).not.toHaveBeenCalled();
    });

    test('test_evaluateSession_noEffectiveRoom_returnsNoWindows', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager } = buildService({ classSessionRepo });
      manager.query.mockResolvedValueOnce([{ roomId: null }]);

      const result = await service.evaluateSession('session-1');

      expect(result).toEqual({ classSessionId: 'session-1', inProgress: true, roomId: null, windows: [], alertActive: false });
    });

    test('test_evaluateSession_noCameraReadingYet_returnsEmptyWindowsNoAlert', async () => {
      // Session in progress, effective room resolved, but the camera hasn't
      // produced a single CAMERA_COUNT reading yet for this room/session
      // window — zero windows, not one, and definitely no alert.
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager } = buildService({ classSessionRepo });
      manager.query
        .mockResolvedValueOnce([{ roomId: 'room-1' }]) // resolveEffectiveRoomId
        .mockResolvedValueOnce([]); // findRecentCameraReadings — none yet

      const result = await service.evaluateSession('session-1');

      expect(result).toEqual({ classSessionId: 'session-1', inProgress: true, roomId: 'room-1', windows: [], alertActive: false });
    });

    test('test_evaluateSession_divergenceJustBelowThresholdWithAllThreeNumbersDifferent_noAlert', async () => {
      // RULE-PRES-11's threshold is >= 5; this pins the boundary just under
      // it (4) with all three numbers distinct from each other (camera 30,
      // app-checkin 34, room-presence 33 — max pairwise diff is |30-34|=4).
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager, roomPresenceService } = buildService({ classSessionRepo });
      const latest = new Date('2026-09-17T10:15:00.000Z');
      const previous = new Date('2026-09-17T10:00:00.000Z');
      manager.query
        .mockResolvedValueOnce([{ roomId: 'room-1' }])
        .mockResolvedValueOnce([
          { capturedAt: latest, count: 30 },
          { capturedAt: previous, count: 30 },
        ])
        .mockResolvedValueOnce([{ count: '34' }])
        .mockResolvedValueOnce([{ count: '34' }]);
      (roomPresenceService.countActiveInRoom as jest.Mock).mockResolvedValueOnce(33).mockResolvedValueOnce(33);

      const result = await service.evaluateSession('session-1');

      expect(result.windows[0].maxDivergence).toBe(4);
      expect(result.alertActive).toBe(false);
    });

    test('test_evaluateSession_onlyOneCameraReadingYet_notConfirmedNoAlert', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager, roomPresenceService } = buildService({ classSessionRepo });
      const readingAt = new Date('2026-09-17T10:15:00.000Z');
      manager.query
        .mockResolvedValueOnce([{ roomId: 'room-1' }]) // resolveEffectiveRoomId
        .mockResolvedValueOnce([{ capturedAt: readingAt, count: 30 }]) // findRecentCameraReadings — only 1 so far
        .mockResolvedValueOnce([{ count: '29' }]); // countAppCheckinSatisfiedAsOf for that one window
      (roomPresenceService.countActiveInRoom as jest.Mock).mockResolvedValueOnce(28);

      const result = await service.evaluateSession('session-1');

      expect(result.windows).toHaveLength(1);
      expect(result.windows[0]).toEqual({ capturedAt: readingAt, cameraCount: 30, appCheckinCount: 29, roomPresenceCount: 28, maxDivergence: 2 });
      expect(result.alertActive).toBe(false);
    });

    test('test_evaluateSession_divergenceBelowThresholdInBothWindows_noAlert', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager, roomPresenceService } = buildService({ classSessionRepo });
      const latest = new Date('2026-09-17T10:15:00.000Z');
      const previous = new Date('2026-09-17T10:00:00.000Z');
      manager.query
        .mockResolvedValueOnce([{ roomId: 'room-1' }])
        .mockResolvedValueOnce([
          { capturedAt: latest, count: 30 },
          { capturedAt: previous, count: 29 },
        ])
        .mockResolvedValueOnce([{ count: '31' }]) // app-checkin for latest window
        .mockResolvedValueOnce([{ count: '30' }]); // app-checkin for previous window
      (roomPresenceService.countActiveInRoom as jest.Mock)
        .mockResolvedValueOnce(29) // room-presence for latest window
        .mockResolvedValueOnce(28); // room-presence for previous window

      const result = await service.evaluateSession('session-1');

      expect(result.windows).toHaveLength(2);
      expect(result.windows.every((w) => w.maxDivergence < 5)).toBe(true);
      expect(result.alertActive).toBe(false);
    });

    test('test_evaluateSession_divergenceAtOrAboveThresholdInOnlyLatestWindow_notConfirmedNoAlert', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager, roomPresenceService } = buildService({ classSessionRepo });
      const latest = new Date('2026-09-17T10:15:00.000Z');
      const previous = new Date('2026-09-17T10:00:00.000Z');
      manager.query
        .mockResolvedValueOnce([{ roomId: 'room-1' }])
        .mockResolvedValueOnce([
          { capturedAt: latest, count: 30 },
          { capturedAt: previous, count: 29 },
        ])
        .mockResolvedValueOnce([{ count: '24' }]) // latest window: |30-24| = 6 >= 5
        .mockResolvedValueOnce([{ count: '29' }]); // previous window: no divergence
      (roomPresenceService.countActiveInRoom as jest.Mock)
        .mockResolvedValueOnce(25) // latest window room-presence
        .mockResolvedValueOnce(29); // previous window room-presence

      const result = await service.evaluateSession('session-1');

      expect(result.windows[0].maxDivergence).toBeGreaterThanOrEqual(5);
      expect(result.windows[1].maxDivergence).toBeLessThan(5);
      // RULE-PRES-11: a single confirmed window never alerts alone, however
      // large its own divergence.
      expect(result.alertActive).toBe(false);
    });

    test('test_evaluateSession_divergenceAtOrAboveThresholdInBothConsecutiveWindows_alerts', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager, roomPresenceService } = buildService({ classSessionRepo });
      const latest = new Date('2026-09-17T10:15:00.000Z');
      const previous = new Date('2026-09-17T10:00:00.000Z');
      manager.query
        .mockResolvedValueOnce([{ roomId: 'room-1' }])
        .mockResolvedValueOnce([
          { capturedAt: latest, count: 30 },
          { capturedAt: previous, count: 30 },
        ])
        .mockResolvedValueOnce([{ count: '25' }]) // latest: |30-25| = 5
        .mockResolvedValueOnce([{ count: '24' }]); // previous: |30-24| = 6
      (roomPresenceService.countActiveInRoom as jest.Mock)
        .mockResolvedValueOnce(25) // latest window
        .mockResolvedValueOnce(24); // previous window

      const result = await service.evaluateSession('session-1');

      expect(result.alertActive).toBe(true);
      expect(result.windows).toHaveLength(2);
    });

    test('test_evaluateSession_divergenceComesFromAppCheckinVsRoomPresenceAlone_stillCounted', async () => {
      // RULE-PRES-11's own worked example ("30 logins, 25 tags", camera not
      // even mentioned) — a login/tag mismatch alone must trigger the same
      // alert a camera mismatch would.
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(inProgressSession) });
      const { service, manager, roomPresenceService } = buildService({ classSessionRepo });
      const latest = new Date('2026-09-17T10:15:00.000Z');
      const previous = new Date('2026-09-17T10:00:00.000Z');
      manager.query
        .mockResolvedValueOnce([{ roomId: 'room-1' }])
        .mockResolvedValueOnce([
          { capturedAt: latest, count: 27 },
          { capturedAt: previous, count: 27 },
        ])
        .mockResolvedValueOnce([{ count: '30' }]) // app-checkin
        .mockResolvedValueOnce([{ count: '30' }]);
      (roomPresenceService.countActiveInRoom as jest.Mock)
        .mockResolvedValueOnce(25) // |30-25| = 5 >= threshold, even though camera(27) is close to both
        .mockResolvedValueOnce(25);

      const result = await service.evaluateSession('session-1');

      expect(result.windows[0].maxDivergence).toBe(5);
      expect(result.alertActive).toBe(true);
    });
  });

  describe('evaluateInProgressSessions', () => {
    test('test_evaluateInProgressSessions_discoversAndEvaluatesEachSession', async () => {
      const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ ...inProgressSession, status: 'cancelled' }) });
      const { service, manager } = buildService({ classSessionRepo });
      manager.query.mockResolvedValueOnce([{ id: 'session-1' }, { id: 'session-2' }]);

      const results = await service.evaluateInProgressSessions();

      expect(results).toHaveLength(2);
      expect(classSessionRepo.findOneBy).toHaveBeenCalledTimes(2);
    });

    test('test_evaluateInProgressSessions_noSessionsInProgress_returnsEmpty', async () => {
      const { service, manager } = buildService();
      manager.query.mockResolvedValueOnce([]);

      const results = await service.evaluateInProgressSessions();

      expect(results).toEqual([]);
    });
  });
});
