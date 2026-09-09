import { of } from 'rxjs';
import { createMockExecutionContext } from '../../../test/unit/support/mock-execution-context';
import { AbsenceJustificationPersonScopeInterceptor } from './absence-justification-person-scope.interceptor';

// RULE-ATT-15/MeController idiom: personId always comes from request.personId
// (set by JwtAuthGuard from the verified JWT), never from a route/query/body
// param, for either the student or the professor side of this module. This
// interceptor is the single place that idiom is enforced for the whole
// module — a bug here (skipping the GUC, or running it AFTER the handler)
// would silently widen RLS or leak app.person_id from the previous pooled
// request.
describe('AbsenceJustificationPersonScopeInterceptor', () => {
  function buildInterceptor(applyPersonScope: jest.Mock = jest.fn().mockResolvedValue(undefined)) {
    const rlsContext = { applyPersonScope };
    const interceptor = new AbsenceJustificationPersonScopeInterceptor(rlsContext as never);
    return { interceptor, rlsContext };
  }

  function buildCallHandler(callOrder?: string[]) {
    return {
      handle: jest.fn().mockImplementation(() => {
        callOrder?.push('handle');
        return of('handler-result');
      }),
    };
  }

  test('test_intercept_personIdPresent_appliesPersonScopeThenCallsNext', async () => {
    const { interceptor, rlsContext } = buildInterceptor();
    const next = buildCallHandler();
    const context = createMockExecutionContext({ personId: 'student-1' });

    const result$ = interceptor.intercept(context, next);
    const result = await new Promise((resolve) => (result$ as unknown as { subscribe: (cb: (v: unknown) => void) => void }).subscribe(resolve));

    expect(rlsContext.applyPersonScope).toHaveBeenCalledWith('student-1');
    expect(next.handle).toHaveBeenCalled();
    expect(result).toBe('handler-result');
  });

  // The GUC must be set BEFORE the handler (and any repository/query call it
  // makes) runs — never after, which would let the handler's first queries
  // execute under whatever app.person_id the pooled connection happened to
  // carry from a previous, unrelated request.
  test('test_intercept_personIdPresent_appliesPersonScopeBeforeHandlerRuns', async () => {
    const callOrder: string[] = [];
    const applyPersonScope = jest.fn().mockImplementation(async () => {
      callOrder.push('applyPersonScope');
    });
    const { interceptor } = buildInterceptor(applyPersonScope);
    const next = buildCallHandler(callOrder);
    const context = createMockExecutionContext({ personId: 'student-1' });

    const result$ = interceptor.intercept(context, next);
    await new Promise((resolve) => (result$ as unknown as { subscribe: (cb: (v: unknown) => void) => void }).subscribe(resolve));

    expect(callOrder).toEqual(['applyPersonScope', 'handle']);
  });

  // JwtAuthGuard should always run first and set personId — but if it's ever
  // missing at this point, fail closed (loudly) rather than silently running
  // the handler with no app.person_id set at all, which would leave every
  // table's RLS policy comparing against an empty GUC.
  test('test_intercept_personIdMissing_throwsWithoutApplyingScopeOrCallingNext', () => {
    const { interceptor, rlsContext } = buildInterceptor();
    const next = buildCallHandler();
    const context = createMockExecutionContext({});

    expect(() => interceptor.intercept(context, next)).toThrow(
      'AbsenceJustificationPersonScopeInterceptor requires request.personId to already be set by JwtAuthGuard',
    );
    expect(rlsContext.applyPersonScope).not.toHaveBeenCalled();
    expect(next.handle).not.toHaveBeenCalled();
  });
});
