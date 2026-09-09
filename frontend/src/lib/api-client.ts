import { clearStoredToken, getStoredToken } from './auth-storage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

// Fires once, centrally, whenever a request comes back 401 — AuthProvider
// subscribes to this to drop the session and send the user back to /login,
// instead of every call site having to check for 401 itself.
type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export function onUnauthorized(listener: UnauthorizedListener): void {
  unauthorizedListener = listener;
}

// Backend's HttpExceptionFilter shape: { statusCode, error: string | { message, error, statusCode } }.
// class-validator's ValidationPipe reports `message` as a string array (one
// entry per failed rule), so that's normalized here too rather than at every
// call site.
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
    // response body wasn't JSON — fall through to the generic message below.
  }
  return `Request failed with status ${response.status}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

// Shared by every request path below (JSON, multipart, blob) — the 401
// session-drop and non-2xx-to-ApiError translation must behave identically
// regardless of how the request body was encoded.
async function handle401AndErrors(response: Response): Promise<void> {
  if (response.status === 401) {
    clearStoredToken();
    unauthorizedListener?.();
    throw new ApiError(401, 'Sua sessão expirou — faça login novamente');
  }
  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }
}

function authHeaders(): Headers {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = authHeaders();
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  await handle401AndErrors(response);

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Frente 07 (absence-justification create, multipart/form-data — the only
// upload this project has today, RULE-JUST-01 addendum/11). Deliberately
// NEVER sets Content-Type itself — the browser must compute the multipart
// boundary, which it only does when it owns the header.
async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const headers = authHeaders();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  await handle401AndErrors(response);

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

// Frente 07's attachment download (RULE-JUST-11.5: bytes streamed straight
// through the backend behind reauthorization on every open, never a
// cached/public/signed URL) — a plain `<a href>` can't carry the
// Authorization header, so the file has to be fetched here and turned into
// an object URL by the caller (see triggerBrowserDownload below). The
// server always sets Content-Disposition: attachment (never inline, per the
// backend controller) — this parses the filename back out of that header
// instead of the caller having to know it up front.
async function requestBlob(path: string): Promise<DownloadedFile> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });

  await handle401AndErrors(response);

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : 'anexo';
  return { blob, filename };
}

// Triggers a real browser "Save as" for a blob already fetched with auth —
// never rendered inline (RULE-JUST-11.5/attachment endpoint's own
// Content-Disposition: attachment posture, mirrored here on the client
// side too, so a PDF/JPEG never opens as an in-page preview by accident).
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'PATCH', body }),
  // Used where the server replaces a whole resource rather than merging a
  // patch — the exam's monitoring-config (the checkbox screen submits the
  // complete set of enabled event types) and the student's per-question
  // answer autosave (idempotent by session+question).
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
  postMultipart: <T>(path: string, formData: FormData): Promise<T> => requestMultipart<T>(path, formData),
  getBlob: (path: string): Promise<DownloadedFile> => requestBlob(path),
};

// Centralizes query-string construction so free-typed values (e.g. a
// copy-pasted UUID) can't corrupt the URL if they happen to contain `&`, `#`,
// or other characters with meaning in a query string.
export function buildQuery(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

// A caller only needs this to distinguish "expected domain error" (show the
// message) from an unexpected shape (still show something reasonable).
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Algo deu errado';
}
