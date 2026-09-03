import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onUnauthorized } from '../../lib/api-client';
import { clearStoredToken, getStoredToken, storeToken } from '../../lib/auth-storage';
import type { Permission } from '../../types/permission';
import { fetchCurrentPerson, fetchMyRoleContext, login as loginRequest, type RoleContext } from './auth-api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

// Every flag false / every list empty — the safe default while roleContext
// hasn't loaded yet (or for a person with no self-service role at all), so
// every nav group driven by it simply stays hidden instead of every
// consumer having to null-check roleContext itself.
const EMPTY_ROLE_CONTEXT: RoleContext = { isStudent: false, teaching: [], coordinating: [], isDirection: false };

interface AuthContextValue {
  status: AuthStatus;
  personId: string | null;
  permissions: Set<Permission>;
  roleContext: RoleContext;
  hasPermission: (permission: Permission) => boolean;
  login: (cpf: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [personId, setPersonId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [roleContext, setRoleContext] = useState<RoleContext>(EMPTY_ROLE_CONTEXT);

  const logout = useCallback(() => {
    clearStoredToken();
    setPersonId(null);
    setPermissions(new Set());
    setRoleContext(EMPTY_ROLE_CONTEXT);
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
    // permissions/role context before treating the session as usable.
    Promise.all([fetchCurrentPerson(), fetchMyRoleContext()])
      .then(([me, context]) => {
        setPersonId(me.personId);
        setPermissions(new Set(me.permissions));
        setRoleContext(context);
        setStatus('authenticated');
      })
      .catch(() => logout());
  }, [logout]);

  const login = useCallback(async (cpf: string, password: string) => {
    const { accessToken } = await loginRequest({ cpf, password });
    storeToken(accessToken);
    const [me, context] = await Promise.all([fetchCurrentPerson(), fetchMyRoleContext()]);
    setPersonId(me.personId);
    setPermissions(new Set(me.permissions));
    setRoleContext(context);
    setStatus('authenticated');
  }, []);

  const hasPermission = useCallback((permission: Permission) => permissions.has(permission), [permissions]);

  const value = useMemo(
    () => ({ status, personId, permissions, roleContext, hasPermission, login, logout }),
    [status, personId, permissions, roleContext, hasPermission, login, logout],
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
