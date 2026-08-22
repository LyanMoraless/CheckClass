import { NotFoundException } from '@nestjs/common';
import { DeviceEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { DeviceService } from './device.service';

describe('DeviceService', () => {
  function buildService(deviceRepo?: MockRepository) {
    const repo =
      deviceRepo ?? createMockRepository({ save: jest.fn((entity: unknown) => Promise.resolve({ id: 'device-1', ...(entity as object) })) });
    const manager = createMockEntityManager(new Map([[DeviceEntity, repo]]));
    const tenantContext = createMockTenantContext(manager);
    const service = new DeviceService(tenantContext as never);
    return { service, deviceRepo: repo };
  }

  test('test_register_generatesApiKeyAndStoresOnlyItsHash', async () => {
    const { service, deviceRepo } = buildService();

    const result = await service.register({ deviceType: 'raspberry_camera', externalIdentifier: 'rpi-1' });

    expect(result.deviceId).toBe('device-1');
    // apiKeyId.secret shape, same as the CLI create-device script.
    expect(result.apiKey).toMatch(/^[0-9a-f]{32}\.[0-9a-f]{64}$/);

    const savedEntity = deviceRepo.save.mock.calls[0][0];
    expect(savedEntity.apiKeySecretHash).toBeDefined();
    expect(result.apiKey).not.toContain(savedEntity.apiKeySecretHash);
  });

  test('test_register_twoCalls_produceDifferentApiKeys', async () => {
    const { service } = buildService();

    const first = await service.register({ deviceType: 'x', externalIdentifier: 'a' });
    const second = await service.register({ deviceType: 'x', externalIdentifier: 'b' });

    expect(first.apiKey).not.toBe(second.apiKey);
  });

  test('test_list_neverReturnsApiKeySecretHash', async () => {
    const deviceRepo = createMockRepository({
      find: jest
        .fn()
        .mockResolvedValue([{ id: 'device-1', deviceType: 'x', apiKeySecretHash: 'super-secret-hash-value' }]),
    });
    const { service } = buildService(deviceRepo);

    const result = await service.list();

    expect(JSON.stringify(result)).not.toContain('super-secret-hash-value');
  });

  test('test_revoke_deviceExists_setsStatusInactive', async () => {
    const deviceRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'device-1' }) });
    const { service } = buildService(deviceRepo);

    await service.revoke('device-1');

    expect(deviceRepo.update).toHaveBeenCalledWith({ id: 'device-1' }, { status: 'inactive' });
  });

  test('test_revoke_deviceNotFound_throwsNotFound', async () => {
    const deviceRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService(deviceRepo);

    await expect(service.revoke('missing-device')).rejects.toThrow(NotFoundException);
  });
});
