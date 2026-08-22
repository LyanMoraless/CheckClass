import { NotFoundException } from '@nestjs/common';
import {
  PermissionGroupEntity,
  PermissionGroupPermissionEntity,
  PersonEntity,
  PersonPermissionGroupEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { Permission } from './permission.enum';
import { PermissionGroupService } from './permission-group.service';

// Institution-defined permission groups (confirmed 2026-08-22) — coexist
// with, don't replace, RULE-ATT-12's leadership chain for pending-review
// resolution. Covers general institutional management instead.
describe('PermissionGroupService', () => {
  function buildService(options: {
    permissionGroupRepo?: MockRepository;
    personRepo?: MockRepository;
    personGroupRepo?: MockRepository;
    countResult?: number;
    queryRows?: unknown[];
  }) {
    const permissionGroupRepo =
      options.permissionGroupRepo ??
      createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'group-1' }) });
    const permissionRepo = createMockRepository();
    const personRepo =
      options.personRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'person-1' }) });
    const personGroupRepo = options.personGroupRepo ?? createMockRepository();

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [PermissionGroupEntity, permissionGroupRepo],
      [PermissionGroupPermissionEntity, permissionRepo],
      [PersonEntity, personRepo],
      [PersonPermissionGroupEntity, personGroupRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    manager.query.mockResolvedValue(options.queryRows ?? [{ count: String(options.countResult ?? 0) }]);
    const tenantContext = createMockTenantContext(manager);
    const service = new PermissionGroupService(tenantContext as never);
    return { service, permissionGroupRepo, permissionRepo, personRepo, personGroupRepo, manager };
  }

  test('test_createGroup_savesGroupAndEveryRequestedPermission', async () => {
    const permissionGroupRepo = createMockRepository({
      save: jest.fn().mockResolvedValue({ id: 'group-1' }),
    });
    const { service, permissionRepo } = buildService({ permissionGroupRepo });

    await service.createGroup('Secretaria', [Permission.MANAGE_USERS]);

    expect(permissionRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ permissionGroupId: 'group-1', permissionCode: Permission.MANAGE_USERS }),
    ]);
  });

  test('test_createGroup_noPermissions_savesGroupWithoutTouchingPermissionRepo', async () => {
    const permissionGroupRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'group-1' }) });
    const { service, permissionRepo } = buildService({ permissionGroupRepo });

    await service.createGroup('Empty Group', []);

    expect(permissionRepo.save).not.toHaveBeenCalled();
  });

  test('test_assignPersonToGroup_notAlreadyMember_savesNewMembership', async () => {
    const { service, personGroupRepo } = buildService({});

    await service.assignPersonToGroup('person-1', 'group-1');

    expect(personGroupRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'person-1', permissionGroupId: 'group-1' }),
    );
  });

  test('test_assignPersonToGroup_alreadyMember_isNoOp', async () => {
    const personGroupRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'existing-membership' }),
    });
    const { service } = buildService({ personGroupRepo });

    await service.assignPersonToGroup('person-1', 'group-1');

    expect(personGroupRepo.save).not.toHaveBeenCalled();
  });

  test('test_assignPersonToGroup_personNotFound_throwsNotFound', async () => {
    // Security/code-review finding: personId was previously never checked
    // against the caller's own tenant — findOneBy through the RLS-scoped
    // manager naturally returns nothing for a cross-tenant id.
    const personRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ personRepo });

    await expect(service.assignPersonToGroup('person-1', 'group-1')).rejects.toThrow(NotFoundException);
  });

  test('test_assignPersonToGroup_groupNotFound_throwsNotFound', async () => {
    const permissionGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ permissionGroupRepo });

    await expect(service.assignPersonToGroup('person-1', 'group-1')).rejects.toThrow(NotFoundException);
  });

  test('test_hasPermission_matchingGroupMembership_returnsTrue', async () => {
    const { service } = buildService({ countResult: 1 });

    const result = await service.hasPermission('person-1', Permission.MANAGE_USERS);

    expect(result).toBe(true);
  });

  test('test_hasPermission_noMatchingGroupMembership_returnsFalse', async () => {
    const { service } = buildService({ countResult: 0 });

    const result = await service.hasPermission('person-1', Permission.MANAGE_USERS);

    expect(result).toBe(false);
  });

  test('test_getPermissionsForPerson_returnsDistinctPermissionCodesAcrossAllTheirGroups', async () => {
    const { service } = buildService({
      queryRows: [{ permission_code: Permission.MANAGE_USERS }, { permission_code: Permission.VIEW_ATTENDANCE_REGISTER }],
    });

    const result = await service.getPermissionsForPerson('person-1');

    expect(result).toEqual([Permission.MANAGE_USERS, Permission.VIEW_ATTENDANCE_REGISTER]);
  });

  test('test_getPermissionsForPerson_noGroups_returnsEmptyArray', async () => {
    const { service } = buildService({ queryRows: [] });

    const result = await service.getPermissionsForPerson('person-1');

    expect(result).toEqual([]);
  });
});
