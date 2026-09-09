import { of } from 'rxjs';
import { createMockExecutionContext } from '../../../test/unit/support/mock-execution-context';
import { AbsenceJustificationAreaGateInterceptor } from './absence-justification-area-gate.interceptor';

// RULE-JUST-10, enforced at the door of every route in this module — same
// "gate before the handler runs" shape as
// AbsenceJustificationPersonScopeInterceptor's own spec.
describe('AbsenceJustificationAreaGateInterceptor', () => {
  function buildInterceptor(assertAreaEnabled: jest.Mock = jest.fn().mockResolvedValue(undefined)) {
    const areaGate = { assertAreaEnabled };
    const interceptor = new AbsenceJustificationAreaGateInterceptor(areaGate as never);
    return { interceptor, areaGate };
  }

  function buildCallHandler(callOrder?: string[]) {
    return {
      handle: jest.fn().mockImplementation(() => {
        callOrder?.push('handle');
        return of('handler-result');
      }),
    };
  }

  test('test_intercept_areaEnabled_callsGateThenNext', async () => {
    const { interceptor, areaGate } = buildInterceptor();
    const next = buildCallHandler();
    const context = createMockExecutionContext({ personId: 'student-1' });

    const result$ = interceptor.intercept(context, next);
    const result = await new Promise((resolve) => (result$ as unknown as { subscribe: (cb: (v: unknown) => void) => void }).subscribe(resolve));

    expect(areaGate.assertAreaEnabled).toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
    expect(result).toBe('handler-result');
  });

  test('test_intercept_areaEnabled_runsGateBeforeHandler', async () => {
    const callOrder: string[] = [];
    const assertAreaEnabled = jest.fn().mockImplementation(async () => {
      callOrder.push('assertAreaEnabled');
    });
    const { interceptor } = buildInterceptor(assertAreaEnabled);
    const next = buildCallHandler(callOrder);
    const context = createMockExecutionContext({ personId: 'student-1' });

    const result$ = interceptor.intercept(context, next);
    await new Promise((resolve) => (result$ as unknown as { subscribe: (cb: (v: unknown) => void) => void }).subscribe(resolve));

    expect(callOrder).toEqual(['assertAreaEnabled', 'handle']);
  });

  // RULE-JUST-10: a rejected gate must never let the handler run at all —
  // the rejection propagates out of the returned Observable instead.
  test('test_intercept_areaDisabled_rejectsWithoutCallingNext', async () => {
    const { interceptor } = buildInterceptor(jest.fn().mockRejectedValue(new Error('RULE-JUST-10')));
    const next = buildCallHandler();
    const context = createMockExecutionContext({ personId: 'student-1' });

    const result$ = interceptor.intercept(context, next);
    await expect(
      new Promise((resolve, reject) =>
        (result$ as unknown as { subscribe: (observer: { next: (v: unknown) => void; error: (e: unknown) => void }) => void }).subscribe({
          next: resolve,
          error: reject,
        }),
      ),
    ).rejects.toThrow('RULE-JUST-10');
    expect(next.handle).not.toHaveBeenCalled();
  });
});
