// Shared mocking helper for unit specs covering guards/interceptors
// (JwtAuthGuard, PermissionCheckInterceptor, ...), which all read the
// request through ExecutionContext.switchToHttp().getRequest() and resolve
// route metadata through getHandler()/getClass().

import { ExecutionContext } from '@nestjs/common';

export function createMockExecutionContext(
  request: Record<string, unknown>,
  handler: (...args: never[]) => unknown = () => undefined,
  controllerClass: new (...args: never[]) => unknown = class {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => controllerClass,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getContext: () => undefined, getData: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined, getPattern: () => undefined }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}
