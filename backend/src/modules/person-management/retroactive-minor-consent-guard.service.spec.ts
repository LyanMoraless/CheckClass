import { GuardianLinkFollowupReason } from '../guardian-link-followup/guardian-link-followup.service';
import { RetroactiveMinorConsentGuardService } from './retroactive-minor-consent-guard.service';

// RULE-GRD-07 pendência 1: suspends a sensitive consent SELF-granted by
// someone who is now confirmed to be a minor — never touches a consent
// already granted by a legal_guardian (that is already the correct path).
//
// Refactor note ("Decisão de arquitetura — CRUD de legal_guardian",
// architecture-overview.md): this service now delegates the actual
// read/suspend/open mechanics to the shared LocationConsentSuspensionService
// — these specs mock that one seam directly instead of a location-consent
// repository + GuardianLinkFollowupService, while covering the exact same
// guard-condition behavior as before the extraction.
describe('RetroactiveMinorConsentGuardService', () => {
  function buildService(getLatestDecision: jest.Mock) {
    const locationConsentSuspension = {
      getLatestDecision,
      suspendAndOpenFollowup: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new RetroactiveMinorConsentGuardService(locationConsentSuspension as never),
      locationConsentSuspension,
    };
  }

  test('test_suspendSensitiveConsentsIfGranted_noPriorConsent_doesNothing', async () => {
    const { service, locationConsentSuspension } = buildService(jest.fn().mockResolvedValue(null));

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(locationConsentSuspension.suspendAndOpenFollowup).not.toHaveBeenCalled();
  });

  test('test_suspendSensitiveConsentsIfGranted_latestDecisionRefused_doesNothing', async () => {
    const { service, locationConsentSuspension } = buildService(
      jest.fn().mockResolvedValue({ decision: 'refused', decidedByPersonId: 'subject-1' }),
    );

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(locationConsentSuspension.suspendAndOpenFollowup).not.toHaveBeenCalled();
  });

  test('test_suspendSensitiveConsentsIfGranted_grantedByGuardian_doesNothing', async () => {
    // decidedByPersonId is NULL when a guardian decided (mutually exclusive
    // pair) — already the correct path for a minor, nothing to suspend.
    const { service, locationConsentSuspension } = buildService(
      jest.fn().mockResolvedValue({
        decision: 'granted',
        decidedByPersonId: null,
        decidedByLegalGuardianId: 'guardian-1',
        consentVersion: 'v1',
      }),
    );

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(locationConsentSuspension.suspendAndOpenFollowup).not.toHaveBeenCalled();
  });

  test('test_suspendSensitiveConsentsIfGranted_grantedBySelf_suspendsWithRetroactiveMinorityReason', async () => {
    const latest = {
      decision: 'granted',
      decidedByPersonId: 'subject-1',
      decidedByLegalGuardianId: null,
      consentVersion: 'v1',
    };
    const { service, locationConsentSuspension } = buildService(jest.fn().mockResolvedValue(latest));

    await service.suspendSensitiveConsentsIfGranted('subject-1', 'staff-1');

    expect(locationConsentSuspension.suspendAndOpenFollowup).toHaveBeenCalledWith({
      subjectPersonId: 'subject-1',
      latest,
      reason: GuardianLinkFollowupReason.RETROACTIVE_MINORITY_LOCATION_CONSENT_SUSPENDED,
      triggeredByPersonId: 'staff-1',
    });
  });
});
