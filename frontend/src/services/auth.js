/**
 * NEXUS ESPORTS — Auth service
 *
 * Session and account handling, also published as `window.NexusAuth`:
 * - identical localStorage keys (nexus.auth.session, nexus.auth.accounts)
 * - identical account merge (seed/demo accounts + stored accounts)
 * - identical `normalizeRole` (UI-facing: super_admin -> super-admin)
 * - identical login / signup / logout / session-restoration logic
 * - identical offline localStorage fallback when the API is unreachable
 * - identical role-redirect resolution (getRoleProfilePath)
 *
 * Navigation is intentionally NOT performed here (the code used
 * `window.location` + setTimeout). Functions return the redirect target so the
 * React router can navigate — same observable behaviour, SPA-safe.
 *
 * Session keys are stable, so existing logged-in users stay logged in.
 */

import { AuthAPI, getUser as getApiUser, getToken as getApiToken } from './api.js';
import { isAdministrativeAccount, resolveAdminRole } from '../lib/adminRoles.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const SESSION_KEY = 'nexus.auth.session';
export const ACCOUNTS_KEY = 'nexus.auth.accounts';

/** Demo/seed accounts — identical to src/vendor/auth-accounts.js. All use password `nexus`. */
export const DEMO_ACCOUNTS = [
  { username: 'superadmin1', email: 'superadmin1@nexus.gg', password: 'nexus', role: 'super-admin', adminType: 'super_admin', displayName: 'Super Admin 1' },
  { username: 'superadmin2', email: 'superadmin2@nexus.gg', password: 'nexus', role: 'super-admin', adminType: 'super_admin', displayName: 'Super Admin 2' },
  { username: 'compadmin', email: 'compadmin@nexus.gg', password: 'nexus', role: 'comp_admin', adminType: 'comp_admin', displayName: 'Competition Admin' },
  { username: 'revenueadmin', email: 'revenueadmin@nexus.gg', password: 'nexus', role: 'revenue_admin', adminType: 'revenue_admin', displayName: 'Revenue Admin' },
  { username: 'disputeadmin', email: 'disputeadmin@nexus.gg', password: 'nexus', role: 'dispute_admin', adminType: 'dispute_admin', displayName: 'Dispute Admin' },
  { username: 'communitymod', email: 'communitymod@nexus.gg', password: 'nexus', role: 'community_moderator', adminType: 'community_moderator', displayName: 'Community Moderator' },
  { username: 'regular1', email: 'regular1@nexus.gg', password: 'nexus', role: 'regular', displayName: 'Regular User 1' },
  { username: 'regular2', email: 'regular2@nexus.gg', password: 'nexus', role: 'regular', displayName: 'Regular User 2' },
  { username: 'regular3', email: 'regular3@nexus.gg', password: 'nexus', role: 'regular', displayName: 'Regular User 3' },
];

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
 // Ignore storage write failures in restricted contexts.
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
 // Ignore storage remove failures in restricted contexts.
  }
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeRole(role) {
  const key = normalize(role);
  if (key === 'super_admin') return 'super-admin';
  if (key === 'teamlead') return 'team_lead';
  if (key === 'community moderator' || key === 'communitymod') return 'community_moderator';
  return key;
}

/** Seed accounts, allowing a window override for parity with the build. */
export function getSeedAccounts() {
  if (typeof window !== 'undefined' && Array.isArray(window.NEXUS_DEMO_ACCOUNTS) && window.NEXUS_DEMO_ACCOUNTS.length) {
    return window.NEXUS_DEMO_ACCOUNTS;
  }
  return DEMO_ACCOUNTS;
}

function readAccountsFromStorage() {
  const raw = readStorage(ACCOUNTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && entry.username && entry.password && entry.role);
  } catch (err) {
    return [];
  }
}

