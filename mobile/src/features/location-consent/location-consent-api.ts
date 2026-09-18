import { apiClient } from '../../lib/api-client';

export type LocationConsentDecisionValue = 'granted' | 'refused' | 'revoked';

// Mirrors LocationConsentDecisionEntity exactly, as returned by
// GET/POST /v1/me/location-consent (location-consent-self-service.controller.ts).
export interface LocationConsentDecision {
  id: string;
  tenantId: string;
  subjectPersonId: string;
  decidedByType: 'person' | 'legal_guardian' | 'system';
  decidedByPersonId: string | null;
  decidedByLegalGuardianId: string | null;
  decision: LocationConsentDecisionValue;
  systemActionTriggeredByPersonId: string | null;
  consentVersion: string;
  capturedAt: string;
}

// Which version of RULE-PRES-14's consent text (location-consent-screen.tsx /
// location-consent-offer-banner.tsx) this app currently shows — sent as evidence
// of which version was displayed (RecordLocationConsentDecisionDto's own comment:
// the backend never validates/derives this, only the caller that actually showed
// the text knows). Bump this if the copy in either of those two files changes.
export const LOCATION_CONSENT_TEXT_VERSION = 'v1';

// GET /v1/me/location-consent — null means no decision has ever been recorded for
// this titular (distinct from an explicit refusal/revocation, both of which are a
// real row). JWT-scoped, self-service only (location-consent-self-service.controller.ts).
export async function getMyLocationConsent(): Promise<LocationConsentDecision | null> {
  return apiClient.get<LocationConsentDecision | null>('/v1/me/location-consent');
}

export async function grantMyLocationConsent(): Promise<LocationConsentDecision> {
  return apiClient.post<LocationConsentDecision>('/v1/me/location-consent/grant', {
    consentVersion: LOCATION_CONSENT_TEXT_VERSION,
  });
}

export async function refuseMyLocationConsent(): Promise<LocationConsentDecision> {
  return apiClient.post<LocationConsentDecision>('/v1/me/location-consent/refuse', {
    consentVersion: LOCATION_CONSENT_TEXT_VERSION,
  });
}

// No consentVersion in the body — revoke always carries forward the version of
// the consent being withdrawn (LocationConsentService.assertRevocableAndGetLatest),
// never a newly-shown one.
export async function revokeMyLocationConsent(): Promise<LocationConsentDecision> {
  return apiClient.post<LocationConsentDecision>('/v1/me/location-consent/revoke');
}
