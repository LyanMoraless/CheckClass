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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    clearStoredToken();
    unauthorizedListener?.();
    throw new ApiError(401, 'Sua sessão expirou — faça login novamente');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
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
