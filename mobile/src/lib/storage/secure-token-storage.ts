import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Mobile Auth security decision (architecture-overview.md): both the access
// token and refresh token live in expo-secure-store (iOS Keychain / Android Keystore),
// never AsyncStorage/plain storage — this is the mobile-appropriate equivalent of the web
// dashboard's sessionStorage choice, not a literal port of it.
//
// expo-secure-store has no web implementation at all (Keychain/Keystore don't exist in a
// browser), so Expo Web falls back to sessionStorage directly — the same mechanism and same
// rationale (token gone when the tab closes) already approved for the web dashboard
// (frontend/src/lib/auth-storage.ts), not a new decision.
const ACCESS_TOKEN_KEY = 'checkclass.accessToken';
const REFRESH_TOKEN_KEY = 'checkclass.refreshToken';
const isWeb = Platform.OS === 'web';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokenPair(tokens: TokenPair): Promise<void> {
  if (isWeb) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  if (isWeb) {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWeb) {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokenPair(): Promise<void> {
  if (isWeb) {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
