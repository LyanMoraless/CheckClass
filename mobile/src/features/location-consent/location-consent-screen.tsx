import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format-date';
import { useLocationConsent, type LocationConsentState } from './use-location-consent';

// RULE-PRES-14's proposed consent text (attendance-presence-flow-rules.md),
// reproduced here in full so the decision this screen records is genuinely
// informed — LOCATION_CONSENT_TEXT_VERSION (location-consent-api.ts) is what
// gets sent as evidence of which version of THIS text was shown; bump both
// together if the copy below ever changes.
const CONSENT_TEXT = `By accepting this item, you (or, if you are a minor, your legal guardian) authorize CheckClass to collect your mobile device's location at the following moments, and only at these:

1. At the moment of app check-in, a single reading of your current location, used to verify the device is within the institution's configured radius around campus.

2. While a class session you are checked into is in progress, monitoring that verifies the device remains within that same radius, used to identify a prolonged departure from campus during class.

Exclusive purpose: determining attendance/absence for the class. This does not build a movement profile, is not shared with third parties, and is not used outside the context of an ongoing class.

Time limit — this is not continuous tracking: collection under item 2 only happens while a class you are checked into is in progress, within that class's scheduled time. Outside that window, the app does not collect or monitor your location. CheckClass does not track your location 24 hours a day.

Consequence of refusing: you can still register attendance using the tag-only path — it counts exactly like a normal attendance record, with no proximity check.

You can revoke this consent at any time, with the same consequence taking effect from the moment of revocation.`;

function statusLabel(decision: LocationConsentState['decision']): string {
  if (!decision) {
    return "You haven't decided yet.";
  }
  switch (decision.decision) {
    case 'granted':
      return `Granted on ${formatDateTime(decision.capturedAt)}.`;
    case 'refused':
      return `Refused on ${formatDateTime(decision.capturedAt)} — check-in uses the tag-only path.`;
    case 'revoked':
      return `Revoked on ${formatDateTime(decision.capturedAt)} — check-in uses the tag-only path.`;
    default:
      return "You haven't decided yet.";
  }
}

export function LocationConsentScreen() {
  const { decision, isLoading, error, hasActiveConsent, grant, refuse, revoke, isMutating, mutationError } = useLocationConsent();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Location monitoring consent</Text>
      {Boolean(error) && <ErrorBanner message={errorMessage(error)} />}
      {isLoading && <Loading />}
      {!isLoading && !error && (
        <View style={styles.body}>
          <Text style={styles.status}>{statusLabel(decision)}</Text>
          <Text style={styles.text}>{CONSENT_TEXT}</Text>
          {Boolean(mutationError) && <ErrorBanner message={errorMessage(mutationError)} />}
          <View style={styles.actions}>
            {!hasActiveConsent && (
              <Pressable style={[styles.button, styles.grantButton]} onPress={grant} disabled={isMutating}>
                <Text style={styles.buttonText}>{isMutating ? 'Saving…' : 'Grant consent'}</Text>
              </Pressable>
            )}
            {!hasActiveConsent && (
              <Pressable style={[styles.button, styles.refuseButton]} onPress={refuse} disabled={isMutating}>
                <Text style={styles.buttonText}>Refuse</Text>
              </Pressable>
            )}
            {hasActiveConsent && (
              <Pressable style={[styles.button, styles.refuseButton]} onPress={revoke} disabled={isMutating}>
                <Text style={styles.buttonText}>{isMutating ? 'Saving…' : 'Revoke consent'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  body: {
    gap: 12,
  },
  status: {
    fontWeight: '600',
  },
  text: {
    color: '#444',
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 8,
    marginTop: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  grantButton: {
    backgroundColor: '#1e7e34',
  },
  refuseButton: {
    backgroundColor: '#b02a37',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
