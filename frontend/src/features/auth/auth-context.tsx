import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onUnauthorized } from '../../lib/api-client';
import { clearStoredToken, getStoredToken, storeToken } from '../../lib/auth-storage';
import type { Permission } from '../../types/permission';
import { fetchCurrentPerson, login as loginRequest } from './auth-api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  personId: string | null;
  permissions: Set<Permission>;
  hasPermission: (permission: Permission) => boolean;
  login: (cpf: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [personId, setPersonId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());

  const logout = useCallback(() => {
    clearStoredToken();
    setPersonId(null);
    setPermissions(new Set());
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
  }, [logout]);

  useEffect(() => {
    if (!getStoredToken()) {
      setStatus('anonymous');
      return;
    }
    // Token exists (e.g. page reload) — confirm it's still valid and load
    // permissions before treating the session as usable.
    fetchCurrentPerson()
      .then((me) => {
        setPersonId(me.personId);
        setPermissions(new Set(me.permissions));
        setStatus('authenticated');
      })
      .catch(() => logout());
  }, [logout]);

  const login = useCallback(async (cpf: string, password: string) => {
    const { accessToken } = await loginRequest({ cpf, password });
    storeToken(accessToken);
    const me = await fetchCurrentPerson();
    setPersonId(me.personId);
    setPermissions(new Set(me.permissions));
    setStatus('authenticated');
  }, []);

  const hasPermission = useCallback((permission: Permission) => permissions.has(permission), [permissions]);

  const value = useMemo(
    () => ({ status, personId, permissions, hasPermission, login, logout }),
    [status, personId, permissions, hasPermission, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
