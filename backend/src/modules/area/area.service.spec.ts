import { AreaEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { AreaService } from './area.service';

describe('AreaService', () => {
  function buildService(options: { parentArea: AreaEntity | null }) {
    const areaRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.parentArea) });
    const manager = createMockEntityManager(new Map([[AreaEntity, areaRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const service = new AreaService(tenantContext as never);
    return { service, areaRepo };
  }

  test('test_create_noParentAreaId_savesTopLevelAreaWithTenantId', async () => {
    const { service, areaRepo } = buildService({ parentArea: null });

    await service.create({ name: 'Bloco A' });

    expect(areaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a-id', parentAreaId: null, name: 'Bloco A' }),
    );
  });

  test('test_create_parentAreaExists_savesNestedAreaWithParentAreaId', async () => {
    const parent = { id: 'bloco-1' } as AreaEntity;
    const { service, areaRepo } = buildService({ parentArea: parent });

    await service.create({ name: 'Andar 1', parentAreaId: 'bloco-1' });

    expect(areaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a-id', parentAreaId: 'bloco-1', name: 'Andar 1' }),
    );
  });

  test('test_create_parentAreaDoesNotExist_throwsNotFoundWithoutSaving', async () => {
    const { service, areaRepo } = buildService({ parentArea: null });

    await expect(service.create({ name: 'Andar 1', parentAreaId: 'missing-area' })).rejects.toThrow('area missing-area not found');
    expect(areaRepo.save).not.toHaveBeenCalled();
  });

  test('test_list_returnsAllTenantScopedAreas', async () => {
    const areas = [{ id: 'bloco-1' } as AreaEntity];
    const areaRepo = createMockRepository({ find: jest.fn().mockResolvedValue(areas) });
    const manager = createMockEntityManager(new Map([[AreaEntity, areaRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const service = new AreaService(tenantContext as never);

    await expect(service.list()).resolves.toBe(areas);
  });
});
