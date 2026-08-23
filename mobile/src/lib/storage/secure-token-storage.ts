import * as SecureStore from 'expo-secure-store';

// Mobile Auth security decision (architecture-overview.md): both the access
// token and refresh token live in expo-secure-store (iOS Keychain / Android Keystore),
// never AsyncStorage/plain storage — this is the mobile-appropriate equivalent of the web
// dashboard's sessionStorage choice, not a literal port of it.
const ACCESS_TOKEN_KEY = 'checkclass.accessToken';
const REFRESH_TOKEN_KEY = 'checkclass.refreshToken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokenPair(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokenPair(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
