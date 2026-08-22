import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Permission } from './permission.enum';
import { PermissionGroupService } from './permission-group.service';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';

interface RequestWithPerson {
  personId?: string;
}

// Must be chained AFTER TenantContextInterceptor (@UseInterceptors(
// TenantContextInterceptor, PermissionCheckInterceptor)) — hasPermission()
// reads through the tenant-scoped manager, which only exists once that
// interceptor's runWithTenant has started. Skips the check entirely for
// routes with no @RequirePermission decorator.
@Injectable()
export class PermissionCheckInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionGroupService: PermissionGroupService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    // getAllAndOverride: a method-level @RequirePermission wins over a
    // class-level one, so a controller can set a default and override it
    // per route — supports @RequirePermission on either the handler or the
    // whole controller (AttendanceRegisterController uses the latter).
    const requiredPermission = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermission) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithPerson>();
    if (!request.personId) {
      throw new ForbiddenException('No authenticated person on this request');
    }

    const allowed = await this.permissionGroupService.hasPermission(request.personId, requiredPermission);
    if (!allowed) {
      throw new ForbiddenException(`Missing required permission: ${requiredPermission}`);
    }

    return next.handle();
  }
}
