import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { createMockExecutionContext } from '../../../test/unit/support/mock-execution-context';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { LocationConsentGuardianController } from './location-consent-guardian.controller';

// RULE-PRES-14 — responsável legal path, mesmo idioma de integridade de rota
// que LegalGuardianController.assertBelongsToStudent (não existe, existe
// para outro estudante, e agora também revogado — todos os três casos caem
// no mesmo 404, sem chamar o service).
describe('LocationConsentGuardianController', () => {
  function buildController(findByIdResult: unknown) {
    const locationConsentService = {
      getActiveConsent: jest.fn().mockResolvedValue({ id: 'decision-1' }),
      grantByGuardian: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'granted' }),
      refuseByGuardian: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'refused' }),
      revokeByGuardian: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'revoked' }),
    };
    const legalGuardianService = { findById: jest.fn().mockResolvedValue(findByIdResult) };
    const controller = new LocationConsentGuardianController(locationConsentService as never, legalGuardianService as never);
    return { controller, locationConsentService, legalGuardianService };
  }

  const ACTIVE_GUARDIAN = { id: 'guardian-1', studentPersonId: 'student-1', status: 'active' };

  describe('guardianId/personId integrity check (shared by all four routes)', () => {
    test('test_getConsent_guardianDoesNotExist_throwsNotFoundWithoutCallingService', async () => {
      const { controller, locationConsentService } = buildController(null);

      await expect(controller.getConsent('student-1', 'missing')).rejects.toThrow(NotFoundException);
      expect(locationConsentService.getActiveConsent).not.toHaveBeenCalled();
    });

    test('test_grant_guardianBelongsToAnotherStudent_throwsSameNotFoundWithoutCallingService', async () => {
      const { controller, locationConsentService } = buildController({ id: 'guardian-1', studentPersonId: 'other-student', status: 'active' });

      await expect(controller.grant('student-1', 'guardian-1', { consentVersion: 'v1' })).rejects.toThrow(NotFoundException);
      expect(locationConsentService.grantByGuardian).not.toHaveBeenCalled();
    });

    test('test_refuse_guardianIsRevoked_throwsNotFoundWithoutCallingService', async () => {
      const { controller, locationConsentService } = buildController({ id: 'guardian-1', studentPersonId: 'student-1', status: 'revoked' });

      await expect(controller.refuse('student-1', 'guardian-1', { consentVersion: 'v1' })).rejects.toThrow(NotFoundException);
      expect(locationConsentService.refuseByGuardian).not.toHaveBeenCalled();
    });

    test('test_revoke_guardianIsRevoked_throwsNotFoundWithoutCallingService', async () => {
      const { controller, locationConsentService } = buildController({ id: 'guardian-1', studentPersonId: 'student-1', status: 'revoked' });

      await expect(controller.revoke('student-1', 'guardian-1')).rejects.toThrow(NotFoundException);
      expect(locationConsentService.revokeByGuardian).not.toHaveBeenCalled();
    });
  });

  describe('active guardian of the route student — delegates to service', () => {
    test('test_getConsent_activeGuardianOfRouteStudent_delegatesToService', async () => {
      const { controller, locationConsentService } = buildController(ACTIVE_GUARDIAN);

      await controller.getConsent('student-1', 'guardian-1');

      expect(locationConsentService.getActiveConsent).toHaveBeenCalledWith('student-1');
    });

    test('test_grant_activeGuardianOfRouteStudent_delegatesToServiceWithConsentVersion', async () => {
      const { controller, locationConsentService } = buildController(ACTIVE_GUARDIAN);

      await controller.grant('student-1', 'guardian-1', { consentVersion: 'v1' });

      expect(locationConsentService.grantByGuardian).toHaveBeenCalledWith('student-1', 'guardian-1', 'v1');
    });

    test('test_refuse_activeGuardianOfRouteStudent_delegatesToServiceWithConsentVersion', async () => {
      const { controller, locationConsentService } = buildController(ACTIVE_GUARDIAN);

      await controller.refuse('student-1', 'guardian-1', { consentVersion: 'v1' });

      expect(locationConsentService.refuseByGuardian).toHaveBeenCalledWith('student-1', 'guardian-1', 'v1');
    });

    test('test_revoke_activeGuardianOfRouteStudent_delegatesToService', async () => {
      const { controller, locationConsentService } = buildController(ACTIVE_GUARDIAN);

      await controller.revoke('student-1', 'guardian-1');

      expect(locationConsentService.revokeByGuardian).toHaveBeenCalledWith('student-1', 'guardian-1');
    });
  });

  // "ator sem MANAGE_USERS recebe 403" — mesmo padrão real-Reflector já usado
  // em legal-guardian.controller.spec.ts para os demais controllers
  // exclusivos da Secretaria.
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
      const context = createMockExecutionContext({ personId: 'person-1' }, LocationConsentGuardianController.prototype.grant, LocationConsentGuardianController);

      await expect(interceptor.intercept(context, next)).rejects.toThrow(ForbiddenException);
      expect(next.handle).not.toHaveBeenCalled();
    });

    test('test_intercept_callerHoldsManageUsers_callsHandler', async () => {
      const hasPermission = jest.fn().mockResolvedValue(true);
      const interceptor = buildInterceptor(hasPermission);
      const next = buildCallHandler();
      const context = createMockExecutionContext({ personId: 'person-1' }, LocationConsentGuardianController.prototype.grant, LocationConsentGuardianController);

      await interceptor.intercept(context, next);

      expect(hasPermission).toHaveBeenCalledWith('person-1', Permission.MANAGE_USERS);
      expect(next.handle).toHaveBeenCalled();
    });
  });
});
