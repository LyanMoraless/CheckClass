import { MePersonAttendanceService } from './me-person-attendance.service';

// GET /v1/me/attendance's read model (Frente 10, RULE-RET-01 mobile-app
// note): merges the LIVE window (AttendanceRegisterService.getPersonHistory,
// unchanged) with archived gap sessions
// (AttendanceRetentionArchiveLookupService), so an old, purged session reads
// as `archived: true` instead of silently vanishing from the response.
describe('MePersonAttendanceService', () => {
  function buildService(options: { liveEntries?: unknown[]; archivedGaps?: unknown[] } = {}) {
    const registerService = {
      getPersonHistory: jest.fn().mockResolvedValue(
        options.liveEntries ?? [
          {
            classSessionId: 'session-live-1',
            scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
            scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
            status: 'present',
            attendancePercentage: 100,
            pendingReason: null,
          },
        ],
      ),
    };
    const archiveLookup = {
      findArchivedGapSessions: jest.fn().mockResolvedValue(
        options.archivedGaps ?? [
          {
            classSessionId: 'session-archived-1',
            scheduledStart: new Date('2026-03-01T10:00:00.000Z'),
            scheduledEnd: new Date('2026-03-01T11:00:00.000Z'),
          },
        ],
      ),
    };
    const service = new MePersonAttendanceService(registerService as never, archiveLookup as never);
    return { service, registerService, archiveLookup };
  }

  test('test_getMyAttendanceHistory_marksLiveEntriesAsNotArchived', async () => {
    const { service } = buildService();

    const result = await service.getMyAttendanceHistory('person-1');

    const live = result.find((entry) => entry.classSessionId === 'session-live-1');
    expect(live).toEqual(expect.objectContaining({ archived: false, status: 'present' }));
  });

  test('test_getMyAttendanceHistory_marksArchivedGapsAsArchivedWithoutAFakeStatus', async () => {
    const { service } = buildService();

    const result = await service.getMyAttendanceHistory('person-1');

    const archived = result.find((entry) => entry.classSessionId === 'session-archived-1');
    expect(archived).toEqual({
      classSessionId: 'session-archived-1',
      scheduledStart: new Date('2026-03-01T10:00:00.000Z'),
      scheduledEnd: new Date('2026-03-01T11:00:00.000Z'),
      archived: true,
    });
    expect(archived).not.toHaveProperty('status');
  });

  test('test_getMyAttendanceHistory_sortsMergedResultByScheduledStartDescending', async () => {
    const { service } = buildService();

    const result = await service.getMyAttendanceHistory('person-1');

    expect(result.map((entry) => entry.classSessionId)).toEqual(['session-live-1', 'session-archived-1']);
  });

  test('test_getMyAttendanceHistory_noArchivedGaps_returnsOnlyLiveEntries', async () => {
    const { service } = buildService({ archivedGaps: [] });

    const result = await service.getMyAttendanceHistory('person-1');

    expect(result).toHaveLength(1);
    expect(result[0].archived).toBe(false);
  });

  test('test_getMyAttendanceHistory_passesClassGroupIdToBothSources', async () => {
    const { service, registerService, archiveLookup } = buildService();

    await service.getMyAttendanceHistory('person-1', 'class-group-1');

    expect(registerService.getPersonHistory).toHaveBeenCalledWith('person-1', 'class-group-1');
    expect(archiveLookup.findArchivedGapSessions).toHaveBeenCalledWith('person-1', 'class-group-1');
  });
});
