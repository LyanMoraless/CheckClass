import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { firstValueFrom, from, Observable } from 'rxjs';
import { AbsenceJustificationAreaGateService } from './absence-justification-area-gate.service';

// RULE-JUST-10, enforced at the door of every route in this module, same
// "gate before anything else runs" idiom TenantContextInterceptor and
// AbsenceJustificationPersonScopeInterceptor already use here. MUST be
// declared AFTER TenantContextInterceptor (@UseInterceptors nests in
// declaration order) — assertAreaEnabled() reads through the tenant-scoped
// manager TenantContextInterceptor sets up. Declared BEFORE
// AbsenceJustificationPersonScopeInterceptor on purpose: no reason to pay
// for setting app.person_id on a request this gate is about to reject.
@Injectable()
export class AbsenceJustificationAreaGateInterceptor implements NestInterceptor {
  constructor(private readonly areaGate: AbsenceJustificationAreaGateService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.areaGate.assertAreaEnabled().then(() => firstValueFrom(next.handle())));
  }
}
