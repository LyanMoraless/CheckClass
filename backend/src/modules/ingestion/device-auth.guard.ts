import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DeviceAuthService } from './device-auth.service';

const AUTH_SCHEME = 'ApiKey ';

export interface DeviceAuthenticatedRequest extends Request {
  deviceId: string;
  tenantId: string;
}

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly deviceAuthService: DeviceAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeviceAuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith(AUTH_SCHEME)) {
      throw new UnauthorizedException('Missing device credentials');
    }

    const { deviceId, tenantId } = await this.deviceAuthService.authenticate(header.slice(AUTH_SCHEME.length).trim());
    request.deviceId = deviceId;
    request.tenantId = tenantId;
    return true;
  }
}
