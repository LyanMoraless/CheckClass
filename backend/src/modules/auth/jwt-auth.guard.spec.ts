import { UnauthorizedException } from '@nestjs/common';
import { createMockExecutionContext } from '../../../test/unit/support/mock-execution-context';
import { AuthenticatedRequest, JwtAuthGuard, JwtPayload } from './jwt-auth.guard';

// Verifies the session JWT issued by POST /v1/auth/login (AuthController).
// The guard's only job is identity resolution — no permission checks here
// (that's PermissionCheckInterceptor, chained separately).
describe('JwtAuthGuard', () => {
  function buildGuard(verify: jest.Mock) {
    const jwtService = { verify };
    const guard = new JwtAuthGuard(jwtService as never);
    return { guard, jwtService };
  }

  function requestWithHeader(headerValue: string | undefined): AuthenticatedRequest {
    return { headers: { authorization: headerValue } } as unknown as AuthenticatedRequest;
  }

  test('test_canActivate_validBearerToken_attachesPersonIdAndTenantIdAndReturnsTrue', () => {
    const payload: JwtPayload = { personId: 'person-1', tenantId: 'tenant-a-id' };
    const verify = jest.fn().mockReturnValue(payload);
    const { guard } = buildGuard(verify);
    const request = requestWithHeader('Bearer a.valid.token');
    const context = createMockExecutionContext(request as unknown as Record<string, unknown>);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.personId).toBe('person-1');
    expect(request.tenantId).toBe('tenant-a-id');
    expect(verify).toHaveBeenCalledWith('a.valid.token');
  });

  test('test_canActivate_missingAuthorizationHeader_throwsUnauthorized', () => {
    const { guard } = buildGuard(jest.fn());
    const context = createMockExecutionContext(requestWithHeader(undefined) as unknown as Record<string, unknown>);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  test('test_canActivate_headerWithoutBearerPrefix_throwsUnauthorized', () => {
    const { guard, jwtService } = buildGuard(jest.fn());
    const context = createMockExecutionContext(
      requestWithHeader('a.valid.token') as unknown as Record<string, unknown>,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    // Must reject before ever calling verify() — a header with no scheme
    // prefix is malformed input, not a token worth attempting to decode.
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  test('test_canActivate_expiredToken_throwsUnauthorized', () => {
    const verify = jest.fn().mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const { guard } = buildGuard(verify);
    const context = createMockExecutionContext(
      requestWithHeader('Bearer an.expired.token') as unknown as Record<string, unknown>,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  test('test_canActivate_malformedToken_throwsUnauthorized', () => {
    const verify = jest.fn().mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const { guard } = buildGuard(verify);
    const context = createMockExecutionContext(
      requestWithHeader('Bearer not-a-real-jwt') as unknown as Record<string, unknown>,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  test('test_canActivate_wrongSecretSignature_throwsUnauthorized', () => {
    const verify = jest.fn().mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const { guard } = buildGuard(verify);
    const context = createMockExecutionContext(
      requestWithHeader('Bearer signed.with.wrong.secret') as unknown as Record<string, unknown>,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  test('test_canActivate_emptyBearerToken_throwsUnauthorized', () => {
    // "Bearer " with nothing after it — still passes the startsWith check,
    // so must be rejected by jwtService.verify() throwing on an empty string,
    // not silently treated as valid.
    const verify = jest.fn().mockImplementation(() => {
      throw new Error('jwt must be provided');
    });
    const { guard } = buildGuard(verify);
    const context = createMockExecutionContext(requestWithHeader('Bearer ') as unknown as Record<string, unknown>);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
