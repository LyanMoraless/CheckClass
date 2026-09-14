import { StyleSheet, Text, View } from 'react-native';

export type BadgeTone = 'neutral' | 'warning' | 'danger' | 'success' | 'info';

// Shared by both screens of this feature that render item status (the new-request result and
// the detail screen) — same shape as the local Badge already defined inline inside
// warnings-screen.tsx, pulled into its own file here since two screens need it instead of one.
export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View style={[styles.badge, toneStyles[tone]]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
});

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: '#e2e2e2' },
  warning: { backgroundColor: '#fff3cd' },
  danger: { backgroundColor: '#f8d7da' },
  success: { backgroundColor: '#d4edda' },
  info: { backgroundColor: '#cfe2ff' },
});
