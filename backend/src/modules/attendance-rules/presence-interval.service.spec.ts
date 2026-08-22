import { PresenceIntervalEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
} from '../../../test/unit/support/mock-entity-manager';
import { PresenceIntervalService } from './presence-interval.service';

// RULE-ATT-08 (sum every entry/exit interval, not just first-to-last) and
// RULE-ATT-09 (an unmatched entry/exit is never assumed to close on its own).
describe('PresenceIntervalService', () => {
  function buildService(rows: Array<{ checkin_at: Date; factor_code: string }>) {
    const presenceIntervalRepo = createMockRepository();
    const repositoriesByEntity = new Map([[PresenceIntervalEntity, presenceIntervalRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity as never);
    manager.query.mockResolvedValue(rows);
    const tenantContext = createMockTenantContext(manager);
    const service = new PresenceIntervalService(tenantContext as never);
    return { service, presenceIntervalRepo };
  }

  const entry = (iso: string) => ({ checkin_at: new Date(iso), factor_code: 'ROOM_ENTRY' });
  const exit = (iso: string) => ({ checkin_at: new Date(iso), factor_code: 'ROOM_EXIT' });

  test('test_rebuildForPerson_multipleEntryExitPairs_sumsAsDistinctIntervals', async () => {
    // RULE-ATT-08: student leaves and returns once within the same session.
    const rows = [
      entry('2026-08-21T10:00:00.000Z'),
      exit('2026-08-21T10:20:00.000Z'),
      entry('2026-08-21T10:30:00.000Z'),
      exit('2026-08-21T11:00:00.000Z'),
    ];
    const { service } = buildService(rows);

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result.closedIntervals).toHaveLength(2);
    expect(result.closedIntervals[0]).toEqual({ entryAt: rows[0].checkin_at, exitAt: rows[1].checkin_at });
    expect(result.closedIntervals[1]).toEqual({ entryAt: rows[2].checkin_at, exitAt: rows[3].checkin_at });
    expect(result.hasOpenInterval).toBe(false);
  });

  test('test_rebuildForPerson_unmatchedEntryAtEnd_staysOpen', async () => {
    // RULE-ATT-09: exit event never arrived — must never be assumed to run
    // through to session end.
    const rows = [entry('2026-08-21T10:00:00.000Z'), exit('2026-08-21T10:20:00.000Z'), entry('2026-08-21T10:30:00.000Z')];
    const { service, presenceIntervalRepo } = buildService(rows);

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result.closedIntervals).toHaveLength(1);
    expect(result.hasOpenInterval).toBe(true);
    expect(presenceIntervalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ entryAt: rows[2].checkin_at, exitAt: null }),
    );
  });

  test('test_rebuildForPerson_unmatchedExitWithNoPrecedingEntry_isIgnored', async () => {
    // A stray ROOM_EXIT with nothing to pair against can't be turned into an
    // interval — it must be dropped, not misattributed to a later entry.
    const rows = [exit('2026-08-21T09:00:00.000Z'), entry('2026-08-21T10:00:00.000Z'), exit('2026-08-21T10:20:00.000Z')];
    const { service } = buildService(rows);

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result.closedIntervals).toHaveLength(1);
    expect(result.closedIntervals[0]).toEqual({ entryAt: rows[1].checkin_at, exitAt: rows[2].checkin_at });
    expect(result.hasOpenInterval).toBe(false);
  });

  test('test_rebuildForPerson_noCheckins_returnsEmptyResultAndClearsPriorIntervals', async () => {
    const { service, presenceIntervalRepo } = buildService([]);

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result).toEqual({ closedIntervals: [], hasOpenInterval: false });
    // Always recomputed from scratch (delete + reinsert) — a session with no
    // checkins at all must still clear any stale interval from a prior run.
    expect(presenceIntervalRepo.delete).toHaveBeenCalledWith({ classSessionId: 'session-1', personId: 'person-1' });
    expect(presenceIntervalRepo.save).not.toHaveBeenCalled();
  });

  test('test_rebuildForPerson_alwaysDeletesExistingIntervalsBeforeReinserting', async () => {
    const rows = [entry('2026-08-21T10:00:00.000Z'), exit('2026-08-21T10:20:00.000Z')];
    const { service, presenceIntervalRepo } = buildService(rows);

    await service.rebuildForPerson('session-1', 'person-1');

    expect(presenceIntervalRepo.delete).toHaveBeenCalledWith({ classSessionId: 'session-1', personId: 'person-1' });
    expect(presenceIntervalRepo.save).toHaveBeenCalled();
  });

  test('test_rebuildForPerson_twoConsecutiveEntriesWithNoExitBetween_treatsLaterEntryAsActive', async () => {
    // Sensor double-fired ROOM_ENTRY with no exit between: the service logs a
    // warning and keeps the later entry as the open one, rather than crashing
    // or silently dropping the person's presence entirely.
    const rows = [entry('2026-08-21T10:00:00.000Z'), entry('2026-08-21T10:05:00.000Z'), exit('2026-08-21T10:30:00.000Z')];
    const { service } = buildService(rows);

    const result = await service.rebuildForPerson('session-1', 'person-1');

    expect(result.closedIntervals).toHaveLength(1);
    expect(result.closedIntervals[0]).toEqual({ entryAt: rows[1].checkin_at, exitAt: rows[2].checkin_at });
    expect(result.hasOpenInterval).toBe(false);
  });
});
