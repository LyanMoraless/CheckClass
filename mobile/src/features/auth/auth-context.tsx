import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onForceLogout } from '../../lib/api-client';
import { queryClient } from '../../lib/query-client';
import { clearTokenPair, getRefreshToken, saveTokenPair } from '../../lib/storage/secure-token-storage';
import { loginMobile, logoutMobile } from './auth-api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  login: (cpf: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// No dedicated role/actorType exists anywhere in the backend contract (JwtPayload is just
// { personId, tenantId }; GET /v1/auth/me only returns the 4 admin permission-group flags,
// irrelevant to RULE-ATT-12's leadership chain) — see the Mobile Implementation Summary's
// "Divergences identified"/"Flagged issues" for why this app deliberately does NOT attempt
// to infer/show an Aluno-vs-Professor role: every authenticated person sees the same set of
// tabs, and the backend enforces per-endpoint who can actually do what (a student's
// pending-reviews list is simply always empty; resolve() 403s server-side either way).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      let refreshToken: string | null = null;
      try {
        // A stored refresh token means "there was a session" — it's treated as authenticated
        // optimistically even if the access token itself has since expired, since api-client's
        // request() silently refreshes on the first 401 either way.
        refreshToken = await getRefreshToken();
      } catch {
        // expo-secure-store rejected (e.g. a corrupted Keystore) — there is no recoverable
        // session to read, so this is treated the same as "no token stored" rather than left
        // as an unhandled rejection that would strand RootNavigator on the loading spinner
        // forever.
      }
      if (isMounted) {
        setStatus(refreshToken ? 'authenticated' : 'unauthenticated');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    onForceLogout(() => {
      queryClient.clear();
      setStatus('unauthenticated');
    });
  }, []);

  async function login(cpf: string, password: string): Promise<void> {
    const tokens = await loginMobile(cpf, password);
    await saveTokenPair(tokens);
    setStatus('authenticated');
  }

  async function logout(): Promise<void> {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        await logoutMobile(refreshToken);
      } catch {
        // Best-effort revoke: the user's intent to log out of THIS device must not depend
        // on connectivity — local session state is cleared below regardless.
      }
    }
    await clearTokenPair();
    queryClient.clear();
    setStatus('unauthenticated');
  }

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
