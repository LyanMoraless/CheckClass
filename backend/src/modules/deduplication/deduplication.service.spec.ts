import { AttendanceFactorTypeEntity, IdentificationCheckinEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { DeduplicationService } from './deduplication.service';

// RULE-ATT-10 (first valid event wins) / RULE-RET-03 (window size differs by
// factor nature: 2s for ROOM_ENTRY/ROOM_EXIT state transitions, 10s for
// point-in-time identification factors).
describe('DeduplicationService', () => {
  const checkin: IdentificationCheckinEntity = {
    id: 'checkin-1',
    tenantId: 'tenant-a-id',
    rawIdentificationEventId: 'raw-1',
    personId: 'person-1',
    classSessionId: 'session-1',
    attendanceFactorTypeId: 'factor-1',
    checkinAt: new Date('2026-08-21T10:00:00.000Z'),
    isDuplicate: false,
    duplicateOfCheckinId: null,
    createdAt: new Date('2026-08-21T10:00:00.000Z'),
  };

  function buildService(options: {
    checkinRepo?: MockRepository;
    factorTypeRepo?: MockRepository;
    canonicalRows?: Array<{ id: string }>;
  }) {
    const checkinRepo = options.checkinRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(checkin) });
    const factorTypeRepo = options.factorTypeRepo ?? createMockRepository();
    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [IdentificationCheckinEntity, checkinRepo],
      [AttendanceFactorTypeEntity, factorTypeRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    manager.query.mockResolvedValue(options.canonicalRows ?? []);
    const tenantContext = createMockTenantContext(manager);
    const service = new DeduplicationService(tenantContext as never);
    return { service, manager, checkinRepo, factorTypeRepo };
  }

  test('test_deduplicate_checkinNotFound_returnsWithoutQuerying', async () => {
    const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service, manager } = buildService({ checkinRepo });

    await service.deduplicate('missing-checkin');

    expect(manager.query).not.toHaveBeenCalled();
  });

  test('test_deduplicate_alreadyMarkedDuplicate_returnsEarlyWithoutQuerying', async () => {
    const checkinRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ ...checkin, isDuplicate: true }),
    });
    const { service, manager } = buildService({ checkinRepo });

    await service.deduplicate(checkin.id);

    expect(manager.query).not.toHaveBeenCalled();
  });

  test('test_deduplicate_stateTransitionFactor_usesTwoSecondWindow', async () => {
    const factorTypeRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'factor-1', code: 'ROOM_ENTRY' }),
    });
    const { service, manager } = buildService({ factorTypeRepo });

    await service.deduplicate(checkin.id);

    // calls[0] is the advisory lock (pg_advisory_xact_lock) taken up front to
    // serialize concurrent dedup jobs on the same correlation key — the
    // actual window-lookup query is calls[1].
    const [, params] = manager.query.mock.calls[1];
    expect(params[params.length - 1]).toBe(2);
  });

  test('test_deduplicate_pointInTimeFactor_usesTenSecondWindow', async () => {
    const factorTypeRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'factor-1', code: 'TAG_CHECKIN' }),
    });
    const { service, manager } = buildService({ factorTypeRepo });

    await service.deduplicate(checkin.id);

    // calls[0] is the advisory lock (pg_advisory_xact_lock) taken up front to
    // serialize concurrent dedup jobs on the same correlation key — the
    // actual window-lookup query is calls[1].
    const [, params] = manager.query.mock.calls[1];
    expect(params[params.length - 1]).toBe(10);
  });

  test('test_deduplicate_customFactorCode_treatedAsPointInTime_usesTenSecondWindow', async () => {
    // RULE-ATT-13: institution-defined custom factors are point-in-time taps,
    // not state-transition sensors — must not accidentally fall into the
    // 2-second window meant only for ROOM_ENTRY/ROOM_EXIT.
    const factorTypeRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'factor-custom', code: 'FINGERPRINT_SCAN' }),
    });
    const { service, manager } = buildService({ factorTypeRepo });

    await service.deduplicate(checkin.id);

    // calls[0] is the advisory lock (pg_advisory_xact_lock) taken up front to
    // serialize concurrent dedup jobs on the same correlation key — the
    // actual window-lookup query is calls[1].
    const [, params] = manager.query.mock.calls[1];
    expect(params[params.length - 1]).toBe(10);
  });

  test('test_deduplicate_canonicalFoundWithinWindow_marksCurrentAsDuplicate', async () => {
    const checkinRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(checkin) });
    const { service, checkinRepo: repo } = buildService({
      checkinRepo,
      canonicalRows: [{ id: 'canonical-checkin-id' }],
    });

    await service.deduplicate(checkin.id);

    expect(repo.update).toHaveBeenCalledWith(
      { id: checkin.id },
      { isDuplicate: true, duplicateOfCheckinId: 'canonical-checkin-id' },
    );
  });

  test('test_deduplicate_noCanonicalFoundWithinWindow_leavesCheckinCanonical', async () => {
    const { service, checkinRepo } = buildService({ canonicalRows: [] });

    await service.deduplicate(checkin.id);

    expect(checkinRepo.update).not.toHaveBeenCalled();
  });

  test('test_deduplicate_takesAdvisoryLockOnCorrelationKeyBeforeQueryingCandidates', async () => {
    // Regression guard for the lock-order-inversion deadlock a prior design
    // had (FOR UPDATE on the candidate row while updating a different row):
    // a transaction-scoped advisory lock keyed on tenant+person+factor+session
    // must be taken up front, serializing the whole critical section instead.
    const { service, manager } = buildService({});

    await service.deduplicate(checkin.id);

    const [lockSql, lockParams] = manager.query.mock.calls[0];
    expect(lockSql).toContain('pg_advisory_xact_lock');
    expect(lockParams).toEqual(['tenant-a-id:person-1:factor-1:session-1']);
  });
});
