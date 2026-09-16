import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { createMockExecutionContext } from '../../../test/unit/support/mock-execution-context';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { LegalGuardianController } from './legal-guardian.controller';

describe('LegalGuardianController', () => {
  function buildController(findByIdResult: unknown) {
    const legalGuardianService = {
      create: jest.fn().mockResolvedValue({ id: 'guardian-1' }),
      listByStudent: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(findByIdResult),
      update: jest.fn().mockResolvedValue({ id: 'guardian-1' }),
      revoke: jest.fn().mockResolvedValue({ id: 'guardian-1', status: 'revoked' }),
    };
    const controller = new LegalGuardianController(legalGuardianService as never);
    const request = { personId: 'staff-1' } as AuthenticatedRequest;
    return { controller, legalGuardianService, request };
  }

  describe('update', () => {
    test('test_update_guardianBelongsToRouteStudent_delegatesToService', async () => {
      const { controller, legalGuardianService } = buildController({ id: 'guardian-1', studentPersonId: 'student-1' });

      await controller.update('student-1', 'guardian-1', { fullName: 'New Name' });

      expect(legalGuardianService.update).toHaveBeenCalledWith('guardian-1', { fullName: 'New Name' });
    });

    test('test_update_guardianDoesNotExist_throwsNotFoundWithoutCallingService', async () => {
      const { controller, legalGuardianService } = buildController(null);

      await expect(controller.update('student-1', 'missing', { fullName: 'New Name' })).rejects.toThrow(NotFoundException);
      expect(legalGuardianService.update).not.toHaveBeenCalled();
    });

    test('test_update_guardianBelongsToAnotherStudent_throwsSameNotFoundWithoutCallingService', async () => {
      // Integrity check: never disclose that guardianId exists for a
      // different :personId — same 404 as "does not exist at all".
      const { controller, legalGuardianService } = buildController({ id: 'guardian-1', studentPersonId: 'other-student' });

      await expect(controller.update('student-1', 'guardian-1', { fullName: 'New Name' })).rejects.toThrow(NotFoundException);
      expect(legalGuardianService.update).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    test('test_revoke_guardianBelongsToRouteStudent_delegatesToServiceWithJwtPersonId', async () => {
      const { controller, legalGuardianService, request } = buildController({ id: 'guardian-1', studentPersonId: 'student-1' });

      await controller.revoke('student-1', 'guardian-1', request);

      expect(legalGuardianService.revoke).toHaveBeenCalledWith('guardian-1', 'staff-1');
    });

    test('test_revoke_guardianDoesNotExist_throwsNotFoundWithoutCallingService', async () => {
      const { controller, legalGuardianService, request } = buildController(null);

      await expect(controller.revoke('student-1', 'missing', request)).rejects.toThrow(NotFoundException);
      expect(legalGuardianService.revoke).not.toHaveBeenCalled();
    });

    test('test_revoke_guardianBelongsToAnotherStudent_throwsSameNotFoundWithoutCallingService', async () => {
      const { controller, legalGuardianService, request } = buildController({ id: 'guardian-1', studentPersonId: 'other-student' });

      await expect(controller.revoke('student-1', 'guardian-1', request)).rejects.toThrow(NotFoundException);
      expect(legalGuardianService.revoke).not.toHaveBeenCalled();
    });
  });

  describe('registeredByPersonId/revokedByPersonId always come from the JWT, never the body', () => {
    test('test_create_usesJwtPersonIdAsRegisteredBy_ignoringAnyBodyValue', async () => {
      const { controller, legalGuardianService, request } = buildController(undefined);

      await controller.create('student-1', { fullName: 'Maria Silva', documentNumber: '12345678900' } as never, request);

      expect(legalGuardianService.create).toHaveBeenCalledWith({
        studentPersonId: 'student-1',
        fullName: 'Maria Silva',
        documentNumber: '12345678900',
        registeredByPersonId: 'staff-1',
      });
    });
  });

  // "ator sem MANAGE_USERS recebe 403" — real class, resolved through a real
  // Reflector, same pattern already used in permission-check.interceptor.spec.ts
  // for the other Secretaria-exclusive controllers in this codebase.
  describe('MANAGE_USERS allowlist (via PermissionCheckInterceptor)', () => {
    function buildInterceptor(hasPermission: jest.Mock) {
      const permissionGroupService = { hasPermission };
      return new PermissionCheckInterceptor(new Reflector(), permissionGroupService as never);
    }

    function buildCallHandler() {
      return { handle: jest.fn().mockReturnValue(of('handler-result')) };
    }

    test('test_intercept_callerLacksManageUsers_throwsForbiddenAndNeverCallsHandler', async () => {
      const interceptor = buildInterceptor(jest.fn().mockResolvedValue(false));
      const next = buildCallHandler();
      const context = createMockExecutionContext({ personId: 'person-1' }, LegalGuardianController.prototype.create, LegalGuardianController);

      await expect(interceptor.intercept(context, next)).rejects.toThrow(ForbiddenException);
      expect(next.handle).not.toHaveBeenCalled();
    });

    test('test_intercept_callerHoldsManageUsers_callsHandler', async () => {
      const hasPermission = jest.fn().mockResolvedValue(true);
      const interceptor = buildInterceptor(hasPermission);
      const next = buildCallHandler();
      const context = createMockExecutionContext({ personId: 'person-1' }, LegalGuardianController.prototype.create, LegalGuardianController);

      await interceptor.intercept(context, next);

      expect(hasPermission).toHaveBeenCalledWith('person-1', Permission.MANAGE_USERS);
      expect(next.handle).toHaveBeenCalled();
    });
  });
});
