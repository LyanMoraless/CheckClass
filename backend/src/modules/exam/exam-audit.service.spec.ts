import { ExamSessionEventEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ExamAuditService } from './exam-audit.service';

// RULE-EXAM-12's trail, and Security control 4: the two write paths are
// separate functions with disjoint allow-lists, so a client-reported event
// can never be recorded as a lifecycle event and vice versa.
describe('ExamAuditService', () => {
  const session = { id: 'session-1', personId: 'student-1' };

  function buildService() {
    const eventRepo: MockRepository = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
    const manager = createMockEntityManager(new Map([[ExamSessionEventEntity, eventRepo]]));
    const service = new ExamAuditService(createMockTenantContext(manager) as never);
    return { service, eventRepo, manager };
  }

  test('test_recordServerEvent_lifecycleEvent_appendedAsNonViolation', async () => {
    const { service, eventRepo } = buildService();

    await service.recordServerEvent(session, 'EXAM_TIME_EXPIRED', { reason: 'duration' });

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        examSessionId: 'session-1',
        personId: 'student-1',
        eventType: 'EXAM_TIME_EXPIRED',
        treatedAsViolation: false,
      }),
    );
  });

  // occurredAt is written by the server/database, never taken from a client
  // (RULE-EXAM-07) — the entity is saved without it on purpose.
  test('test_recordServerEvent_neverSetsOccurredAtFromCaller', async () => {
    const { service, eventRepo } = buildService();

    await service.recordServerEvent(session, 'EXAM_SESSION_STARTED');

    expect(eventRepo.save.mock.calls[0][0]).not.toHaveProperty('occurredAt');
  });

  test('test_recordServerEvent_clientReportableType_rejected', async () => {
    const { service, eventRepo } = buildService();

    await expect(service.recordServerEvent(session, 'PAGE_BLUR' as never)).rejects.toThrow(
      /not a server-generated exam event type/,
    );
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  test('test_recordClientEvent_monitoringEvent_appendedWithViolationFlag', async () => {
    const { service, eventRepo } = buildService();

    await service.recordClientEvent(session, 'PAGE_RELOAD', true);

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PAGE_RELOAD', treatedAsViolation: true }),
    );
  });

  test('test_recordClientEvent_serverOnlyType_rejected', async () => {
    const { service, eventRepo } = buildService();

    await expect(service.recordClientEvent(session, 'EXAM_TIME_EXPIRED' as never, true)).rejects.toThrow(
      /not a client-reportable exam event type/,
    );
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  test('test_timeline_readsSessionEventsInChronologicalOrder', async () => {
    const { service, eventRepo } = buildService();

    await service.timeline('session-1');

    expect(eventRepo.find).toHaveBeenCalledWith({
      where: { examSessionId: 'session-1' },
      order: { occurredAt: 'ASC' },
    });
  });

  describe('statsBySession', () => {
    test('test_statsBySession_noSessions_skipsTheQueryEntirely', async () => {
      const { service, manager } = buildService();

      await expect(service.statsBySession([])).resolves.toEqual(new Map());
      expect(manager.query).not.toHaveBeenCalled();
    });

    // Aggregated in SQL because the teacher's panel polls it every 5 seconds
    // for a whole turma.
    test('test_statsBySession_countsViolationsPerSession', async () => {
      const { service, manager } = buildService();
      manager.query.mockResolvedValue([
        { exam_session_id: 'session-1', event_count: '5', violation_count: '2', last_event_at: new Date('2026-09-03T10:05:00.000Z') },
      ]);

      const stats = await service.statsBySession(['session-1']);

      expect(stats.get('session-1')).toEqual({
        examSessionId: 'session-1',
        eventCount: 5,
        violationCount: 2,
        lastEventAt: new Date('2026-09-03T10:05:00.000Z'),
      });
    });
  });
});
