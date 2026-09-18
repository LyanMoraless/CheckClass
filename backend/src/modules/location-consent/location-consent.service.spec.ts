import { ConflictException, ForbiddenException } from '@nestjs/common';
import { LocationConsentDecisionEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { LocationConsentService } from './location-consent.service';

// RULE-PRES-14/15 — "Implementação — location-verification e
// location-consent" (architecture-overview.md).
describe('LocationConsentService', () => {
  function buildService(options: {
    decisionRepo?: MockRepository;
    locationConsentSuspension?: { getLatestDecision: jest.Mock };
    personMinorityStatus?: { assertSensitiveConsentGateOpen: jest.Mock; getStatus: jest.Mock };
  } = {}) {
    const decisionRepo = options.decisionRepo ?? createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-1' }) });
    const manager = createMockEntityManager(new Map<unknown, MockRepository>([[LocationConsentDecisionEntity, decisionRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const locationConsentSuspension = options.locationConsentSuspension ?? { getLatestDecision: jest.fn().mockResolvedValue(null) };
    const personMinorityStatus = options.personMinorityStatus ?? {
      assertSensitiveConsentGateOpen: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockResolvedValue({ isMinor: false }),
    };

    const service = new LocationConsentService(tenantContext as never, locationConsentSuspension as never, personMinorityStatus as never);
    return { service, decisionRepo, locationConsentSuspension, personMinorityStatus };
  }

  describe('getActiveConsent/hasActiveConsent', () => {
    test('test_getActiveConsent_delegatesToLocationConsentSuspensionGetLatestDecision', async () => {
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'granted' }) };
      const { service } = buildService({ locationConsentSuspension });

      const result = await service.getActiveConsent('student-1');

      expect(locationConsentSuspension.getLatestDecision).toHaveBeenCalledWith('student-1');
      expect(result).toEqual({ id: 'decision-1', decision: 'granted' });
    });

    test('test_hasActiveConsent_latestIsGranted_returnsTrue', async () => {
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue({ decision: 'granted' }) };
      const { service } = buildService({ locationConsentSuspension });

      expect(await service.hasActiveConsent('student-1')).toBe(true);
    });

    test('test_hasActiveConsent_latestIsRefused_returnsFalse', async () => {
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue({ decision: 'refused' }) };
      const { service } = buildService({ locationConsentSuspension });

      expect(await service.hasActiveConsent('student-1')).toBe(false);
    });

    test('test_hasActiveConsent_noDecisionAtAll_returnsFalse', async () => {
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue(null) };
      const { service } = buildService({ locationConsentSuspension });

      expect(await service.hasActiveConsent('student-1')).toBe(false);
    });

    // RULE-PRES-14: revocation has the SAME blocking consequence as refusal
    // (both route the student to RULE-PRES-15's caminho alternativo) — only
    // 'granted' ever counts as active. Previously only 'refused' was covered
    // here; 'revoked' is a distinct decision value with its own code path
    // (revokeForSelf/revokeByGuardian) and deserves its own assertion.
    test('test_hasActiveConsent_latestIsRevoked_returnsFalse', async () => {
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue({ decision: 'revoked' }) };
      const { service } = buildService({ locationConsentSuspension });

      expect(await service.hasActiveConsent('student-1')).toBe(false);
    });
  });

  describe('grantForSelf', () => {
    test('test_grantForSelf_gateOpenAndAdult_insertsGrantedDecisionDecidedByPerson', async () => {
      const decisionRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-1' }) });
      const { service } = buildService({ decisionRepo });

      await service.grantForSelf('student-1', 'v1');

      expect(decisionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectPersonId: 'student-1',
          decidedByType: 'person',
          decidedByPersonId: 'student-1',
          decidedByLegalGuardianId: null,
          decision: 'granted',
          consentVersion: 'v1',
        }),
      );
    });

    test('test_grantForSelf_gateBlocked_propagatesAndNeverInserts', async () => {
      const personMinorityStatus = {
        assertSensitiveConsentGateOpen: jest.fn().mockRejectedValue(new ForbiddenException('blocked')),
        getStatus: jest.fn(),
      };
      const decisionRepo = createMockRepository();
      const { service } = buildService({ personMinorityStatus, decisionRepo });

      await expect(service.grantForSelf('student-1', 'v1')).rejects.toThrow(ForbiddenException);
      expect(decisionRepo.save).not.toHaveBeenCalled();
    });

    test('test_grantForSelf_confirmedMinor_throwsForbiddenAndNeverInserts', async () => {
      const personMinorityStatus = {
        assertSensitiveConsentGateOpen: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockResolvedValue({ isMinor: true }),
      };
      const decisionRepo = createMockRepository();
      const { service } = buildService({ personMinorityStatus, decisionRepo });

      await expect(service.grantForSelf('student-1', 'v1')).rejects.toThrow(ForbiddenException);
      expect(decisionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('refuseForSelf', () => {
    test('test_refuseForSelf_neverConsultsMinorityStatus_insertsRefusedDecision', async () => {
      const decisionRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-1' }) });
      const personMinorityStatus = { assertSensitiveConsentGateOpen: jest.fn(), getStatus: jest.fn() };
      const { service } = buildService({ decisionRepo, personMinorityStatus });

      await service.refuseForSelf('student-1', 'v1');

      expect(personMinorityStatus.assertSensitiveConsentGateOpen).not.toHaveBeenCalled();
      expect(personMinorityStatus.getStatus).not.toHaveBeenCalled();
      expect(decisionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ subjectPersonId: 'student-1', decidedByType: 'person', decision: 'refused', consentVersion: 'v1' }),
      );
    });
  });

  describe('revokeForSelf', () => {
    test('test_revokeForSelf_noActiveGrantedConsent_throwsConflictWithoutInserting', async () => {
      const decisionRepo = createMockRepository();
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue(null) };
      const { service } = buildService({ decisionRepo, locationConsentSuspension });

      await expect(service.revokeForSelf('student-1')).rejects.toThrow(ConflictException);
      expect(decisionRepo.save).not.toHaveBeenCalled();
    });

    test('test_revokeForSelf_latestIsAlreadyRefused_throwsConflict', async () => {
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue({ decision: 'refused', consentVersion: 'v1' }) };
      const { service } = buildService({ locationConsentSuspension });

      await expect(service.revokeForSelf('student-1')).rejects.toThrow(ConflictException);
    });

    test('test_revokeForSelf_hasActiveGrantedConsent_insertsRevokedCarryingForwardConsentVersion', async () => {
      const decisionRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-2' }) });
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue({ decision: 'granted', consentVersion: 'v2' }) };
      const { service } = buildService({ decisionRepo, locationConsentSuspension });

      await service.revokeForSelf('student-1');

      expect(decisionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectPersonId: 'student-1',
          decidedByType: 'person',
          decidedByPersonId: 'student-1',
          decision: 'revoked',
          consentVersion: 'v2',
        }),
      );
    });
  });

  describe('grantByGuardian/refuseByGuardian', () => {
    test('test_grantByGuardian_neverConsultsMinorityStatus_insertsGrantedDecidedByLegalGuardian', async () => {
      const decisionRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-1' }) });
      const personMinorityStatus = { assertSensitiveConsentGateOpen: jest.fn(), getStatus: jest.fn() };
      const { service } = buildService({ decisionRepo, personMinorityStatus });

      await service.grantByGuardian('student-1', 'guardian-1', 'v1');

      expect(personMinorityStatus.assertSensitiveConsentGateOpen).not.toHaveBeenCalled();
      expect(decisionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectPersonId: 'student-1',
          decidedByType: 'legal_guardian',
          decidedByPersonId: null,
          decidedByLegalGuardianId: 'guardian-1',
          decision: 'granted',
          consentVersion: 'v1',
        }),
      );
    });

    test('test_refuseByGuardian_insertsRefusedDecidedByLegalGuardian', async () => {
      const decisionRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-1' }) });
      const { service } = buildService({ decisionRepo });

      await service.refuseByGuardian('student-1', 'guardian-1', 'v1');

      expect(decisionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ subjectPersonId: 'student-1', decidedByType: 'legal_guardian', decidedByLegalGuardianId: 'guardian-1', decision: 'refused' }),
      );
    });
  });

  describe('revokeByGuardian', () => {
    test('test_revokeByGuardian_noActiveGrantedConsent_throwsConflict', async () => {
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue(null) };
      const { service } = buildService({ locationConsentSuspension });

      await expect(service.revokeByGuardian('student-1', 'guardian-1')).rejects.toThrow(ConflictException);
    });

    test('test_revokeByGuardian_hasActiveGrantedConsent_insertsRevokedDecidedByLegalGuardian', async () => {
      const decisionRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-2' }) });
      const locationConsentSuspension = { getLatestDecision: jest.fn().mockResolvedValue({ decision: 'granted', consentVersion: 'v3' }) };
      const { service } = buildService({ decisionRepo, locationConsentSuspension });

      await service.revokeByGuardian('student-1', 'guardian-1');

      expect(decisionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectPersonId: 'student-1',
          decidedByType: 'legal_guardian',
          decidedByPersonId: null,
          decidedByLegalGuardianId: 'guardian-1',
          decision: 'revoked',
          consentVersion: 'v3',
        }),
      );
    });
  });
});
