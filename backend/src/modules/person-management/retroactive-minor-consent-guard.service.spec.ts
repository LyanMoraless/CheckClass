import { LocationConsentDecisionEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { GuardianLinkFollowupReason } from '../guardian-link-followup/guardian-link-followup.service';
import { RetroactiveMinorConsentGuardService } from './retroactive-minor-consent-guard.service';

// RULE-GRD-07 pendência 1: suspends a sensitive consent SELF-granted by
// someone who is now confirmed to be a minor — never touches a consent
// already granted by a legal_guardian (that is already the correct path).
describe('RetroactiveMinorConsentGuardService', () => {
  function buildService(locationConsentRepo: MockRepository) {
    const manager = createMockEntityManager(new Map([[LocationConsentDecisionEntity, locationConsentRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const guardianLinkFollowup = { open: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new RetroactiveMinorConsentGuardService(tenantContext as never, guardianLinkFollowup as never),
      manager,
      guardianLinkFollowup,
    };
  }

  test('test_suspendSensitiveConsentsIfGranted_noPriorConsent_doesNothing', async () => {
    const locationConsentRepo = createMockRepository({ findOne: jest.fn().mockResolvedValue(null) });
    const { service } = buildService(locationConsentRepo);

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(locationConsentRepo.save).not.toHaveBeenCalled();
  });

  test('test_suspendSensitiveConsentsIfGranted_latestDecisionRefused_doesNothing', async () => {
    const locationConsentRepo = createMockRepository({
      findOne: jest.fn().mockResolvedValue({ decision: 'refused', decidedByPersonId: 'subject-1' }),
    });
    const { service } = buildService(locationConsentRepo);

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(locationConsentRepo.save).not.toHaveBeenCalled();
  });

  test('test_suspendSensitiveConsentsIfGranted_grantedByGuardian_doesNothing', async () => {
    // decidedByPersonId is NULL when a guardian decided (mutually exclusive
    // pair) — already the correct path for a minor, nothing to suspend.
    const locationConsentRepo = createMockRepository({
      findOne: jest.fn().mockResolvedValue({
        decision: 'granted',
        decidedByPersonId: null,
        decidedByLegalGuardianId: 'guardian-1',
        consentVersion: 'v1',
      }),
    });
    const { service } = buildService(locationConsentRepo);

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(locationConsentRepo.save).not.toHaveBeenCalled();
  });

  test('test_suspendSensitiveConsentsIfGranted_grantedBySelf_insertsRevokedRow', async () => {
    const locationConsentRepo = createMockRepository({
      findOne: jest.fn().mockResolvedValue({
        decision: 'granted',
        decidedByPersonId: 'subject-1',
        decidedByLegalGuardianId: null,
        consentVersion: 'v1',
      }),
    });
    const { service } = buildService(locationConsentRepo);

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

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

  // RULE-GRD-07 pendência 1 production-readiness gap (Security, 2026-09-15):
  // the previous logger.warn-only signal is replaced by a real, traceable
  // guardian_link_followup item, opened with the just-saved suspension row's
  // id — same transaction (both go through this.tenantContext.getManager()).
  test('test_suspendSensitiveConsentsIfGranted_grantedBySelf_opensGuardianLinkFollowup', async () => {
    const locationConsentRepo = createMockRepository({
      findOne: jest.fn().mockResolvedValue({
        decision: 'granted',
        decidedByPersonId: 'subject-1',
        decidedByLegalGuardianId: null,
        consentVersion: 'v1',
      }),
      save: jest.fn().mockResolvedValue({ id: 'decision-row-1' }),
    });
    const { service, guardianLinkFollowup } = buildService(locationConsentRepo);

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(guardianLinkFollowup.open).toHaveBeenCalledWith({
      subjectPersonId: 'subject-1',
      reason: GuardianLinkFollowupReason.RETROACTIVE_MINORITY_LOCATION_CONSENT_SUSPENDED,
      relatedLocationConsentDecisionId: 'decision-row-1',
      triggeredByPersonId: 'staff-1',
    });
  });

  test('test_suspendSensitiveConsentsIfGranted_noPriorConsent_neverOpensGuardianLinkFollowup', async () => {
    const locationConsentRepo = createMockRepository({ findOne: jest.fn().mockResolvedValue(null) });
    const { service, guardianLinkFollowup } = buildService(locationConsentRepo);

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(guardianLinkFollowup.open).not.toHaveBeenCalled();
  });
});
