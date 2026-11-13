/**
 * NEXUS ESPORTS — Auth service
 *
 * The backend is the only authority for accounts. This module keeps the signed-
 * in session (from the login response) and helpers around it. No passwords or
 * account lists are ever stored in the browser.
 */

import { AuthAPI, getToken as getApiToken, getUser as getApiUser, setUser as setApiUser } from './api.js';

export const SESSION_KEY = 'nexus.auth.session';
/** Removed: accounts used to be cached here with plain-text passwords. Cleared on load. */
const LEGACY_KEYS = ['nexus.auth.accounts', 'nexus.accounts', 'nexus_admin_disputes', 'nexus.disputes', 'nexus.disputes.evidence'];

function readStorage(key) {
  try { return window.localStorage.getItem(key); } catch (err) { return null; }
}
function writeStorage(key, value) {
  try { window.localStorage.setItem(key, value); } catch (err) { /* storage unavailable */ }
}
function removeStorage(key) {
  try { window.localStorage.removeItem(key); } catch (err) { /* storage unavailable */ }
}

if (typeof window !== 'undefined') LEGACY_KEYS.forEach(removeStorage);

const normalize = (value) => String(value || '').trim().toLowerCase();

/** UI role key: super_admin → super-admin, teamlead → team_lead. */
export function normalizeRole(role) {
  const key = normalize(role);
  if (key === 'super_admin') return 'super-admin';
  if (key === 'teamlead') return 'team_lead';
  if (key === 'community moderator' || key === 'communitymod') return 'community_moderator';
  return key;
}

function sessionFromUser(user) {
  if (!user || !user.username) return null;
  return {
    id: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    adminType: user.adminType || null,
    displayName: user.username,
    email: user.email || '',
    profilePicUrl: user.profilePicUrl || null,
    bio: user.bio || null,
  };
}

export function getSession() {
  if (!getApiToken()) return null;
  const fromApi = sessionFromUser(getApiUser());
  if (fromApi) return fromApi;
  try {
    const parsed = JSON.parse(readStorage(SESSION_KEY) || 'null');
    return parsed && parsed.username && parsed.role ? parsed : null;
  } catch (err) {
    return null;
  }
}

export function setSession(session) {
  writeStorage(SESSION_KEY, JSON.stringify(session || {}));
}

/** Browser state that belongs to one account and must not carry over to the next. */
function clearAccountScopedState() {
  removeStorage('nexus.team.activeContext');
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('nexus.verifiedJoinCode.') || key.startsWith('nexus.joinCode.'))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch (err) { /* sessionStorage unavailable */ }
}

export function clearSession() {
  AuthAPI.logout();
  clearAccountScopedState();
  removeStorage(SESSION_KEY);
}

/** Re-reads the account from the server (role or profile changes made elsewhere). */
export async function refreshFromServer() {
  if (!getApiToken()) return null;
  const res = await AuthAPI.getMe();
  if (!res.ok) {
    if (res.status === 401) clearSession();
    return null;
  }
  setApiUser({ ...(getApiUser() || {}), ...res.data });
  const next = sessionFromUser(res.data);
  if (next) setSession(next);
  return next;
}

export async function createAccount(options = {}) {
  const username = String(options.username || '').trim();
  const email = String(options.email || '').trim();
  const password = String(options.password || '');
  if (!username || !email || !password) return { ok: false, error: 'All fields are required.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  const res = await AuthAPI.register(email, username, password);
  if (!res.ok) return { ok: false, error: res.error || 'Sign-up failed.' };
  return { ok: true, message: 'Account created. You can log in now.' };
}

export function getRoleProfilePath(role, roleRoutes) {
  if (!roleRoutes || typeof roleRoutes !== 'object') return null;
  return roleRoutes[role] || null;
}

/**
 * Logs in against the backend. Returns
 *   { ok: true, user, revokedReason, redirectPath } or { ok: false, error }.
 */
export async function login(options = {}) {
  const result = await AuthAPI.login(options.username, options.password);
  if (!result.ok) {
    clearSession();
    return {
      ok: false,
      error: result.status === 0
        ? 'Cannot reach the server. Start the backend and try again.'
        : result.error || 'Login failed. Check your username and password.',
    };
  }
  const user = result.data.user;
  const session = sessionFromUser(user);
  clearAccountScopedState();
  setSession(session);
  return {
    ok: true,
    message: 'Login successful!',
    user: session,
    revokedReason: user.revokedReason || null,
    redirectPath: getRoleProfilePath(session.role, options.roleRoutes) || options.fallbackPath || '/',
  };
}

export function isAuthenticated() {
  return !!getApiToken() && !!getApiUser();
}

const NexusAuth = {
  SESSION_KEY,
  getSession,
  setSession,
  clearSession,
  refreshFromServer,
  createAccount,
  login,
  getRoleProfilePath,
  normalizeRole,
  isAuthenticated,
};

export default NexusAuth;
