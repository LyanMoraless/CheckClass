import { ForbiddenException } from '@nestjs/common';
import { DeviceBindingConfigEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { DEFAULT_INACTIVITY_TIMEOUT_MINUTES, DeviceBindingConfigService } from './device-binding-config.service';

// RULE-DEV-06 gatilho 3's configurable inactivity threshold. getEffective()'s
// fallback-when-unconfigured behavior and upsert()'s Direção/Reitoria gate
// (Backend Agent decision, documented in this service's own header comment —
// not dictated by any RULE-DEV rule) are both real branching logic, unlike
// the pass-through controller that calls this service.
describe('DeviceBindingConfigService', () => {
  function buildService(options: { existingConfig?: Partial<DeviceBindingConfigEntity> | null; authorized?: boolean } = {}) {
    const configRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.existingConfig ?? null),
      findOneByOrFail: jest.fn().mockResolvedValue(options.existingConfig ?? null),
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'config-1', ...(entity as object) })),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([[DeviceBindingConfigEntity, configRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);

    const leadershipScope = {
      getCourseScope: jest.fn().mockResolvedValue({ allCourses: options.authorized ?? true, courseIds: [] }),
    } as unknown as LeadershipScopeService;

    const service = new DeviceBindingConfigService(tenantContext as never, leadershipScope);
    return { service, configRepo, leadershipScope };
  }

  describe('getEffective', () => {
    test('test_getEffective_noConfigRowForTenant_returnsHardcodedDefaultMarkedAsDefault', async () => {
      const { service } = buildService({ existingConfig: null });

      const result = await service.getEffective();

      expect(result).toEqual({ inactivityTimeoutMinutes: DEFAULT_INACTIVITY_TIMEOUT_MINUTES, isDefault: true });
    });

    test('test_getEffective_configRowExists_returnsConfiguredValueMarkedNotDefault', async () => {
      const { service } = buildService({ existingConfig: { id: 'config-1', inactivityTimeoutMinutes: 45 } });

      const result = await service.getEffective();

      expect(result).toEqual({ inactivityTimeoutMinutes: 45, isDefault: false });
    });
  });

  describe('upsert', () => {
    test('test_upsert_notDirection_throwsForbiddenAndNeverWrites', async () => {
      const { service, configRepo } = buildService({ authorized: false });

      await expect(service.upsert(45, 'professor-1')).rejects.toThrow(ForbiddenException);
      expect(configRepo.save).not.toHaveBeenCalled();
      expect(configRepo.update).not.toHaveBeenCalled();
    });

    test('test_upsert_authorizedDirectionNoExistingRow_insertsNewConfig', async () => {
      const { service, configRepo } = buildService({ authorized: true, existingConfig: null });

      const result = await service.upsert(45, 'direction-1');

      expect(configRepo.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a-id', inactivityTimeoutMinutes: 45 }));
      expect(configRepo.update).not.toHaveBeenCalled();
      expect(result.inactivityTimeoutMinutes).toBe(45);
    });

    test('test_upsert_authorizedDirectionExistingRow_updatesInPlaceInsteadOfInserting', async () => {
      const { service, configRepo } = buildService({ authorized: true, existingConfig: { id: 'config-1', inactivityTimeoutMinutes: 30 } });

      await service.upsert(60, 'direction-1');

      expect(configRepo.update).toHaveBeenCalledWith({ id: 'config-1' }, { inactivityTimeoutMinutes: 60 });
      expect(configRepo.save).not.toHaveBeenCalled();
    });
  });
});
