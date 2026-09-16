import { LocationConsentDecisionEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { GuardianLinkFollowupReason } from '../guardian-link-followup/guardian-link-followup.service';
import { LocationConsentSuspensionService } from './location-consent-suspension.service';

// Extracted, behavior-preserving, from RetroactiveMinorConsentGuardService's
// original private mechanic — same two responsibilities (read the latest
// decision, suspend + open a followup), now shared by a second caller
// (LegalGuardianService.revoke()) via a `reason` parameter instead of a
// hardcoded one.
describe('LocationConsentSuspensionService', () => {
  function buildService(locationConsentRepo: MockRepository) {
    const manager = createMockEntityManager(new Map([[LocationConsentDecisionEntity, locationConsentRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new LocationConsentSuspensionService(tenantContext as never, guardianLinkFollowup as never),
      manager,
      guardianLinkFollowup,
    };
  }

  describe('getLatestDecision', () => {
    test('test_getLatestDecision_delegatesToRepositoryFindOne_orderedByCapturedAtDescending', async () => {
      const decision = { id: 'decision-1' };
      const locationConsentRepo = createMockRepository({ findOne: jest.fn().mockResolvedValue(decision) });
      const { service } = buildService(locationConsentRepo);

      const result = await service.getLatestDecision('subject-1');

      expect(locationConsentRepo.findOne).toHaveBeenCalledWith({
        where: { subjectPersonId: 'subject-1' },
        order: { capturedAt: 'DESC' },
      });
      expect(result).toBe(decision);
    });

    test('test_getLatestDecision_noPriorDecision_returnsNull', async () => {
      const locationConsentRepo = createMockRepository({ findOne: jest.fn().mockResolvedValue(null) });
      const { service } = buildService(locationConsentRepo);

      await expect(service.getLatestDecision('subject-1')).resolves.toBeNull();
    });
  });

  describe('suspendAndOpenFollowup', () => {
    test('test_suspendAndOpenFollowup_insertsSystemRevokedRow_carryingForwardConsentVersion', async () => {
      const locationConsentRepo = createMockRepository();
      const { service } = buildService(locationConsentRepo);
      const latest = { consentVersion: 'v1' } as LocationConsentDecisionEntity;

      await service.suspendAndOpenFollowup({
        subjectPersonId: 'subject-1',
        latest,
        reason: GuardianLinkFollowupReason.LEGAL_GUARDIAN_REVOKED_LOCATION_CONSENT_INVALIDATED,
        triggeredByPersonId: 'staff-1',
      });

      expect(locationConsentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectPersonId: 'subject-1',
          decidedByType: 'system',
          systemActionTriggeredByPersonId: 'staff-1',
          decision: 'revoked',
          consentVersion: 'v1',
        }),
      );
    });

    test('test_suspendAndOpenFollowup_opensGuardianLinkFollowup_withTheGivenReasonAndSavedDecisionId', async () => {
      const locationConsentRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'decision-row-1' }) });
      const { service, guardianLinkFollowup } = buildService(locationConsentRepo);
      const latest = { consentVersion: 'v1' } as LocationConsentDecisionEntity;

      await service.suspendAndOpenFollowup({
        subjectPersonId: 'subject-1',
        latest,
        reason: GuardianLinkFollowupReason.NO_ACTIVE_LEGAL_GUARDIAN_REMAINING,
        triggeredByPersonId: 'staff-1',
      });

      expect(guardianLinkFollowup.open).toHaveBeenCalledWith({
        subjectPersonId: 'subject-1',
        reason: GuardianLinkFollowupReason.NO_ACTIVE_LEGAL_GUARDIAN_REMAINING,
        relatedLocationConsentDecisionId: 'decision-row-1',
        triggeredByPersonId: 'staff-1',
      });
    });
  });
});
