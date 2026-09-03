import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { firstValueFrom, from, Observable } from 'rxjs';
import { ExamRlsContextService } from './exam-rls-context.service';

interface RequestWithPerson {
  personId?: string;
}

// Sets app.person_id for every student-scoped exam request, which is what
// makes the ownership half of the RLS policies match any row at all (see
// AddExamArea migration and ExamRlsContextService).
//
// MUST be declared AFTER TenantContextInterceptor in @UseInterceptors:
// interceptors nest in declaration order, so this one runs inside the
// transaction that carries app.tenant_id — a set_config outside it would be
// applied to a pooled connection at random.
//
// personId comes exclusively from request.personId, set by JwtAuthGuard from
// the verified JWT — same idiom as MeController, and the reason the student
// endpoints never accept a personId parameter.
@Injectable()
export class ExamStudentScopeInterceptor implements NestInterceptor {
  constructor(private readonly examRlsContext: ExamRlsContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithPerson>();
    if (!request.personId) {
      throw new Error('ExamStudentScopeInterceptor requires request.personId to already be set by JwtAuthGuard');
    }

    const personId = request.personId;
    return from(
      this.examRlsContext.applyStudentScope(personId).then(() => firstValueFrom(next.handle())),
    );
  }
}