function saveAccountsToStorage(accounts) {
  writeStorage(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getAccounts() {
  const seedAccounts = getSeedAccounts();
  const storedAccounts = readAccountsFromStorage();

  if (!storedAccounts.length) {
    return seedAccounts;
  }

  const merged = [...storedAccounts];
  const known = new Set(storedAccounts.map((entry) => normalize(entry.username)));

  seedAccounts.forEach((entry) => {
    const id = normalize(entry.username);
    if (!known.has(id)) {
      merged.push(entry);
    }
  });

  return merged;
}

// ── Local administrative account management ────────────────────────────────
// All administrator and Community Moderator accounts use the same
// `nexus.auth.accounts` store as every other local account, so login, logout,
// role normalisation and the existing auth context keep working unchanged.

function upsertStoredAccount(account) {
  const stored = readAccountsFromStorage();
  const key = normalize(account.username);
  const index = stored.findIndex((entry) => normalize(entry.username) === key);
  if (index >= 0) stored[index] = { ...stored[index], ...account };
  else stored.push(account);
  saveAccountsToStorage(stored);
  return account;
}

function sameIdentity(a, b) {
  return normalize(a) === normalize(b) && normalize(a) !== '';
}

export function findAccount(identity) {
  const key = normalize(identity);
  if (!key) return null;
  return getAccounts().find((entry) => normalize(entry.username) === key || normalize(entry.email) === key) || null;
}

/** Every administrator account, including seed accounts and Community Moderators. */
export function listAdministrativeAccounts() {
  return getAccounts().filter(isAdministrativeAccount);
}

export function createAdministrator(options = {}) {
  const fullName = String(options.fullName || options.displayName || '').trim();
  const username = String(options.username || '').trim().replace(/^@/, '');
  const email = String(options.email || '').trim();
  const password = String(options.password || '');
  const confirm = options.confirmPassword === undefined ? password : String(options.confirmPassword || '');
  const meta = resolveAdminRole(options.role);

  if (!fullName || !username || !email || !password) {
    return { ok: false, error: 'Full name, username, email and password are required.' };
  }
  if (fullName.length < 2) return { ok: false, error: 'Enter the administrator’s full name.' };
  if (username.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  if (confirm !== password) return { ok: false, error: 'Password and confirmation do not match.' };
  if (!meta) return { ok: false, error: 'Select a valid administrative role.' };
  if (meta.role === 'participant') return { ok: false, error: 'This form only creates administrative accounts.' };

  const accounts = getAccounts();
  const usernameKey = normalize(username);
  const emailKey = normalize(email);
  if (accounts.some((entry) => normalize(entry.username) === usernameKey)) {
    return { ok: false, error: 'That username is already in use.' };
  }
  if (accounts.some((entry) => normalize(entry.email) === emailKey)) {
    return { ok: false, error: 'That email address is already in use.' };
  }

  const account = {
    username,
    email,
    password,
    role: meta.role,
    adminType: meta.adminType,
    displayName: fullName,
    createdAt: new Date().toISOString(),
    status: 'active',
    banned: false,
    createdBy: String(options.createdBy || '').trim() || null,
  };
  upsertStoredAccount(account);
  return { ok: true, account };
}

/**
 * Mirrors the original Add Admin workflow: create a new account or elevate an
 * existing participant. New accounts use the same default password as the
 * platform seed accounts (`nexus`) and can sign in immediately.
 */
export function addOrElevateAdministrator(options = {}) {
  const uname = String(options.username || '').trim().replace(/^@/, '');
  if (!uname) return { ok: false, error: 'Please enter a username or email' };

  const email = String(options.email || (uname.includes('@') ? uname : `${uname}@nexus.gg`)).trim();
  const meta = resolveAdminRole(options.adminType);
  if (!meta) return { ok: false, error: 'Select a valid administrative role.' };

  const existing = findAccount(uname) || findAccount(email);
  if (existing) {
    if (isAdministrativeAccount(existing)) {
      return { ok: false, error: 'User is already an admin' };
    }
    const next = {
      ...existing,
      role: meta.role,
      adminType: meta.adminType,
      email: existing.email || email,
      revokedReason: null,
      updatedAt: new Date().toISOString(),
    };
    upsertStoredAccount(next);
    return { ok: true, account: next, elevated: true };
  }

  const account = {
    username: uname,
    email,
    password: 'nexus',
    role: meta.role,
    adminType: meta.adminType,
    displayName: uname,
    createdAt: new Date().toISOString(),
    status: 'active',
    banned: false,
    createdBy: String(options.actor || '').trim() || null,
  };
  upsertStoredAccount(account);
  return { ok: true, account, created: true };
}

export function updateAdministrator(identity, updates = {}) {
  const existing = findAccount(identity);
  if (!existing) return { ok: false, error: 'Administrator not found.' };

  const next = { ...existing };

  if (updates.displayName !== undefined) {
    const name = String(updates.displayName || '').trim();
    if (!name) return { ok: false, error: 'Display name cannot be empty.' };
    next.displayName = name;
  }

  if (updates.email !== undefined) {
    const email = String(updates.email || '').trim();
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
    const clash = getAccounts().some((entry) => (
      !sameIdentity(entry.username, existing.username) && normalize(entry.email) === normalize(email)
    ));
    if (clash) return { ok: false, error: 'That email address is already in use.' };
    next.email = email;
  }

  if (updates.role !== undefined) {
    const meta = resolveAdminRole(updates.role);
    if (!meta) return { ok: false, error: 'Select a valid administrative role.' };
    next.role = meta.role;
    next.adminType = meta.adminType;
  }

  if (updates.status !== undefined) {
    const status = String(updates.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
    next.status = status;
    next.banned = status === 'inactive';
  }

  upsertStoredAccount(next);

  if (sameIdentity(getSession()?.username, existing.username)) {
    const current = getSession();
    if (current) {
      setSession({
        ...current,
        displayName: next.displayName || current.displayName,
        email: next.email || current.email,
        role: next.role || current.role,
        adminType: next.adminType || current.adminType,
      });
    }
  }
  return { ok: true, account: next };
}

export function setAdministratorActive(identity, active, actor) {
  if (!active && sameIdentity(identity, actor)) {
    return { ok: false, error: 'You cannot deactivate your own account.' };
  }
  return updateAdministrator(identity, { status: active ? 'active' : 'inactive' });
}

export function revokeAdministrator(identity, options = {}) {
  const existing = findAccount(identity);
  if (!existing) return { ok: false, error: 'Administrator not found.' };
  if (sameIdentity(existing.username, options.actor)) {
    return { ok: false, error: 'You cannot revoke your own administrator access.' };
  }
  const next = {
    ...existing,
    role: 'participant',
    adminType: null,
    status: 'active',
    banned: false,
    revokedReason: String(options.reason || '').trim(),
    revokedAt: new Date().toISOString(),
    revokedBy: String(options.actor || '').trim() || null,
  };
  upsertStoredAccount(next);
  return { ok: true, account: next };
}

export function updateAccountProfile(identity, updates = {}) {
  const existing = findAccount(identity);
  if (!existing) return { ok: false, error: 'Account not found.' };
  const next = { ...existing };
  if (updates.displayName !== undefined) {
    const name = String(updates.displayName || '').trim();
    if (!name) return { ok: false, error: 'Name cannot be empty.' };
    next.displayName = name;
  }
  if (updates.email !== undefined) {
    const email = String(updates.email || '').trim();
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
    const clash = getAccounts().some((entry) => (
      !sameIdentity(entry.username, existing.username) && normalize(entry.email) === normalize(email)
    ));
    if (clash) return { ok: false, error: 'That email address is already in use.' };
    next.email = email;
  }
  upsertStoredAccount(next);
  if (sameIdentity(getSession()?.username, existing.username)) {
    const current = getSession();
    if (current) setSession({ ...current, displayName: next.displayName, email: next.email });
  }
  return { ok: true, account: next };
}

export function changeAccountPassword(identity, currentPassword, nextPassword) {
  const existing = findAccount(identity);
  if (!existing) return { ok: false, error: 'Account not found.' };
  if (String(existing.password || '') !== String(currentPassword || '')) {
    return { ok: false, error: 'Current password is incorrect.' };
  }
  const next = String(nextPassword || '');
  if (next.length < 6) return { ok: false, error: 'New password must be at least 6 characters.' };
  upsertStoredAccount({ ...existing, password: next });
  return { ok: true };
}

export function getSession() {
 // Try to get user from backend API first
  if (AuthAPI && AuthAPI.getCurrentUser) {
    const user = AuthAPI.getCurrentUser();
    if (user && user.username) {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      let displayName = user.username;
      if (firstName || lastName) {
        displayName = (firstName + ' ' + lastName).trim();
      }
      const account = getAccounts().find((entry) => normalize(entry.username) === normalize(user.username));
      return {
        username: user.username,
        role: normalizeRole(user.role),
        displayName: displayName,
        email: user.email,
        joinedAt: account && account.createdAt ? account.createdAt : null,
        lastLoginAt: Date.now(),
        loggedInAt: Date.now(),
      };
    }
  }

 // Fallback to localStorage
  const raw = readStorage(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.role || !parsed.username) return null;
    // Drop stale identity-verification fields left by the removed verification
    // feature. Nothing is invalidated — only obsolete keys are cleaned.
    const verifiedKeys = ['verificationStatus', 'organizerVerificationStatus', 'verifiedAt', 'aadhaarMasked'];
    let changed = false;
    verifiedKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        delete parsed[key];
        changed = true;
      }
    });
    if (changed) writeStorage(SESSION_KEY, JSON.stringify(parsed));
    return parsed;
  } catch (err) {
    return null;
  }
}

