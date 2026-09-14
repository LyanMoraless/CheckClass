import * as FileSystem from 'expo-file-system/legacy';
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
// Split out from a Response-reading step so a binary download's error body — read back from the
// file downloadToFile() writes it to, never from a live Response — can share this exact parsing
// instead of duplicating it.
function parseErrorBody(rawBody: string, statusCode: number): string {
  try {
    const body = JSON.parse(rawBody) as { error?: string | { message?: string | string[] } };
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
  return `Request failed with status ${statusCode}`;
}

async function extractErrorMessage(response: Response): Promise<string> {
  return parseErrorBody(await response.text(), response.status);
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

// Shared by every request kind that can hit a 401 (plain JSON, multipart upload, binary
// download) — all three attempt shapes (fetch's Response, FileSystem's FileSystemDownloadResult)
// happen to carry a `status` field, so one retry-once orchestration covers all of them instead of
// each call site reimplementing "try, refresh-if-401, retry" on its own. refreshAccessToken()
// itself throws (and forces logout) if the refresh token is missing/invalid/reused, so a second
// 401 on the retry is never swallowed into a loop.
async function withAuthRetry<T extends { status: number }>(attempt: (accessToken: string | null) => Promise<T>): Promise<T> {
  const accessToken = await getAccessToken();
  const result = await attempt(accessToken);
  if (result.status !== 401) {
    return result;
  }
  const tokens = await refreshAccessToken();
  return attempt(tokens.accessToken);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.skipAuthRetry) {
    const accessToken = await getAccessToken();
    return parseResponse<T>(await rawFetch(path, options, accessToken));
  }
  const response = await withAuthRetry((accessToken) => rawFetch(path, options, accessToken));
  return parseResponse<T>(response);
}

// React Native's fetch (unlike a browser's) never needs a manual Content-Type here — passing a
// FormData body makes it set `multipart/form-data; boundary=...` itself, the same way rawFetch's
// JSON path sets `application/json` explicitly. Reusing rawFetch's NetworkError translation would
// require it to special-case "no Content-Type header" for this one caller, so this is a thin
// sibling instead of a rawFetch parameter.
async function rawFetchMultipart(path: string, formData: FormData, accessToken: string | null): Promise<Response> {
  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  try {
    return await fetch(`${apiBaseUrl}${path}`, { method: 'POST', headers, body: formData });
  } catch {
    throw new NetworkError('Could not reach the CheckClass server — check your connection.');
  }
}

async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const response = await withAuthRetry((accessToken) => rawFetchMultipart(path, formData, accessToken));
  return parseResponse<T>(response);
}

export interface DownloadedFile {
  // file:// URI inside FileSystem.cacheDirectory (never documentDirectory — callers own deleting
  // it once they're done, see absence-justification-api.ts's download function for why).
  localUri: string;
  filename: string | null;
  mimeType: string | null;
}

async function attemptDownload(path: string, destinationUri: string, accessToken: string | null) {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  try {
    return await FileSystem.downloadAsync(`${apiBaseUrl}${path}`, destinationUri, { headers });
  } catch {
    throw new NetworkError('Could not reach the CheckClass server — check your connection.');
  }
}

function extractFilename(headers: Record<string, string>): string | null {
  const contentDisposition = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-disposition')?.[1];
  const match = contentDisposition ? /filename="?([^"]+)"?/.exec(contentDisposition) : null;
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// Streams straight to disk via FileSystem.downloadAsync rather than fetch()+arrayBuffer(), so the
// binary body never has to live fully in JS memory. A non-2xx response still gets WRITTEN to
// destinationUri by downloadAsync (it has no way to know the bytes are actually a JSON error body,
// not the file) — this reads that body back to extract the real error message, then removes the
// file before surfacing it, so a failed download never leaves a bogus file behind for a caller to
// mistakenly treat as the real attachment.
async function downloadToFile(path: string, destinationUri: string): Promise<DownloadedFile> {
  const result = await withAuthRetry((accessToken) => attemptDownload(path, destinationUri, accessToken));

  if (result.status < 200 || result.status >= 300) {
    const rawBody = await FileSystem.readAsStringAsync(destinationUri).catch(() => '');
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    throw new ApiError(result.status, parseErrorBody(rawBody, result.status));
  }

  return { localUri: result.uri, filename: extractFilename(result.headers), mimeType: result.mimeType };
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown, options?: { skipAuthRetry?: boolean }): Promise<T> =>
    request<T>(path, { method: 'POST', body, skipAuthRetry: options?.skipAuthRetry }),
  postMultipart: <T>(path: string, formData: FormData): Promise<T> => requestMultipart<T>(path, formData),
  downloadToFile: (path: string, destinationUri: string): Promise<DownloadedFile> => downloadToFile(path, destinationUri),
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
