import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { firstValueFrom, from, Observable } from 'rxjs';
import { AbsenceJustificationRlsContextService } from './absence-justification-rls-context.service';

interface RequestWithPerson {
  personId?: string;
}

// Sets app.person_id for EVERY request reaching this module's controllers —
// see AbsenceJustificationRlsContextService for why one GUC covers both the
// student and the professor path here (unlike the Exam Area's split between
// applyStudentScope/applyManagementScope). MUST be declared AFTER
// TenantContextInterceptor (@UseInterceptors nests in declaration order), so
// this runs inside the transaction that already carries app.tenant_id — same
// requirement ExamStudentScopeInterceptor documents for its own module.
//
// personId comes exclusively from request.personId, set by JwtAuthGuard from
// the verified JWT — never from a route/query/body param, for either role.
@Injectable()
export class AbsenceJustificationPersonScopeInterceptor implements NestInterceptor {
  constructor(private readonly rlsContext: AbsenceJustificationRlsContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithPerson>();
    if (!request.personId) {
      throw new Error(
        'AbsenceJustificationPersonScopeInterceptor requires request.personId to already be set by JwtAuthGuard',
      );
    }

    const personId = request.personId;
    return from(this.rlsContext.applyPersonScope(personId).then(() => firstValueFrom(next.handle())));
  }
}
