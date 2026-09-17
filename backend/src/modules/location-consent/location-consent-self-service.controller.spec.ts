import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { LocationConsentSelfServiceController } from './location-consent-self-service.controller';

// RULE-PRES-14 — same "personId always from the JWT, never from body/query"
// invariant as the rest of the /v1/me/* family (MeController): these tests
// only need to prove request.personId is what reaches the service, since the
// route itself has no :personId param to spoof in the first place.
describe('LocationConsentSelfServiceController', () => {
  function buildController() {
    const locationConsentService = {
      getActiveConsent: jest.fn().mockResolvedValue({ id: 'decision-1' }),
      grantForSelf: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'granted' }),
      refuseForSelf: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'refused' }),
      revokeForSelf: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'revoked' }),
    };
    const controller = new LocationConsentSelfServiceController(locationConsentService as never);
    const request = { personId: 'student-1' } as AuthenticatedRequest;
    return { controller, locationConsentService, request };
  }

  test('test_getMyConsent_usesJwtPersonId', async () => {
    const { controller, locationConsentService, request } = buildController();

    await controller.getMyConsent(request);

    expect(locationConsentService.getActiveConsent).toHaveBeenCalledWith('student-1');
  });

  test('test_grant_usesJwtPersonIdAndBodyConsentVersion', async () => {
    const { controller, locationConsentService, request } = buildController();

    await controller.grant({ consentVersion: 'v1' }, request);

    expect(locationConsentService.grantForSelf).toHaveBeenCalledWith('student-1', 'v1');
  });

  test('test_refuse_usesJwtPersonIdAndBodyConsentVersion', async () => {
    const { controller, locationConsentService, request } = buildController();

    await controller.refuse({ consentVersion: 'v1' }, request);

    expect(locationConsentService.refuseForSelf).toHaveBeenCalledWith('student-1', 'v1');
  });

  test('test_revoke_usesJwtPersonId', async () => {
    const { controller, locationConsentService, request } = buildController();

    await controller.revoke(request);

    expect(locationConsentService.revokeForSelf).toHaveBeenCalledWith('student-1');
  });
});
