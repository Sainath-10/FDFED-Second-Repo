/**
 * NEXUS ESPORTS — Auth context
 *
 * Holds the signed-in session for the component tree. On load (and whenever the
 * tab regains focus) the account is re-read from the server, so a role change,
 * ban or revocation made elsewhere takes effect without a manual sign-out.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as AuthService from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => AuthService.getSession());

  const refreshSession = useCallback(async () => {
    const fresh = await AuthService.refreshFromServer();
    setSessionState(fresh || AuthService.getSession());
    return fresh;
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    refreshSession();
    const onFocus = () => refreshSession();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session]);

  /** options: { username, password, roleRoutes, fallbackPath } */
  const login = useCallback(async (options) => {
    const result = await AuthService.login(options);
    if (result.ok) setSessionState(result.user);
    return result;
  }, []);

  /** options: { username, email, password } */
  const signup = useCallback((options) => AuthService.createAccount(options), []);

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
      getRoleProfilePath: AuthService.getRoleProfilePath,
      SESSION_KEY: AuthService.SESSION_KEY,
    }),
    [session, login, signup, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}

export default AuthContext;
