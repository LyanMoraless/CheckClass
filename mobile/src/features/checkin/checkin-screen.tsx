import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/screen-container';
import { useCheckIn } from './use-checkin';

export function CheckInScreen() {
  const { uiState, submit, isSubmitting } = useCheckIn();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Check-in</Text>
      <View style={styles.body}>
        <Text style={styles.description}>
          Tap the button below during a scheduled class you're enrolled in. The app automatically figures out which
          session this belongs to — you don't need to pick one.
        </Text>

        {uiState.phase === 'queued' && (
          <Text style={styles.queuedBanner}>
            Your check-in is saved on this device and will be sent automatically once you're back online.
          </Text>
        )}
        {uiState.phase === 'success' && (
          <Text style={styles.successBanner}>
            {uiState.result.created ? 'Check-in recorded.' : 'This check-in was already recorded — nothing to do.'}
          </Text>
        )}
        {uiState.phase === 'error' && <Text style={styles.errorBanner}>{uiState.message}</Text>}

        <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={submit} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Check in now</Text>}
        </Pressable>
      </View>
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
  description: {
    color: '#555',
    fontSize: 14,
  },
  queuedBanner: {
    backgroundColor: '#fff4dd',
    color: '#7a5b00',
    borderRadius: 8,
    padding: 12,
  },
  successBanner: {
    backgroundColor: '#e7f6ec',
    color: '#1e7e34',
    borderRadius: 8,
    padding: 12,
  },
  errorBanner: {
    backgroundColor: '#fdecea',
    color: '#611a15',
    borderRadius: 8,
    padding: 12,
  },
  button: {
    backgroundColor: '#208aef',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
