import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createMockExecutionContext } from '../../../test/unit/support/mock-execution-context';
import { DeviceAuthenticatedRequest, DeviceAuthGuard } from './device-auth.guard';
import { RequireDeviceType } from './require-device-type.decorator';

// @RequireDeviceType's enforcement point: device_type moved from purely
// descriptive metadata to an enforced capability boundary, so a leaked
// attendance-reader API key can no longer authenticate against the
// security-ingestion gateway, and vice versa. Uses a real Reflector (same
// idiom as PermissionCheckInterceptor's spec) rather than a hand-rolled
// mock, so a bug in which of [handler, class] wins would actually be caught.
class NoDeviceTypeMetadataController {
  handler() {
    return undefined;
  }
}

@RequireDeviceType('ir_barrier', 'area_reader')
class ClassLevelDeviceTypeController {
  handlerWithoutOwnMetadata() {
    return undefined;
  }
}

describe('DeviceAuthGuard', () => {
  function buildGuard(authenticate: jest.Mock) {
    const deviceAuthService = { authenticate };
    const guard = new DeviceAuthGuard(deviceAuthService as never, new Reflector());
    return { guard, deviceAuthService };
  }

  function requestWithHeader(headerValue: string | undefined): DeviceAuthenticatedRequest {
    return { headers: { authorization: headerValue } } as unknown as DeviceAuthenticatedRequest;
  }

  test('test_canActivate_missingAuthorizationHeader_throwsUnauthorized', async () => {
    const { guard } = buildGuard(jest.fn());
    const context = createMockExecutionContext(
      requestWithHeader(undefined) as unknown as Record<string, unknown>,
      NoDeviceTypeMetadataController.prototype.handler,
      NoDeviceTypeMetadataController,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  test('test_canActivate_headerWithoutApiKeyPrefix_throwsUnauthorizedWithoutAuthenticating', async () => {
    const { guard, deviceAuthService } = buildGuard(jest.fn());
    const context = createMockExecutionContext(
      requestWithHeader('device-1.secret') as unknown as Record<string, unknown>,
      NoDeviceTypeMetadataController.prototype.handler,
      NoDeviceTypeMetadataController,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(deviceAuthService.authenticate).not.toHaveBeenCalled();
  });

  test('test_canActivate_noRequireDeviceTypeMetadata_skipsCheckAndAttachesDevice', async () => {
    const authenticate = jest
      .fn()
      .mockResolvedValue({ deviceId: 'device-1', tenantId: 'tenant-a-id', deviceType: 'raspberry_pi' });
    const { guard } = buildGuard(authenticate);
    const request = requestWithHeader('ApiKey device-1.secret');
    const context = createMockExecutionContext(
      request as unknown as Record<string, unknown>,
      NoDeviceTypeMetadataController.prototype.handler,
      NoDeviceTypeMetadataController,
    );

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.deviceId).toBe('device-1');
    expect(request.tenantId).toBe('tenant-a-id');
    expect(request.deviceType).toBe('raspberry_pi');
  });

  test('test_canActivate_deviceTypeMatchesRequiredList_returnsTrueAndAttachesDevice', async () => {
    const authenticate = jest
      .fn()
      .mockResolvedValue({ deviceId: 'device-2', tenantId: 'tenant-a-id', deviceType: 'ir_barrier' });
    const { guard } = buildGuard(authenticate);
    const request = requestWithHeader('ApiKey device-2.secret');
    const context = createMockExecutionContext(
      request as unknown as Record<string, unknown>,
      ClassLevelDeviceTypeController.prototype.handlerWithoutOwnMetadata,
      ClassLevelDeviceTypeController,
    );

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.deviceType).toBe('ir_barrier');
  });

  test('test_canActivate_attendanceDeviceAgainstSecurityIngestionRoute_throwsForbidden', async () => {
    // The exact cross-domain scenario this fix closes: an attendance-pipeline
    // device (raspberry_pi) presenting valid credentials must still be
    // rejected on a route that only accepts security device types.
    const authenticate = jest
      .fn()
      .mockResolvedValue({ deviceId: 'device-3', tenantId: 'tenant-a-id', deviceType: 'raspberry_pi' });
    const { guard } = buildGuard(authenticate);
    const context = createMockExecutionContext(
      requestWithHeader('ApiKey device-3.secret') as unknown as Record<string, unknown>,
      ClassLevelDeviceTypeController.prototype.handlerWithoutOwnMetadata,
      ClassLevelDeviceTypeController,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  test('test_canActivate_securityDeviceAgainstAttendanceRoute_throwsForbidden', async () => {
    // The reverse direction: a security device (area_reader) must never
    // authenticate against a route that only accepts attendance device types.
    const authenticate = jest
      .fn()
      .mockResolvedValue({ deviceId: 'device-4', tenantId: 'tenant-a-id', deviceType: 'area_reader' });
    const { guard } = buildGuard(authenticate);

    @RequireDeviceType('raspberry_pi')
    class AttendanceOnlyController {
      handler() {
        return undefined;
      }
    }

    const context = createMockExecutionContext(
      requestWithHeader('ApiKey device-4.secret') as unknown as Record<string, unknown>,
      AttendanceOnlyController.prototype.handler,
      AttendanceOnlyController,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
