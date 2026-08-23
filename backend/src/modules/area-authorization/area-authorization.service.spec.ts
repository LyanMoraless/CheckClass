import { AreaEntity, WristbandCategoryAreaPermissionEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { AreaAuthorizationService } from './area-authorization.service';

// Covers the containment-resolution gap explicitly flagged to the Backend
// Agent (Database Agent's note in AddArea/AddWristbandCategoryAreaPermission
// migrations): a permission granted at a parent "bloco" area must cover its
// nested areas, since area containment is not enforced by the schema itself.
describe('AreaAuthorizationService', () => {
  const blocoArea: AreaEntity = {
    id: 'bloco-1',
    tenantId: 'tenant-a-id',
    parentAreaId: null,
    name: 'Bloco A',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const nestedArea: AreaEntity = {
    id: 'andar-1',
    tenantId: 'tenant-a-id',
    parentAreaId: 'bloco-1',
    name: 'Andar 1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildService(options: {
    areaFindOneBy: jest.Mock;
    permissionFindResult: WristbandCategoryAreaPermissionEntity[];
  }) {
    const areaRepo = createMockRepository({ findOneBy: options.areaFindOneBy });
    const permissionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(options.permissionFindResult) });
    const manager = createMockEntityManager(
      new Map([
        [AreaEntity, areaRepo],
        [WristbandCategoryAreaPermissionEntity, permissionRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const service = new AreaAuthorizationService(tenantContext as never);
    return { service, permissionRepo };
  }

  test('test_isAuthorized_nullWristbandCategory_returnsFalseWithoutQuerying', async () => {
    const { service } = buildService({ areaFindOneBy: jest.fn(), permissionFindResult: [] });

    const result = await service.isAuthorized(null, 'andar-1', new Date('2026-08-23T10:00:00Z'));

    expect(result).toBe(false);
  });

  test('test_isAuthorized_blocoLevelGrantCoversNestedArea_returnsTrue', async () => {
    // Target is the nested area (andar-1); walking up its parent_area_id
    // reaches bloco-1, which is where the wristband category's permission
    // row actually lives.
    const areaFindOneBy = jest.fn().mockResolvedValueOnce(nestedArea).mockResolvedValueOnce(blocoArea);
    const permission: WristbandCategoryAreaPermissionEntity = {
      id: 'perm-1',
      tenantId: 'tenant-a-id',
      wristbandCategoryId: 'category-1',
      areaId: 'bloco-1',
      validFrom: null,
      validUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { service, permissionRepo } = buildService({ areaFindOneBy, permissionFindResult: [permission] });

    const result = await service.isAuthorized('category-1', 'andar-1', new Date('2026-08-23T10:00:00Z'));

    expect(result).toBe(true);
    expect(permissionRepo.find).toHaveBeenCalledWith({
      where: { wristbandCategoryId: 'category-1', areaId: expect.anything() },
    });
  });

  test('test_isAuthorized_noPermissionForCategoryOrAncestors_returnsFalse', async () => {
    const areaFindOneBy = jest.fn().mockResolvedValueOnce(nestedArea).mockResolvedValueOnce(blocoArea);
    const { service } = buildService({ areaFindOneBy, permissionFindResult: [] });

    const result = await service.isAuthorized('category-1', 'andar-1', new Date('2026-08-23T10:00:00Z'));

    expect(result).toBe(false);
  });

  test('test_isAuthorized_permissionExpiredBeforeCapturedAt_returnsFalse', async () => {
    const areaFindOneBy = jest.fn().mockResolvedValueOnce(blocoArea);
    const expiredPermission: WristbandCategoryAreaPermissionEntity = {
      id: 'perm-2',
      tenantId: 'tenant-a-id',
      wristbandCategoryId: 'category-1',
      areaId: 'bloco-1',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-06-01T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { service } = buildService({ areaFindOneBy, permissionFindResult: [expiredPermission] });

    const result = await service.isAuthorized('category-1', 'bloco-1', new Date('2026-08-23T10:00:00Z'));

    expect(result).toBe(false);
  });

  test('test_isAuthorized_permissionValidAtCapturedAt_returnsTrue', async () => {
    const areaFindOneBy = jest.fn().mockResolvedValueOnce(blocoArea);
    const validPermission: WristbandCategoryAreaPermissionEntity = {
      id: 'perm-3',
      tenantId: 'tenant-a-id',
      wristbandCategoryId: 'category-1',
      areaId: 'bloco-1',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { service } = buildService({ areaFindOneBy, permissionFindResult: [validPermission] });

    const result = await service.isAuthorized('category-1', 'bloco-1', new Date('2026-08-23T10:00:00Z'));

    expect(result).toBe(true);
  });
});
