import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/screen-container';
import { useAuth } from '../auth/auth-context';

export function AccountScreen() {
  const { logout } = useAuth();

  function handleLogout(): void {
    // Alert.alert has no confirm/cancel dialog on web — logging out is a low-risk, easily
    // reversible action, so skipping the confirmation there is acceptable rather than
    // building a separate web-only modal for a platform this app doesn't target anyway.
    if (Platform.OS === 'web') {
      void logout();
      return;
    }
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Account</Text>
      <View style={styles.body}>
        <Pressable style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log out</Text>
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
  button: {
    backgroundColor: '#b02a37',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
