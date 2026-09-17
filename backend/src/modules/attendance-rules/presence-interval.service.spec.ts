import { PresenceIntervalEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
} from '../../../test/unit/support/mock-entity-manager';
import { RoomPresenceService, SessionProjectedInterval } from '../room-presence/room-presence.service';
import { PresenceIntervalService } from './presence-interval.service';

// RULE-ATT-08 (sum every entry/exit interval, not just first-to-last) and
// RULE-ATT-09 (an unmatched entry/exit is never assumed to close on its
// own). "Decisão de arquitetura — Fluxo de Chamada Redesenhado"
// (architecture-overview.md): the entry/exit pairing logic itself now lives
// in RoomPresenceService.getSessionProjectedInterval — this service only
// persists whatever that projection already decided, so these tests mock
// RoomPresenceService directly instead of a raw identification_checkin
// query. The OUTPUT contract under test (closedIntervals/hasOpenInterval,
// always delete+reinsert into presence_interval) is unchanged from before
// this migration — that is exactly the contract this file guards.
describe('PresenceIntervalService', () => {
  function buildService(projection: SessionProjectedInterval) {
    const presenceIntervalRepo = createMockRepository();
    const repositoriesByEntity = new Map([[PresenceIntervalEntity, presenceIntervalRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity as never);
    const tenantContext = createMockTenantContext(manager);
    const roomPresenceService = {
      getSessionProjectedInterval: jest.fn().mockResolvedValue(projection),
    } as unknown as RoomPresenceService;
    const service = new PresenceIntervalService(tenantContext as never, roomPresenceService);
    return { service, presenceIntervalRepo, roomPresenceService };
  }

  test('test_rebuildForPerson_multipleClosedIntervals_persistsAndReturnsThemAll', async () => {
    // RULE-ATT-08: student leaves and returns once within the same session.
    const closedIntervals = [
      { entryAt: new Date('2026-08-21T10:00:00.000Z'), exitAt: new Date('2026-08-21T10:20:00.000Z') },
      { entryAt: new Date('2026-08-21T10:30:00.000Z'), exitAt: new Date('2026-08-21T11:00:00.000Z') },
    ];
    const { service, presenceIntervalRepo, roomPresenceService } = buildService({
      closedIntervals,
      hasOpenInterval: false,
      openIntervalEntryAt: null,
    });

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result).toEqual({ closedIntervals, hasOpenInterval: false });
    expect(roomPresenceService.getSessionProjectedInterval).toHaveBeenCalledWith('person-1', 'session-1');
    expect(presenceIntervalRepo.delete).toHaveBeenCalledWith({ classSessionId: 'session-1', personId: 'person-1' });
    expect(presenceIntervalRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ entryAt: closedIntervals[0].entryAt, exitAt: closedIntervals[0].exitAt }),
      expect.objectContaining({ entryAt: closedIntervals[1].entryAt, exitAt: closedIntervals[1].exitAt }),
    ]);
  });

  test('test_rebuildForPerson_hasOpenInterval_persistsOpenRowWithNullExit', async () => {
    // RULE-ATT-09: exit event never arrived — must never be assumed to run
    // through to session end.
    const openIntervalEntryAt = new Date('2026-08-21T10:30:00.000Z');
    const { service, presenceIntervalRepo } = buildService({
      closedIntervals: [],
      hasOpenInterval: true,
      openIntervalEntryAt,
    });

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result).toEqual({ closedIntervals: [], hasOpenInterval: true });
    expect(presenceIntervalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ entryAt: openIntervalEntryAt, exitAt: null }),
    );
  });

  test('test_rebuildForPerson_noIntervalsAtAll_returnsEmptyResultAndClearsPriorIntervals', async () => {
    const { service, presenceIntervalRepo } = buildService({ closedIntervals: [], hasOpenInterval: false, openIntervalEntryAt: null });

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result).toEqual({ closedIntervals: [], hasOpenInterval: false });
    // Always recomputed from scratch (delete + reinsert) — a session with no
    // intervals at all must still clear any stale interval from a prior run.
    expect(presenceIntervalRepo.delete).toHaveBeenCalledWith({ classSessionId: 'session-1', personId: 'person-1' });
    expect(presenceIntervalRepo.save).not.toHaveBeenCalled();
  });

  test('test_rebuildForPerson_alwaysDeletesExistingIntervalsBeforeReinserting', async () => {
    const closedIntervals = [{ entryAt: new Date('2026-08-21T10:00:00.000Z'), exitAt: new Date('2026-08-21T10:20:00.000Z') }];
    const { service, presenceIntervalRepo } = buildService({ closedIntervals, hasOpenInterval: false, openIntervalEntryAt: null });

    await service.rebuildForPerson('session-1', 'person-1');

    expect(presenceIntervalRepo.delete).toHaveBeenCalledWith({ classSessionId: 'session-1', personId: 'person-1' });
    expect(presenceIntervalRepo.save).toHaveBeenCalled();
  });
});
