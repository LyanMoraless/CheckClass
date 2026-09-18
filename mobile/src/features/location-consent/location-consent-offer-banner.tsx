import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocationConsent } from './use-location-consent';

// RULE-PRES-14's first-ask moment, offered inline at the check-in screen — same
// "ambient, dismissible offer that never blocks the primary action" idiom the web
// dashboard already uses for device-binding's post-login capability offer
// (frontend/src/features/device-binding/device-link-prompt.tsx). Dismissing here
// is NOT the same as an explicit refuse: it just defers the decision (nothing is
// recorded) — check-in still runs the tag-only path meanwhile, exactly as it
// would for an explicit refusal, since there is still no active consent either
// way. An explicit grant/refuse/revoke always goes through location-consent-screen.tsx
// (reachable from Account) or the two buttons below.
export function LocationConsentOfferBanner() {
  const { isUndecided, grant, refuse, isMutating } = useLocationConsent();
  const [dismissed, setDismissed] = useState(false);

  if (!isUndecided || dismissed) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Allow CheckClass to check your location during check-in and while a class you check into is in progress?
        This helps confirm attendance is happening on campus. You can change this anytime from Account.
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={grant} disabled={isMutating}>
          <Text style={styles.primaryButtonText}>{isMutating ? 'Saving…' : 'Allow'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={refuse} disabled={isMutating}>
          <Text style={styles.secondaryButtonText}>Refuse</Text>
        </Pressable>
        <Pressable style={styles.dismissButton} onPress={() => setDismissed(true)} disabled={isMutating}>
          <Text style={styles.dismissButtonText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#eef6ff',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  text: {
    color: '#12395c',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#208aef',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#208aef',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#208aef',
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#5a5a5a',
  },
});
