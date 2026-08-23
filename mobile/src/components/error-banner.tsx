import { StyleSheet, Text } from 'react-native';

export function ErrorBanner({ message }: { message: string }) {
  return <Text style={styles.banner}>{message}</Text>;
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fdecea',
    color: '#611a15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
});
