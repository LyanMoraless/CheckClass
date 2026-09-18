import AsyncStorage from '@react-native-async-storage/async-storage';

// Deliberately plain AsyncStorage, not expo-secure-store: this holds only a
// client-generated idempotency key and a queue timestamp for the ONE pending check-in
// submission, never a token/credential (see the Mobile App technology decision, offline
// check-in tolerance, architecture-overview.md). A single slot by design — the approved
// approach is deliberately lighter than a full offline-sync queue, and RULE-ATT-06's
// server-clock-only session resolution means there is never a legitimate reason for a
// student to have two check-ins in flight at once.
const PENDING_CHECKIN_KEY = 'checkclass.pendingCheckIn';

export interface PendingCheckIn {
  idempotencyKey: string;
  // Informational only (when the app queued this submission) — never sent to the server;
  // RULE-ATT-06 resolves the session strictly from the server's own clock at receipt time.
  queuedAt: string;
  // Captured once, at the moment of the original tap (location-capture.ts) — persisted here
  // so a queued/retried submission resends the SAME reading rather than re-prompting the OS
  // for location (or silently dropping it) on a later retry/app relaunch. Absent whenever
  // location-capture.ts itself returned undefined (no active consent, permission denied, or
  // an untrustworthy reading) — same optionality as AppCheckinDto.latitude/longitude.
  latitude?: number;
  longitude?: number;
}

export async function savePendingCheckIn(pending: PendingCheckIn): Promise<void> {
  await AsyncStorage.setItem(PENDING_CHECKIN_KEY, JSON.stringify(pending));
}

export async function getPendingCheckIn(): Promise<PendingCheckIn | null> {
  const raw = await AsyncStorage.getItem(PENDING_CHECKIN_KEY);
  return raw ? (JSON.parse(raw) as PendingCheckIn) : null;
}

export async function clearPendingCheckIn(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_CHECKIN_KEY);
}