/** Browser state that belongs to one account and must not carry over to the next. */
function clearAccountScopedState() {
  removeStorage('nexus.team.activeContext');
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('nexus.verifiedJoinCode.') || key.startsWith('nexus.joinCode.'))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch (err) { /* sessionStorage unavailable — nothing cached */ }
}

export function setSession(session) {
  const next = { ...(session || {}) };
  ['verificationStatus', 'organizerVerificationStatus', 'verifiedAt', 'aadhaarMasked'].forEach((key) => delete next[key]);
  writeStorage(SESSION_KEY, JSON.stringify(next));
}

export function clearSession() {
  if (AuthAPI && AuthAPI.logout) {
    AuthAPI.logout();
  }
  clearAccountScopedState();
  removeStorage(SESSION_KEY);
}

export function authenticate(username, password) {
  const usernameNorm = normalize(username);
  const passwordValue = String(password || '');

  if (!usernameNorm || !passwordValue) {
    return null;
  }

  const account = getAccounts().find((entry) => {
    const matchesIdentity = normalize(entry.username) === usernameNorm || normalize(entry.email) === usernameNorm;
    return matchesIdentity && String(entry.password) === passwordValue;
  });

  if (!account) {
    return null;
  }

  if (account.banned) {
    console.warn('Login blocked: account is banned', usernameNorm);
    return null;
  }

  return {
    username: account.username,
    role: account.role,
    displayName: account.displayName || account.username,
    email: account.email || '',
    joinedAt: account.createdAt || null,
    loggedInAt: Date.now(),
  };
}

