import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DeviceAuthService } from './device-auth.service';
import { REQUIRED_DEVICE_TYPE_KEY } from './require-device-type.decorator';

const AUTH_SCHEME = 'ApiKey ';

export interface DeviceAuthenticatedRequest extends Request {
  deviceId: string;
  tenantId: string;
  deviceType: string;
}

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly deviceAuthService: DeviceAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeviceAuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith(AUTH_SCHEME)) {
      throw new UnauthorizedException('Missing device credentials');
    }

    const { deviceId, tenantId, deviceType } = await this.deviceAuthService.authenticate(
      header.slice(AUTH_SCHEME.length).trim(),
    );

    // getAllAndOverride, same idiom as PermissionCheckInterceptor: a
    // method-level @RequireDeviceType wins over a class-level one. A route
    // with no @RequireDeviceType at all skips the check — but every
    // device-authenticated controller in this codebase is expected to
    // declare one (IngestionController, SecurityIngestionController), so
    // the absence of metadata here is not treated as "allow any type".
    const requiredDeviceTypes = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_DEVICE_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredDeviceTypes && requiredDeviceTypes.length > 0 && !requiredDeviceTypes.includes(deviceType)) {
      throw new ForbiddenException(`Device type '${deviceType}' is not allowed on this endpoint`);
    }

    request.deviceId = deviceId;
    request.tenantId = tenantId;
    request.deviceType = deviceType;
    return true;
  }
}
