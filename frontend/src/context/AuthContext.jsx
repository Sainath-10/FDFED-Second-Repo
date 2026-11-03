/**
 * NEXUS ESPORTS — Auth context
 *
 * React state wrapper around src/services/auth.js. It keeps the same session
 * in localStorage (`nexus.auth.session`) as the client so existing users
 * remain logged in, and exposes session state to the component tree.
 *
 * Navigation is left to the caller/router: `login()` resolves to
 * { ok, redirectPath, revokedReason, ... }.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as AuthService from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => AuthService.getSession());

 // Re-read once on mount (handles token written by a previous page load).
  useEffect(() => {
    setSessionState(AuthService.getSession());
  }, []);

  const refreshSession = useCallback(() => {
    const next = AuthService.getSession();
    setSessionState(next);
    return next;
  }, []);

 /** options: { username, password, roleRoutes, fallbackPath } */
  const login = useCallback(async (options) => {
    const result = await AuthService.login(options);
    if (result.ok) {
      setSessionState(result.user || AuthService.getSession());
    }
    return result;
  }, []);

 /** options: { username, email, password, firstName, lastName } */
  const signup = useCallback(async (options) => {
    return AuthService.createAccount(options);
  }, []);

  const logout = useCallback(() => {
    AuthService.clearSession();
    setSessionState(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session,
      isAuthenticated: !!session,
      role: session ? session.role : null,
      adminType: session ? session.adminType || null : null,
      login,
      signup,
      logout,
      refreshSession,
 // re-export constants/helpers used by pages/guards
      getRoleProfilePath: AuthService.getRoleProfilePath,
      requireProfileAccess: AuthService.requireProfileAccess,
      SESSION_KEY: AuthService.SESSION_KEY,
      ACCOUNTS_KEY: AuthService.ACCOUNTS_KEY,
      getAccounts: AuthService.getAccounts,
      DEMO_ACCOUNTS: AuthService.DEMO_ACCOUNTS,
    }),
    [session, login, signup, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;


