import { AreaEntity, CameraEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { CameraService } from './camera.service';

describe('CameraService', () => {
  function buildService(options: { area: AreaEntity | null }) {
    const areaRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.area) });
    const cameraRepo = createMockRepository();
    const manager = createMockEntityManager(
      new Map([
        [AreaEntity, areaRepo],
        [CameraEntity, cameraRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const service = new CameraService(tenantContext as never);
    return { service, cameraRepo };
  }

  test('test_create_areaExists_savesCameraWithTenantIdAndGivenFields', async () => {
    const area = { id: 'area-1' } as AreaEntity;
    const { service, cameraRepo } = buildService({ area });

    await service.create({ name: 'Lobby Cam', areaId: 'area-1', streamUrl: 'rtsp://example.com/lobby' });

    expect(cameraRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a-id',
        areaId: 'area-1',
        name: 'Lobby Cam',
        streamUrl: 'rtsp://example.com/lobby',
      }),
    );
  });

  test('test_create_areaDoesNotExist_throwsNotFoundWithoutSaving', async () => {
    const { service, cameraRepo } = buildService({ area: null });

    await expect(service.create({ name: 'Lobby Cam', areaId: 'missing-area', streamUrl: 'rtsp://example.com/lobby' })).rejects.toThrow(
      'area missing-area not found',
    );
    expect(cameraRepo.save).not.toHaveBeenCalled();
  });
});
