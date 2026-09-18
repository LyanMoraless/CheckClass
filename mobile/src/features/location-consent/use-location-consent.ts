import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyLocationConsent,
  grantMyLocationConsent,
  refuseMyLocationConsent,
  revokeMyLocationConsent,
  type LocationConsentDecision,
} from './location-consent-api';

// Shared across the three call sites that all need the same underlying
// decision (location-consent-screen.tsx, location-consent-offer-banner.tsx,
// and — eventually — the class-monitoring gate) so they never disagree about
// what the current consent status is, and a grant/refuse/revoke from any one of
// them is immediately reflected in the others via query invalidation.
export const LOCATION_CONSENT_QUERY_KEY = ['location-consent-mine'];

export interface LocationConsentState {
  decision: LocationConsentDecision | null;
  isLoading: boolean;
  error: unknown;
  // RULE-PRES-14/15: only a 'granted' row counts — 'refused'/'revoked' (or no
  // row at all) all route through the tag-only caminho alternativo.
  hasActiveConsent: boolean;
  // No decision recorded yet at all — distinct from an explicit refusal/
  // revocation. This is the state location-consent-offer-banner.tsx renders
  // for (RULE-PRES-14's first-ask moment).
  isUndecided: boolean;
  grant: () => void;
  refuse: () => void;
  revoke: () => void;
  isMutating: boolean;
  mutationError: unknown;
}

// Pure, deliberately extracted from the hook below so it can be unit-tested directly (same
// idiom as warnings-feed.ts/leadership-class-groups-format.ts) instead of only through
// react-test-renderer + useQuery's own async timing, which is not exercised by any hook-level
// test in this codebase.
export function deriveLocationConsentUiState(
  decisionData: LocationConsentDecision | null | undefined,
  isSuccess: boolean,
): { decision: LocationConsentDecision | null; hasActiveConsent: boolean; isUndecided: boolean } {
  const decision = decisionData ?? null;
  return {
    decision,
    // RULE-PRES-14/15: only a 'granted' row counts — 'refused'/'revoked' (or no row at all)
    // all route through the tag-only caminho alternativo.
    hasActiveConsent: decision?.decision === 'granted',
    // No decision recorded yet at all — distinct from an explicit refusal/revocation. This is
    // the state location-consent-offer-banner.tsx renders for (RULE-PRES-14's first-ask
    // moment).
    isUndecided: isSuccess && decision === null,
  };
}

export function useLocationConsent(): LocationConsentState {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: LOCATION_CONSENT_QUERY_KEY, queryFn: getMyLocationConsent });

  function invalidate(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: LOCATION_CONSENT_QUERY_KEY });
  }

  const grantMutation = useMutation({ mutationFn: grantMyLocationConsent, onSuccess: invalidate });
  const refuseMutation = useMutation({ mutationFn: refuseMyLocationConsent, onSuccess: invalidate });
  const revokeMutation = useMutation({ mutationFn: revokeMyLocationConsent, onSuccess: invalidate });

  const { decision, hasActiveConsent, isUndecided } = deriveLocationConsentUiState(query.data, query.isSuccess);

  return {
    decision,
    isLoading: query.isLoading,
    error: query.error,
    hasActiveConsent,
    isUndecided,
    grant: () => grantMutation.mutate(),
    refuse: () => refuseMutation.mutate(),
    revoke: () => revokeMutation.mutate(),
    isMutating: grantMutation.isPending || refuseMutation.isPending || revokeMutation.isPending,
    mutationError: grantMutation.error ?? refuseMutation.error ?? revokeMutation.error,
  };
}
