import { apiClient } from '../../lib/api-client';
import type { TokenPair } from '../../lib/storage/secure-token-storage';

// POST /v1/auth/login/mobile (mobile-specific route — auth.controller.ts — distinct from
// POST /v1/auth/login, which the web dashboard uses and which returns a single JWT with no
// refresh token). skipAuthRetry: a 401 here means "invalid CPF/password", never "expired
// access token" — there is no session yet to refresh.
export async function loginMobile(cpf: string, password: string): Promise<TokenPair> {
  return apiClient.post<TokenPair>('/v1/auth/login/mobile', { cpf, password }, { skipAuthRetry: true });
}

// POST /v1/auth/logout revokes the refresh token; the backend responds with a silent
// success even for an unknown/already-revoked token (mobile-auth.service.ts), so this never
// throws for "was already logged out" — only for a genuine network failure.
export async function logoutMobile(refreshToken: string): Promise<void> {
  await apiClient.post<{ success: true }>('/v1/auth/logout', { refreshToken }, { skipAuthRetry: true });
}
