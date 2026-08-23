// EXPO_PUBLIC_* variables are inlined by Expo's bundler at build time (from .env or the
// shell environment) — see .env.example for per-platform values (Android emulator needs
// 10.0.2.2 instead of localhost).
const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

// __DEV__ is Expo/React Native's own dev-vs-production flag, true for `expo start` and dev
// builds, false for anything actually shipped. Outside of __DEV__, CPF+password (login) and
// both auth tokens (every other request) would otherwise be sent in cleartext over plain
// HTTP if apiBaseUrl were ever left at its http:// default (or misconfigured) for a
// production build — fail loudly at startup instead of silently shipping that.
if (!__DEV__ && !apiBaseUrl.startsWith('https://')) {
  throw new Error(`apiBaseUrl must use https:// in production builds, got: ${apiBaseUrl}`);
}
