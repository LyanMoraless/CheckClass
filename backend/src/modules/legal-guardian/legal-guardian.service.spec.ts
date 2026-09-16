import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LegalGuardianEntity, PersonEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { GuardianLinkFollowupReason } from '../guardian-link-followup/guardian-link-followup.service';
import { LegalGuardianService } from './legal-guardian.service';

// "Decisão de arquitetura — CRUD de legal_guardian" (architecture-overview.md,
// approved 2026-09-15).
describe('LegalGuardianService', () => {
  function buildService(options: {
    personRepo?: MockRepository;
    legalGuardianRepo?: MockRepository;
    locationConsentSuspension?: { getLatestDecision: jest.Mock; suspendAndOpenFollowup: jest.Mock };
    guardianLinkFollowup?: { open: jest.Mock };
    personMinorityStatus?: { getStatus: jest.Mock };
  } = {}) {
    const personRepo = options.personRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'student-1' }) });
    const legalGuardianRepo = options.legalGuardianRepo ?? createMockRepository();
    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([
        [PersonEntity, personRepo],
        [LegalGuardianEntity, legalGuardianRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const locationConsentSuspension = options.locationConsentSuspension ?? {
      getLatestDecision: jest.fn().mockResolvedValue(null),
      suspendAndOpenFollowup: jest.fn().mockResolvedValue(undefined),
    };
    const guardianLinkFollowup = options.guardianLinkFollowup ?? { open: jest.fn().mockResolvedValue(undefined) };
    const personMinorityStatus = options.personMinorityStatus ?? { getStatus: jest.fn().mockResolvedValue({ isMinor: false }) };

    const service = new LegalGuardianService(
      tenantContext as never,
      locationConsentSuspension as never,
      guardianLinkFollowup as never,
      personMinorityStatus as never,
    );

    return { service, personRepo, legalGuardianRepo, locationConsentSuspension, guardianLinkFollowup, personMinorityStatus, manager };
  }

  describe('create', () => {
    test('test_create_studentExists_insertsLegalGuardian', async () => {
      const legalGuardianRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'guardian-1' }) });
      const { service } = buildService({ legalGuardianRepo });

      const result = await service.create({
        studentPersonId: 'student-1',
        fullName: 'Maria Silva',
        documentNumber: '12345678900',
        registeredByPersonId: 'staff-1',
      });

      expect(legalGuardianRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          studentPersonId: 'student-1',
          fullName: 'Maria Silva',
          documentNumber: '12345678900',
          registeredByPersonId: 'staff-1',
        }),
      );
      // signature_captured_at is never set at the application layer — the DB
      // default (now()) is what actually captures it.
      expect(legalGuardianRepo.save).toHaveBeenCalledWith(expect.not.objectContaining({ signatureCapturedAt: expect.anything() }));
      expect(result).toEqual({ id: 'guardian-1' });
    });

    test('test_create_studentDoesNotExist_throwsNotFound', async () => {
      const personRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, legalGuardianRepo } = buildService({ personRepo });

      await expect(
        service.create({ studentPersonId: 'missing', fullName: 'Maria Silva', documentNumber: '12345678900', registeredByPersonId: 'staff-1' }),
      ).rejects.toThrow(NotFoundException);
      expect(legalGuardianRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('listByStudent', () => {
    test('test_listByStudent_defaultsToActiveOnly', async () => {
      const legalGuardianRepo = createMockRepository({ find: jest.fn().mockResolvedValue([{ id: 'guardian-1' }]) });
      const { service } = buildService({ legalGuardianRepo });

      const result = await service.listByStudent('student-1');

      expect(legalGuardianRepo.find).toHaveBeenCalledWith({
        where: { studentPersonId: 'student-1', status: 'active' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual([{ id: 'guardian-1' }]);
    });

    test('test_listByStudent_includeRevokedTrue_dropsStatusFilter', async () => {
      const legalGuardianRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { service } = buildService({ legalGuardianRepo });

      await service.listByStudent('student-1', true);

      expect(legalGuardianRepo.find).toHaveBeenCalledWith({
        where: { studentPersonId: 'student-1' },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('update', () => {
    test('test_update_activeGuardian_updatesProvidedFieldsOnly', async () => {
      const legalGuardianRepo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOneByOrFail: jest.fn().mockResolvedValue({ id: 'guardian-1', fullName: 'New Name' }),
      });
      const { service } = buildService({ legalGuardianRepo });

      const result = await service.update('guardian-1', { fullName: 'New Name' });

      expect(legalGuardianRepo.update).toHaveBeenCalledWith({ id: 'guardian-1', status: 'active' }, { fullName: 'New Name' });
      expect(result).toEqual({ id: 'guardian-1', fullName: 'New Name' });
    });

    test('test_update_noFieldsProvided_throwsBadRequestWithoutTouchingRepository', async () => {
      const legalGuardianRepo = createMockRepository();
      const { service } = buildService({ legalGuardianRepo });

      await expect(service.update('guardian-1', {})).rejects.toThrow(BadRequestException);
      expect(legalGuardianRepo.update).not.toHaveBeenCalled();
    });

    test('test_update_doesNotExist_throwsNotFound', async () => {
      const legalGuardianRepo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        findOneBy: jest.fn().mockResolvedValue(null),
      });
      const { service } = buildService({ legalGuardianRepo });

      await expect(service.update('missing', { fullName: 'New Name' })).rejects.toThrow(NotFoundException);
    });

    test('test_update_alreadyRevoked_throwsConflictNotNotFound', async () => {
      const legalGuardianRepo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        findOneBy: jest.fn().mockResolvedValue({ id: 'guardian-1', status: 'revoked' }),
      });
      const { service } = buildService({ legalGuardianRepo });

      await expect(service.update('guardian-1', { fullName: 'New Name' })).rejects.toThrow(ConflictException);
    });
  });

  describe('revoke', () => {
    function activeGuardianRepo(overrides: Partial<MockRepository> = {}) {
      return createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOneByOrFail: jest.fn().mockResolvedValue({ id: 'guardian-1', studentPersonId: 'student-1', status: 'revoked' }),
        count: jest.fn().mockResolvedValue(1), // another active guardian remains, by default
        ...overrides,
      });
    }

    test('test_revoke_doesNotExist_throwsNotFound', async () => {
      const legalGuardianRepo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        findOneBy: jest.fn().mockResolvedValue(null),
      });
      const { service } = buildService({ legalGuardianRepo });

      await expect(service.revoke('missing', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    test('test_revoke_alreadyRevoked_throwsConflictNotNotFound', async () => {
      const legalGuardianRepo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        findOneBy: jest.fn().mockResolvedValue({ id: 'guardian-1', status: 'revoked' }),
      });
      const { service } = buildService({ legalGuardianRepo });

      await expect(service.revoke('guardian-1', 'staff-1')).rejects.toThrow(ConflictException);
    });

    test('test_revoke_neitherLatestDeciderNorLastGuardian_opensNoExtraFollowup', async () => {
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(1) });
      const locationConsentSuspension = {
        getLatestDecision: jest.fn().mockResolvedValue({ decision: 'granted', decidedByLegalGuardianId: 'someone-else' }),
        suspendAndOpenFollowup: jest.fn().mockResolvedValue(undefined),
      };
      const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
      const { service } = buildService({ legalGuardianRepo, locationConsentSuspension, guardianLinkFollowup });

      const result = await service.revoke('guardian-1', 'staff-1');

      expect(locationConsentSuspension.suspendAndOpenFollowup).not.toHaveBeenCalled();
      expect(guardianLinkFollowup.open).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'guardian-1', studentPersonId: 'student-1', status: 'revoked' });
    });

    test('test_revoke_decidedTheLatestGrantedConsent_invalidatesRetroactivelyAndOpensFollowup', async () => {
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(1) });
      const latest = { decision: 'granted', decidedByLegalGuardianId: 'guardian-1', consentVersion: 'v1' };
      const locationConsentSuspension = {
        getLatestDecision: jest.fn().mockResolvedValue(latest),
        suspendAndOpenFollowup: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = buildService({ legalGuardianRepo, locationConsentSuspension });

      await service.revoke('guardian-1', 'staff-1');

      expect(locationConsentSuspension.suspendAndOpenFollowup).toHaveBeenCalledWith({
        subjectPersonId: 'student-1',
        latest,
        reason: GuardianLinkFollowupReason.LEGAL_GUARDIAN_REVOKED_LOCATION_CONSENT_INVALIDATED,
        triggeredByPersonId: 'staff-1',
      });
    });

    test('test_revoke_consentGrantedByADifferentGuardian_doesNotInvalidate', async () => {
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(1) });
      const locationConsentSuspension = {
        getLatestDecision: jest.fn().mockResolvedValue({ decision: 'granted', decidedByLegalGuardianId: 'guardian-2', consentVersion: 'v1' }),
        suspendAndOpenFollowup: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = buildService({ legalGuardianRepo, locationConsentSuspension });

      await service.revoke('guardian-1', 'staff-1');

      expect(locationConsentSuspension.suspendAndOpenFollowup).not.toHaveBeenCalled();
    });

    test('test_revoke_lastActiveGuardianOfConfirmedMinor_opensNoActiveGuardianRemainingFollowup', async () => {
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(0) });
      const personMinorityStatus = { getStatus: jest.fn().mockResolvedValue({ isMinor: true }) };
      const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
      const { service } = buildService({ legalGuardianRepo, personMinorityStatus, guardianLinkFollowup });

      await service.revoke('guardian-1', 'staff-1');

      expect(guardianLinkFollowup.open).toHaveBeenCalledWith({
        subjectPersonId: 'student-1',
        reason: GuardianLinkFollowupReason.NO_ACTIVE_LEGAL_GUARDIAN_REMAINING,
        relatedLocationConsentDecisionId: null,
        triggeredByPersonId: 'staff-1',
      });
    });

    test('test_revoke_lastActiveGuardianButAdult_doesNotOpenFollowup', async () => {
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(0) });
      const personMinorityStatus = { getStatus: jest.fn().mockResolvedValue({ isMinor: false }) };
      const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
      const { service } = buildService({ legalGuardianRepo, personMinorityStatus, guardianLinkFollowup });

      await service.revoke('guardian-1', 'staff-1');

      expect(guardianLinkFollowup.open).not.toHaveBeenCalled();
    });

    test('test_revoke_lastActiveGuardianButMinorityUnknown_doesNotOpenFollowup', async () => {
      // isMinor === null ("ausente") must NOT trigger the alert — strictly
      // isMinor === true only (architecture-overview.md's "Pendências em
      // aberto" item 5).
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(0) });
      const personMinorityStatus = { getStatus: jest.fn().mockResolvedValue({ isMinor: null }) };
      const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
      const { service } = buildService({ legalGuardianRepo, personMinorityStatus, guardianLinkFollowup });

      await service.revoke('guardian-1', 'staff-1');

      expect(guardianLinkFollowup.open).not.toHaveBeenCalled();
    });

    test('test_revoke_otherActiveGuardiansRemain_doesNotOpenNoActiveGuardianFollowup', async () => {
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(2) });
      const personMinorityStatus = { getStatus: jest.fn().mockResolvedValue({ isMinor: true }) };
      const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
      const { service } = buildService({ legalGuardianRepo, personMinorityStatus, guardianLinkFollowup });

      await service.revoke('guardian-1', 'staff-1');

      expect(guardianLinkFollowup.open).not.toHaveBeenCalled();
    });

    test('test_revoke_bothTriggersFire_opensTwoDistinctFollowupsAndInvalidatesConsent', async () => {
      const legalGuardianRepo = activeGuardianRepo({ count: jest.fn().mockResolvedValue(0) });
      const latest = { decision: 'granted', decidedByLegalGuardianId: 'guardian-1', consentVersion: 'v1' };
      const locationConsentSuspension = {
        getLatestDecision: jest.fn().mockResolvedValue(latest),
        suspendAndOpenFollowup: jest.fn().mockResolvedValue(undefined),
      };
      const personMinorityStatus = { getStatus: jest.fn().mockResolvedValue({ isMinor: true }) };
      const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
      const { service } = buildService({ legalGuardianRepo, locationConsentSuspension, personMinorityStatus, guardianLinkFollowup });

      await service.revoke('guardian-1', 'staff-1');

      expect(locationConsentSuspension.suspendAndOpenFollowup).toHaveBeenCalledWith(
        expect.objectContaining({ reason: GuardianLinkFollowupReason.LEGAL_GUARDIAN_REVOKED_LOCATION_CONSENT_INVALIDATED }),
      );
      expect(guardianLinkFollowup.open).toHaveBeenCalledWith(
        expect.objectContaining({ reason: GuardianLinkFollowupReason.NO_ACTIVE_LEGAL_GUARDIAN_REMAINING }),
      );
    });
  });
});