export async function createAccount(options) {
  const opts = options || {};
  const username = String(opts.username || '').trim();
  const email = String(opts.email || '').trim();
  const password = String(opts.password || '');
  const firstName = String(opts.firstName || username).trim();
  const lastName = String(opts.lastName || '').trim();
  const displayName = (firstName + ' ' + lastName).trim() || username;

  if (!username || !email || !password) {
    return { ok: false, error: 'All fields are required.' };
  }

  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  const accounts = getAccounts();
  const usernameKey = normalize(username);
  const emailKey = normalize(email);
  const exists = accounts.some((entry) => normalize(entry.username) === usernameKey || normalize(entry.email) === emailKey);
  if (exists) {
    return { ok: false, error: 'An account already exists for this username or email.' };
  }

  let apiResult = null;
  if (AuthAPI) {
    // The backend assigns the safe participant role. Do not send a client-
    // controlled role: RegisterDto intentionally rejects unknown properties.
    apiResult = await AuthAPI.register(email, username, password);
    if (apiResult && !apiResult.ok) {
      const msg = String(apiResult.error || '').toLowerCase();
      const isNetworkError = msg.includes('network') || msg.includes('failed') || msg.includes('unavailable');
      if (!isNetworkError) {
        return { ok: false, error: apiResult.error || 'Signup failed' };
      }
    }
  }

  accounts.push({
    username: username,
    email: email,
    password: password,
    role: 'participant',
    displayName: displayName,
    createdAt: new Date().toISOString(),
  });
  saveAccountsToStorage(accounts);

  return { ok: true, message: 'Account created successfully!' };
}

export function getRoleProfilePath(role, roleRoutes) {
  if (!roleRoutes || typeof roleRoutes !== 'object') return null;
  return roleRoutes[role] || null;
}

/**
 * Same decision logic, but returns the redirect target instead of
 * performing `window.location.replace` (the router performs it).
 * Returns { session, redirectTo }.
 */
export function requireProfileAccess(options) {
  const opts = options || {};
  const session = getSession();

  if (!session) {
    return { session: null, redirectTo: opts.loginPath || null };
  }

  if (opts.pageRole && session.role !== opts.pageRole) {
    const expectedPath = getRoleProfilePath(session.role, opts.roleRoutes);
    if (expectedPath) {
      return { session: null, redirectTo: expectedPath };
    }
    return { session: null, redirectTo: null };
  }

  return { session, redirectTo: null };
}

/**
 * Logs in and returns
 * { ok, message, user?, revokedReason?, redirectPath? } on success
 * { ok:false, error } on failure
 * The caller (router/page) performs `redirectPath` navigation.
 */
