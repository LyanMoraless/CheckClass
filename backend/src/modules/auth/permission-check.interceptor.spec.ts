import { CallHandler, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { createMockExecutionContext } from '../../../test/unit/support/mock-execution-context';
import { PermissionCheckInterceptor } from './permission-check.interceptor';
import { Permission } from './permission.enum';
import { RequirePermission } from './require-permission.decorator';

// Real classes decorated with @RequirePermission, resolved through a real
// Reflector — a hand-rolled mock of getAllAndOverride could pass while
// hiding a bug in which of [handler, class] wins, which is exactly the
// behavior AttendanceRegisterController (class-level) and
// PermissionGroupController/PersonManagementController (also class-level,
// but ConfigController mixes class-level @UseInterceptors with per-method
// @RequirePermission) both depend on.
class NoMetadataController {
  handler() {
    return undefined;
  }
}

@RequirePermission(Permission.MANAGE_USERS)
class ClassLevelOnlyController {
  handlerWithoutOwnMetadata() {
    return undefined;
  }
}

class MethodLevelOverrideController {
  @RequirePermission(Permission.VIEW_ATTENDANCE_REGISTER)
  handlerWithOwnMetadata() {
    return undefined;
  }
}

describe('PermissionCheckInterceptor', () => {
  function buildInterceptor(hasPermission: jest.Mock) {
    const permissionGroupService = { hasPermission };
    const interceptor = new PermissionCheckInterceptor(new Reflector(), permissionGroupService as never);
    return { interceptor, permissionGroupService };
  }

  function buildCallHandler(): CallHandler {
    return { handle: jest.fn().mockReturnValue(of('handler-result')) };
  }

  test('test_intercept_noRequirePermissionMetadata_skipsCheckAndCallsNext', async () => {
    const { interceptor, permissionGroupService } = buildInterceptor(jest.fn());
    const next = buildCallHandler();
    const context = createMockExecutionContext(
      { personId: 'person-1' },
      NoMetadataController.prototype.handler,
      NoMetadataController,
    );

    const result$ = await interceptor.intercept(context, next);

    expect(next.handle).toHaveBeenCalled();
    expect(permissionGroupService.hasPermission).not.toHaveBeenCalled();
    await expect(result$.toPromise()).resolves.toBe('handler-result');
  });

  test('test_intercept_classLevelMetadataAndHasPermissionTrue_callsNext', async () => {
    const hasPermission = jest.fn().mockResolvedValue(true);
    const { interceptor, permissionGroupService } = buildInterceptor(hasPermission);
    const next = buildCallHandler();
    const context = createMockExecutionContext(
      { personId: 'person-1' },
      ClassLevelOnlyController.prototype.handlerWithoutOwnMetadata,
      ClassLevelOnlyController,
    );

    await interceptor.intercept(context, next);

    expect(permissionGroupService.hasPermission).toHaveBeenCalledWith('person-1', Permission.MANAGE_USERS);
    expect(next.handle).toHaveBeenCalled();
  });

  test('test_intercept_classLevelMetadataAndHasPermissionFalse_throwsForbiddenAndNeverCallsNext', async () => {
    const hasPermission = jest.fn().mockResolvedValue(false);
    const { interceptor } = buildInterceptor(hasPermission);
    const next = buildCallHandler();
    const context = createMockExecutionContext(
      { personId: 'person-1' },
      ClassLevelOnlyController.prototype.handlerWithoutOwnMetadata,
      ClassLevelOnlyController,
    );

    await expect(interceptor.intercept(context, next)).rejects.toThrow(ForbiddenException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  test('test_intercept_methodLevelMetadataOverridesAbsentClassLevel_usesMethodPermission', async () => {
    // MethodLevelOverrideController has no class-level @RequirePermission at
    // all — this exercises the other half of getAllAndOverride: a
    // method-level decorator resolving correctly on its own, not just
    // "overriding" a class-level one.
    const hasPermission = jest.fn().mockResolvedValue(true);
    const { interceptor, permissionGroupService } = buildInterceptor(hasPermission);
    const next = buildCallHandler();
    const context = createMockExecutionContext(
      { personId: 'person-1' },
      MethodLevelOverrideController.prototype.handlerWithOwnMetadata,
      MethodLevelOverrideController,
    );

    await interceptor.intercept(context, next);

    expect(permissionGroupService.hasPermission).toHaveBeenCalledWith(
      'person-1',
      Permission.VIEW_ATTENDANCE_REGISTER,
    );
    expect(next.handle).toHaveBeenCalled();
  });

  test('test_intercept_metadataPresentButNoPersonIdOnRequest_throwsForbiddenWithoutCallingHasPermission', async () => {
    // Edge case: JwtAuthGuard should always run first and set personId, but
    // if it's ever missing at this point, fail closed rather than passing
    // undefined into hasPermission().
    const hasPermission = jest.fn();
    const { interceptor } = buildInterceptor(hasPermission);
    const next = buildCallHandler();
    const context = createMockExecutionContext(
      {},
      ClassLevelOnlyController.prototype.handlerWithoutOwnMetadata,
      ClassLevelOnlyController,
    );

    await expect(interceptor.intercept(context, next)).rejects.toThrow(ForbiddenException);
    expect(hasPermission).not.toHaveBeenCalled();
    expect(next.handle).not.toHaveBeenCalled();
  });
});
