import { apiBaseUrl } from './env';
import { clearTokenPair, getAccessToken, getRefreshToken, saveTokenPair, type TokenPair } from './storage/secure-token-storage';

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

// Distinct from ApiError: this means the request never reached the server at all (device
// offline, DNS/host unreachable, request timed out) — fetch() rejects instead of resolving
// with a response in that case. Callers (specifically the check-in flow) need to tell this
// apart from a server-returned error, since only this one should be treated as "retry later
// once connectivity is back", per the approved lightweight offline-retry design.
export class NetworkError extends Error {}

const SESSION_EXPIRED_MESSAGE = 'Your session has expired — please log in again';

// Fires whenever the app gives up on the current session (refresh itself failed) — the auth
// context subscribes to this so a 401 surfacing from ANY background query/mutation sends the
// user back to login, not just an explicit logout() call.
type ForceLogoutListener = () => void;
let forceLogoutListener: ForceLogoutListener | null = null;

export function onForceLogout(listener: ForceLogoutListener): void {
  forceLogoutListener = listener;
}

// Mirrors the web dashboard's api-client.ts error-shape handling
// (HttpExceptionFilter: { statusCode, error: string | { message, error, statusCode } },
// with class-validator's message reported as a string array) — same backend, same filter.
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string | { message?: string | string[] } };
    const error = body.error;
    if (typeof error === 'string') {
      return error;
    }
    if (error?.message) {
      return Array.isArray(error.message) ? error.message.join('; ') : error.message;
    }
  } catch {
    // Response body wasn't JSON — fall through to the generic message below.
  }
  return `Request failed with status ${response.status}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  // Skips the 401 -> refresh -> retry dance below. Used for the auth endpoints themselves
  // (login/mobile, logout) where a 401 means "invalid credentials"/"nothing to revoke", not
  // "this access token expired" — attempting a refresh there would be meaningless at best.
  skipAuthRetry?: boolean;
}

async function rawFetch(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new NetworkError('Could not reach the CheckClass server — check your connection.');
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Single-flight guard: several queries can 401 around the same moment (e.g. the access token
// expired while the app was backgrounded and multiple screens refetch on foreground) — without
// this, each would race its own POST /v1/auth/refresh, and the refresh token's rotate-with-
// reuse-detection design (mobile-auth.service.ts) would make every request after the first
// look like a stolen/replayed token and revoke the whole family.
let refreshPromise: Promise<TokenPair> | null = null;

async function refreshAccessToken(): Promise<TokenPair> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh(): Promise<TokenPair> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await handleUnrecoverableAuthFailure();
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
  }

  const response = await rawFetch('/v1/auth/refresh', { method: 'POST', body: { refreshToken }, skipAuthRetry: true }, null);
  if (!response.ok) {
    // Backend collapses every refresh failure (unknown/expired/reused) into one generic 401
    // message by design (mobile-auth.service.ts) — nothing more specific to surface here.
    await handleUnrecoverableAuthFailure();
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
  }

  const tokens = await parseResponse<TokenPair>(response);
  await saveTokenPair(tokens);
  return tokens;
}

async function handleUnrecoverableAuthFailure(): Promise<void> {
  await clearTokenPair();
  forceLogoutListener?.();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await rawFetch(path, options, accessToken);

  if (response.status === 401 && !options.skipAuthRetry) {
    // Silently refresh once and retry the original request — refreshAccessToken() itself
    // throws (and forces logout) if the refresh token is missing/invalid/reused, so a second
    // 401 here is never swallowed into a retry loop.
    const tokens = await refreshAccessToken();
    const retryResponse = await rawFetch(path, options, tokens.accessToken);
    return parseResponse<T>(retryResponse);
  }

  return parseResponse<T>(response);
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown, options?: { skipAuthRetry?: boolean }): Promise<T> =>
    request<T>(path, { method: 'POST', body, skipAuthRetry: options?.skipAuthRetry }),
};

// A caller only needs this to distinguish "expected domain error" (show the message) from an
// unexpected shape (still show something reasonable) — same role as the web dashboard's
// errorMessage() helper.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError || error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
