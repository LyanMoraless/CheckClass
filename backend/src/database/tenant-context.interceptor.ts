import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { firstValueFrom, from, Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

interface RequestWithTenant {
  tenantId?: string;
}

// Wraps the rest of the request pipeline in TenantContextService.runWithTenant
// so every repository call made through the tenant-scoped manager happens
// inside the same RLS-bearing transaction (RULE-TEN-01). Must run after a
// guard (e.g. DeviceAuthGuard) has already set request.tenantId.
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    if (!request.tenantId) {
      throw new Error('TenantContextInterceptor requires request.tenantId to already be set by a guard');
    }

    return from(this.tenantContext.runWithTenant(request.tenantId, () => firstValueFrom(next.handle())));
  }
}
