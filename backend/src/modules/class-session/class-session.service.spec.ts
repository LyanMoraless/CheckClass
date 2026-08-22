import { ClassSessionEntity, ClassSessionRequiredFactorEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ResolvedAttendanceConfig, TenantConfigService } from '../config/tenant-config.service';
import { ClassSessionService, CreateClassSessionInput } from './class-session.service';

// RULE-ATT-04/05: the effective config is snapshotted onto class_session at
// creation time, so a later config change never retroactively recalculates
// an already-scheduled/past session.
describe('ClassSessionService', () => {
  const baseInput: CreateClassSessionInput = {
    classGroupId: 'class-group-1',
    roomId: 'room-1',
    scheduledStart: new Date('2026-08-24T13:00:00Z'),
    scheduledEnd: new Date('2026-08-24T15:00:00Z'),
  };

  const resolvedConfig: ResolvedAttendanceConfig = {
    configId: 'config-1',
    minAttendancePercentage: 75,
    toleranceMinutes: 10,
    postToleranceBehavior: 'block_checkin',
    requiredFactorTypeIds: [],
  };

  function buildService(options: {
    sessionRepo?: MockRepository;
    requiredFactorRepo?: MockRepository;
    effectiveConfig?: ResolvedAttendanceConfig;
  } = {}) {
    const sessionRepo =
      options.sessionRepo ?? createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'session-1' }) });
    const requiredFactorRepo = options.requiredFactorRepo ?? createMockRepository();

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [ClassSessionEntity, sessionRepo],
      [ClassSessionRequiredFactorEntity, requiredFactorRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);
    const configService = {
      resolveEffectiveConfig: jest.fn().mockResolvedValue(options.effectiveConfig ?? resolvedConfig),
    };
    const service = new ClassSessionService(tenantContext as never, configService as unknown as TenantConfigService);
    return { service, sessionRepo, requiredFactorRepo, configService };
  }

  test('test_createSession_snapshotsResolvedConfigOntoSession', async () => {
    const { service, sessionRepo } = buildService();

    await service.createSession(baseInput);

    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        classGroupId: 'class-group-1',
        roomId: 'room-1',
        minAttendancePercentageSnapshot: 75,
        toleranceMinutesSnapshot: 10,
        postToleranceBehaviorSnapshot: 'block_checkin',
      }),
    );
  });

  test('test_createSession_noRequiredFactors_doesNotTouchRequiredFactorRepo', async () => {
    const { service, requiredFactorRepo } = buildService({ effectiveConfig: { ...resolvedConfig, requiredFactorTypeIds: [] } });

    await service.createSession(baseInput);

    expect(requiredFactorRepo.save).not.toHaveBeenCalled();
  });

  test('test_createSession_withRequiredFactors_savesOneRowPerFactor', async () => {
    const { service, requiredFactorRepo } = buildService({
      effectiveConfig: { ...resolvedConfig, requiredFactorTypeIds: ['factor-1', 'factor-2'] },
    });

    await service.createSession(baseInput);

    expect(requiredFactorRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ classSessionId: 'session-1', attendanceFactorTypeId: 'factor-1' }),
      expect.objectContaining({ classSessionId: 'session-1', attendanceFactorTypeId: 'factor-2' }),
    ]);
  });

  test('test_list_noClassGroupFilter_findsAllOrderedByScheduledStartDesc', async () => {
    const sessions = [{ id: 'session-1' }, { id: 'session-2' }];
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(sessions) });
    const { service } = buildService({ sessionRepo });

    const result = await service.list();

    expect(result).toBe(sessions);
    expect(sessionRepo.find).toHaveBeenCalledWith({ order: { scheduledStart: 'DESC' } });
  });

  test('test_list_withClassGroupFilter_findsOnlyThatClassGroupsSessions', async () => {
    const sessions = [{ id: 'session-1' }];
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(sessions) });
    const { service } = buildService({ sessionRepo });

    const result = await service.list('class-group-1');

    expect(result).toBe(sessions);
    expect(sessionRepo.find).toHaveBeenCalledWith({
      where: { classGroupId: 'class-group-1' },
      order: { scheduledStart: 'DESC' },
    });
  });
});