export async function login(options) {
  const opts = options || {};

  if (!AuthAPI) {
    console.error('NexusAPI not available');
    return { ok: false, error: 'API service is unavailable.' };
  }

 // Call backend API
  const result = await AuthAPI.login(opts.username, opts.password);

  if (!result.ok) {
    const local = authenticate(opts.username, opts.password);
    if (!local) {
 // Check if account exists
      const account = getAccounts().find(
        (entry) => normalize(entry.username) === normalize(opts.username) || normalize(entry.email) === normalize(opts.username),
      );
      if (account && account.banned) {
        return { ok: false, error: 'Your account has been permanently banned for platform violations.' };
      }

 // If account exists locally but password did not match -> WRONG PASSWORD!
      if (account) {
        return { ok: false, error: 'Wrong password entered. Please check your password and try again.' };
      }

      const errLower = String(result.error || '').toLowerCase();
      if (errLower.includes('password') || errLower.includes('credential') || errLower.includes('unauthorized') || errLower.includes('401')) {
        return { ok: false, error: 'Wrong password entered. Please check your password and try again.' };
      }

      if (errLower.includes('no user') || errLower.includes('not found') || errLower.includes('404')) {
        return { ok: false, error: 'No account found with that username or email.' };
      }

      if (errLower.includes('failed') || errLower.includes('network')) {
        return { ok: false, error: 'Wrong password or invalid credentials entered. Please try again.' };
      }

      return {
        ok: false,
        error: result.error || 'Wrong password entered. Please check your password and try again.',
      };
    }

 // Offline/local fallback login
    const localAccount = getAccounts().find((entry) => normalize(entry.username) === normalize(local.username));
    const sessionObj = {
      username: local.username,
      role: normalizeRole(local.role),
      displayName: local.displayName,
      email: local.email || '',
      joinedAt: localAccount && localAccount.createdAt ? localAccount.createdAt : null,
      lastLoginAt: Date.now(),
      loggedInAt: Date.now(),
    };
    clearAccountScopedState();
    setSession(sessionObj);

    const localRedirect = getRoleProfilePath(local.role, opts.roleRoutes) || opts.fallbackPath || '../index.html';

    return {
      ok: true,
      message: 'Login successful! (offline)',
      user: sessionObj,
      redirectPath: localRedirect,
    };
  }

 // Login successful (API)
  const user = AuthAPI.getCurrentUser();
  const identity = user?.username || opts.username;

  const account = getAccounts().find((entry) => normalize(entry.username) === normalize(identity));
  // A locally stored override is authoritative for role and status. This is
  // what makes Super Admin role changes and deactivations take effect for
  // accounts that also exist in the seed/backend directory.
  const storedOverride = readAccountsFromStorage().find((entry) => (
    normalize(entry.username) === normalize(identity) || normalize(entry.email) === normalize(identity)
  ));

  if ((account && account.banned) || (storedOverride && (storedOverride.banned || storedOverride.status === 'inactive'))) {
    console.warn('API login succeeded but account is inactive locally.');
    return { ok: false, error: 'This account is deactivated. Contact the platform administrator.' };
  }

  const userRole = normalizeRole(storedOverride?.role || user?.role || (account && account.role) || 'participant');
  const adminType = storedOverride?.adminType || user?.adminType || null;
  const revokedReason = user?.revokedReason || storedOverride?.revokedReason || null;

 // Build and persist the session object
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  let displayName = storedOverride?.displayName || user?.username || 'User';
  if (!storedOverride?.displayName && (firstName || lastName)) {
    displayName = (firstName + ' ' + lastName).trim();
  }

  const sessionObj = {
    username: user?.username || opts.username,
    role: userRole,
    adminType: adminType,
    displayName: displayName,
    email: storedOverride?.email || user?.email || '',
    joinedAt: account && account.createdAt ? account.createdAt : null,
    lastLoginAt: Date.now(),
    loggedInAt: Date.now(),
  };
  clearAccountScopedState();
  setSession(sessionObj);

  const redirectPath = getRoleProfilePath(userRole, opts.roleRoutes) || opts.fallbackPath || '../index.html';

  return {
    ok: true,
    message: 'Login successful!',
    user: sessionObj,
    revokedReason: revokedReason,
    redirectPath: redirectPath,
  };
}

/** Test/diagnostic helper — mirrors the token presence check. */
export function isAuthenticated() {
  return !!getApiToken() && !!getApiUser();
}

const NexusAuth = {
  SESSION_KEY,
  ACCOUNTS_KEY,
  getAccounts,
  findAccount,
  listAdministrativeAccounts,
  createAdministrator,
  addOrElevateAdministrator,
  updateAdministrator,
  setAdministratorActive,
  revokeAdministrator,
  updateAccountProfile,
  changeAccountPassword,
  getSession,
  setSession,
  clearSession,
  authenticate,
  createAccount,
  login,
  requireProfileAccess,
  getRoleProfilePath,
  normalizeRole,
  isAuthenticated,
};

export default NexusAuth;


