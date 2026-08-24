import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AreaEntity, PersonEntity, WristbandCategoryAreaPermissionEntity, WristbandCategoryEntity, WristbandEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { GrantAreaPermissionInput, IssueWristbandInput, WristbandService } from './wristband.service';

// RULE-ACC-01: a wristband/tag is the holder's identity credential. Revoking
// sets status inactive (IdentificationService already filters on
// status='active') rather than deleting, so the audit trail survives.
describe('WristbandService', () => {
  const issueInput: IssueWristbandInput = {
    personId: 'person-1',
    wristbandCategoryId: 'category-1',
    tagCode: 'TAG-001',
  };

  function buildService(options: {
    personRepo?: MockRepository;
    categoryRepo?: MockRepository;
    wristbandRepo?: MockRepository;
    areaRepo?: MockRepository;
    areaPermissionRepo?: MockRepository;
  } = {}) {
    const personRepo = options.personRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'person-1' }) });
    const categoryRepo =
      options.categoryRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'category-1' }) });
    const wristbandRepo = options.wristbandRepo ?? createMockRepository();
    const areaRepo = options.areaRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'area-1' }) });
    const areaPermissionRepo = options.areaPermissionRepo ?? createMockRepository();

    const repositoriesByEntity = new Map([
      [PersonEntity, personRepo],
      [WristbandCategoryEntity, categoryRepo],
      [WristbandEntity, wristbandRepo],
      [AreaEntity, areaRepo],
      [WristbandCategoryAreaPermissionEntity, areaPermissionRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);
    const service = new WristbandService(tenantContext as never);
    return { service, personRepo, categoryRepo, wristbandRepo, areaRepo, areaPermissionRepo };
  }

  test('test_issue_personAndCategoryExist_savesWristband', async () => {
    const { service, wristbandRepo } = buildService();

    await service.issue(issueInput);

    expect(wristbandRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a-id', personId: 'person-1', wristbandCategoryId: 'category-1', tagCode: 'TAG-001' }),
    );
  });

  test('test_issue_personNotFound_throwsNotFound', async () => {
    const personRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ personRepo });

    await expect(service.issue(issueInput)).rejects.toThrow(NotFoundException);
  });

  test('test_issue_categoryNotFound_throwsNotFound', async () => {
    const categoryRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ categoryRepo });

    await expect(service.issue(issueInput)).rejects.toThrow(NotFoundException);
  });

  test('test_issue_duplicateTagCode_throwsConflictNotRawDbError', async () => {
    const duplicateError = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
      driverError: { code: '23505' },
    });
    const wristbandRepo = createMockRepository({ save: jest.fn().mockRejectedValue(duplicateError) });
    const { service } = buildService({ wristbandRepo });

    await expect(service.issue(issueInput)).rejects.toThrow(ConflictException);
  });

  test('test_revoke_wristbandExists_setsStatusInactive', async () => {
    const wristbandRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'wristband-1' }) });
    const { service } = buildService({ wristbandRepo });

    await service.revoke('wristband-1');

    expect(wristbandRepo.update).toHaveBeenCalledWith({ id: 'wristband-1' }, { status: 'inactive' });
  });

  test('test_revoke_wristbandNotFound_throwsNotFound', async () => {
    const wristbandRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ wristbandRepo });

    await expect(service.revoke('missing-wristband')).rejects.toThrow(NotFoundException);
  });

  // RULE-ACC-02's actual authorization link: grants a category access to an
  // area. Without this, wristband_category_area_permission rows could never
  // be created and AreaAuthorizationService.isAuthorized would always
  // return false.
  describe('grantAreaPermission', () => {
    const grantInput: GrantAreaPermissionInput = { wristbandCategoryId: 'category-1', areaId: 'area-1' };

    test('test_grantAreaPermission_categoryAndAreaExist_savesPermissionWithTenantId', async () => {
      const { service, areaPermissionRepo } = buildService();

      await service.grantAreaPermission(grantInput);

      expect(areaPermissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-a-id',
          wristbandCategoryId: 'category-1',
          areaId: 'area-1',
          validFrom: null,
          validUntil: null,
        }),
      );
    });

    test('test_grantAreaPermission_categoryNotFound_throwsNotFoundWithoutSaving', async () => {
      const categoryRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, areaPermissionRepo } = buildService({ categoryRepo });

      await expect(service.grantAreaPermission(grantInput)).rejects.toThrow(NotFoundException);
      expect(areaPermissionRepo.save).not.toHaveBeenCalled();
    });

    test('test_grantAreaPermission_areaNotFound_throwsNotFoundWithoutSaving', async () => {
      const areaRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, areaPermissionRepo } = buildService({ areaRepo });

      await expect(service.grantAreaPermission(grantInput)).rejects.toThrow(NotFoundException);
      expect(areaPermissionRepo.save).not.toHaveBeenCalled();
    });
  });

  test('test_listAreaPermissionsByCategory_returnsPermissionsForThatCategory', async () => {
    const permissions = [{ id: 'perm-1' } as WristbandCategoryAreaPermissionEntity];
    const areaPermissionRepo = createMockRepository({ findBy: jest.fn().mockResolvedValue(permissions) });
    const { service } = buildService({ areaPermissionRepo });

    await expect(service.listAreaPermissionsByCategory('category-1')).resolves.toBe(permissions);
    expect(areaPermissionRepo.findBy).toHaveBeenCalledWith({ wristbandCategoryId: 'category-1' });
  });
});
