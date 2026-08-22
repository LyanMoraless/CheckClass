import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedRequest } from './jwt-auth.guard';
import { Permission } from './permission.enum';
import { PermissionGroupController } from './permission-group.controller';

// Security review finding: MANAGE_USERS alone must not let a caller grant
// permissions they don't themselves hold (self-escalation to full admin via
// group creation). This is real branching logic in the controller, not just
// pass-through to the service, so it earns its own test unlike the other
// thin controllers in this module.
describe('PermissionGroupController', () => {
  function buildController(ownPermissions: Permission[]) {
    const permissionGroupService = {
      getPermissionsForPerson: jest.fn().mockResolvedValue(ownPermissions),
      createGroup: jest.fn().mockResolvedValue({ id: 'new-group-1' }),
      assignPersonToGroup: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PermissionGroupController(permissionGroupService as never);
    const request = { personId: 'caller-1' } as AuthenticatedRequest;
    return { controller, permissionGroupService, request };
  }

  test('test_create_requestedPermissionsAllOwnedByCaller_createsGroup', async () => {
    const { controller, permissionGroupService, request } = buildController([
      Permission.MANAGE_USERS,
      Permission.VIEW_ATTENDANCE_REGISTER,
    ]);

    const result = await controller.create({ name: 'Viewer', permissions: [Permission.VIEW_ATTENDANCE_REGISTER] }, request);

    expect(permissionGroupService.createGroup).toHaveBeenCalledWith('Viewer', [Permission.VIEW_ATTENDANCE_REGISTER]);
    expect(result).toEqual({ permissionGroupId: 'new-group-1' });
  });

  test('test_create_requestedPermissionNotOwnedByCaller_throwsForbiddenWithoutCreatingGroup', async () => {
    const { controller, permissionGroupService, request } = buildController([Permission.MANAGE_USERS]);

    await expect(
      controller.create({ name: 'Escalated', permissions: [Permission.CONFIGURE_ATTENDANCE_RULES] }, request),
    ).rejects.toThrow(ForbiddenException);
    expect(permissionGroupService.createGroup).not.toHaveBeenCalled();
  });

  test('test_create_callerOwnsNoPermissions_cannotCreateAnyGroupWithPermissions', async () => {
    const { controller, request } = buildController([]);

    await expect(controller.create({ name: 'Anything', permissions: [Permission.MANAGE_USERS] }, request)).rejects.toThrow(
      ForbiddenException,
    );
  });

  test('test_create_emptyPermissionsRequested_alwaysAllowedRegardlessOfCallerPermissions', async () => {
    const { controller, permissionGroupService, request } = buildController([]);

    await controller.create({ name: 'Empty', permissions: [] }, request);

    expect(permissionGroupService.createGroup).toHaveBeenCalledWith('Empty', []);
  });
});
