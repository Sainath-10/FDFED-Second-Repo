import NexusAPI from './api';

const SESSION_KEY = 'nexus.auth.session';
const ACCOUNTS_KEY = 'nexus.auth.accounts';

export function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {}
}

export function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {}
}

export function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeRole(role) {
  const key = normalize(role);
  if (key === 'super_admin') return 'super-admin';
  if (key === 'teamlead') return 'team_lead';
  return key;
}

export function getSeedAccounts() {
  if (typeof window !== 'undefined' && Array.isArray(window.NEXUS_DEMO_ACCOUNTS) && window.NEXUS_DEMO_ACCOUNTS.length) {
    return window.NEXUS_DEMO_ACCOUNTS;
  }

  return [
    { username: 'regular@nexus.gg', password: 'regular123', role: 'regular', displayName: 'Regular User' },
    { username: 'admin@nexus.gg', password: 'admin123', role: 'admin', displayName: 'Admin User' },
    { username: 'superadmin@nexus.gg', password: 'super123', role: 'super-admin', displayName: 'Super Admin' }
  ];
}

export function readAccountsFromStorage() {
  const raw = readStorage(ACCOUNTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(entry => entry && entry.username && entry.password && entry.role);
  } catch (err) {
    return [];
  }
}

export function saveAccountsToStorage(accounts) {
  writeStorage(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getAccounts() {
  const seedAccounts = getSeedAccounts();
  const storedAccounts = readAccountsFromStorage();

  if (!storedAccounts.length) {
    return seedAccounts;
  }

  const merged = [...storedAccounts];
  const known = new Set(storedAccounts.map(entry => normalize(entry.username)));

  seedAccounts.forEach(entry => {
    const id = normalize(entry.username);
    if (!known.has(id)) {
      merged.push(entry);
    }
  });

  return merged;
}

export function getSession() {
  if (NexusAPI && NexusAPI.Auth && NexusAPI.Auth.getCurrentUser) {
    const user = NexusAPI.Auth.getCurrentUser();
    if (user && user.username) {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      let displayName = user.username;
      if (firstName || lastName) {
        displayName = (firstName + ' ' + lastName).trim();
      }
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: normalizeRole(user.role),
        adminType: user.adminType,
        displayName: displayName,
      };
    }
  }

  const raw = readStorage(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.username || !parsed.role) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function setSession(account) {
  if (!account || !account.username || !account.role) return;

  const session = {
    username: account.username,
    displayName: account.displayName || account.username,
    role: account.role,
    adminType: account.adminType,
    id: account.id || account.username,
    loggedInAt: new Date().toISOString()
  };

  writeStorage(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  removeStorage(SESSION_KEY);
  if (NexusAPI && NexusAPI.Auth && NexusAPI.Auth.logout) {
    NexusAPI.Auth.logout();
  }
}

export function isAuthenticated() {
  return !!getSession();
}

export function authenticate(username, password) {
  const usernameNorm = normalize(username);
  const passwordValue = String(password || '');

  if (!usernameNorm || !passwordValue) {
    return null;
  }

  const account = getAccounts().find(entry => {
    const matchesIdentity = normalize(entry.username) === usernameNorm || normalize(entry.email) === usernameNorm;
    return matchesIdentity && String(entry.password) === passwordValue;
  });

  if (!account) {
    return null;
  }

  if (account.banned) {
    return null;
  }

  return {
    username: account.username,
    role: account.role,
    displayName: account.displayName || account.username,
    email: account.email || '',
    joinedAt: account.createdAt || null,
    loggedInAt: Date.now()
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
    return {
      ok: false,
      error: 'All fields are required.'
    };
  }

  if (password.length < 6) {
    return {
      ok: false,
      error: 'Password must be at least 6 characters.'
    };
  }

  const accounts = getAccounts();
  const usernameKey = normalize(username);
  const emailKey = normalize(email);
  const exists = accounts.some(entry => normalize(entry.username) === usernameKey || normalize(entry.email) === emailKey);
  if (exists) {
    return { ok: false, error: 'An account already exists for this username or email.' };
  }

  if (NexusAPI && NexusAPI.Auth && NexusAPI.Auth.register) {
    try {
      const apiResult = await NexusAPI.Auth.register(email, username, password, 'participant');
      if (apiResult && !apiResult.ok) {
        const msg = String(apiResult.error || '').toLowerCase();
        const isNetworkError = msg.includes('network') || msg.includes('failed') || msg.includes('unavailable');
        if (!isNetworkError) {
          return { ok: false, error: apiResult.error || 'Signup failed' };
        }
      }
    } catch (e) {}
  }

  accounts.push({
    username: username,
    email: email,
    password: password,
    role: 'participant',
    displayName: displayName,
    createdAt: new Date().toISOString()
  });
  saveAccountsToStorage(accounts);

  return {
    ok: true,
    message: 'Account created successfully!'
  };
}

export function getRoleProfilePath(role, roleRoutes) {
  if (!roleRoutes || typeof roleRoutes !== 'object') return null;
  return roleRoutes[role] || null;
}

export async function login(options) {
  const opts = options || {};

  // Try backend API first
  let apiResult = null;
  if (NexusAPI && NexusAPI.Auth && NexusAPI.Auth.login) {
    try {
      apiResult = await NexusAPI.Auth.login(opts.username, opts.password);
    } catch (e) {
      apiResult = { ok: false, error: e.message };
    }
  }

  if (!apiResult || !apiResult.ok) {
    const local = authenticate(opts.username, opts.password);
    if (!local) {
      const account = getAccounts().find(entry => normalize(entry.username) === normalize(opts.username) || normalize(entry.email) === normalize(opts.username));
      if (account && account.banned) {
        return { ok: false, error: 'Your account has been permanently banned for platform violations.' };
      }
      if (account) {
        return { ok: false, error: 'Wrong password entered. Please check your password and try again.' };
      }
      const errLower = String(apiResult && apiResult.error || '').toLowerCase();
      if (errLower.includes('password') || errLower.includes('credential') || errLower.includes('unauthorized') || errLower.includes('401')) {
        return { ok: false, error: 'Wrong password entered. Please check your password and try again.' };
      }
      if (errLower.includes('no user') || errLower.includes('not found') || errLower.includes('404')) {
        return { ok: false, error: 'No account found with that username or email.' };
      }
      return { ok: false, error: (apiResult && apiResult.error) || 'Wrong password or invalid credentials entered. Please try again.' };
    }

    const localAccount = getAccounts().find(entry => normalize(entry.username) === normalize(local.username));
    const sessionObj = {
      username: local.username,
      role: normalizeRole(local.role),
      displayName: local.displayName,
      email: local.email || '',
      joinedAt: localAccount && localAccount.createdAt ? localAccount.createdAt : null,
      lastLoginAt: Date.now(),
      loggedInAt: Date.now()
    };
    setSession(sessionObj);

    const localRedirect = getRoleProfilePath(local.role, opts.roleRoutes) || opts.fallbackPath || '/';
    return {
      ok: true,
      message: 'Login successful! (offline)',
      user: sessionObj,
      redirectPath: localRedirect
    };
  }

  // API login succeeded
  const user = NexusAPI.Auth.getCurrentUser();
  const account = getAccounts().find(entry => normalize(entry.username) === normalize(user?.username || opts.username));

  if (account && account.banned) {
    return { ok: false, error: 'Your account has been permanently banned for platform violations.' };
  }

  const userRole = normalizeRole(user?.role || (account && account.role) || 'participant');
  const adminType = user?.adminType || null;
  const revokedReason = user?.revokedReason || null;

  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  let displayName = user?.username || 'User';
  if (firstName || lastName) {
    displayName = (firstName + ' ' + lastName).trim();
  }

  const sessionObj = {
    username: user?.username || opts.username,
    role: userRole,
    adminType: adminType,
    displayName: displayName,
    email: user?.email || '',
    joinedAt: account && account.createdAt ? account.createdAt : null,
    lastLoginAt: Date.now(),
    loggedInAt: Date.now()
  };
  setSession(sessionObj);

  const redirectPath = getRoleProfilePath(userRole, opts.roleRoutes) || opts.fallbackPath || '/';

  return {
    ok: true,
    message: 'Login successful!',
    user: sessionObj,
    revokedReason: revokedReason,
    redirectPath: redirectPath
  };
}

export const NexusAuth = {
  SESSION_KEY,
  ACCOUNTS_KEY,
  getAccounts,
  getSession,
  setSession,
  clearSession,
  authenticate,
  createAccount,
  login,
  normalizeRole,
  isAuthenticated,
  getRoleProfilePath
};

if (typeof window !== 'undefined') {
  window.NexusAuth = NexusAuth;
  window.logout = () => {
    clearSession();
    window.location.href = '/login';
  };
}

export default NexusAuth;
