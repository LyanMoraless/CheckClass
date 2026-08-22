import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

const AUTH_SCHEME = 'Bearer ';

export interface JwtPayload {
  personId: string;
  tenantId: string;
}

export interface AuthenticatedRequest extends Request {
  personId: string;
  tenantId: string;
}

// Verifies the session JWT issued by POST /v1/auth/login (AuthController).
// Same shape as DeviceAuthGuard: resolves identity/tenant from the
// credential and attaches it to the request, for TenantContextInterceptor
// to pick up next.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith(AUTH_SCHEME)) {
      throw new UnauthorizedException('Missing session token');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(header.slice(AUTH_SCHEME.length).trim());
      request.personId = payload.personId;
      request.tenantId = payload.tenantId;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session token');
    }
  }
}
