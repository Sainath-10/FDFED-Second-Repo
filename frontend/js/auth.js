(function (window) {
  const SESSION_KEY = 'nexus.auth.session';
  const ACCOUNTS_KEY = 'nexus.auth.accounts';

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

  function normalizeRole(role) {
    const key = normalize(role);
    if (key === 'super_admin') return 'super-admin';
    if (key === 'teamlead') return 'team_lead';
    return key;
  }

  function getSeedAccounts() {
    if (Array.isArray(window.NEXUS_DEMO_ACCOUNTS) && window.NEXUS_DEMO_ACCOUNTS.length) {
      return window.NEXUS_DEMO_ACCOUNTS;
    }

    return [
      { username: 'regular@nexus.gg', password: 'regular123', role: 'regular', displayName: 'Regular User' },
      { username: 'admin@nexus.gg', password: 'admin123', role: 'admin', displayName: 'Admin User' },
      { username: 'superadmin@nexus.gg', password: 'super123', role: 'super-admin', displayName: 'Super Admin' }
    ];
  }

  function readAccountsFromStorage() {
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

  function saveAccountsToStorage(accounts) {
    writeStorage(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function getAccounts() {
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

  function getSession() {
    // Try to get user from backend API first
    if (window.NexusAPI && window.NexusAPI.Auth.getCurrentUser) {
      const user = window.NexusAPI.Auth.getCurrentUser();
      if (user && user.username) {
        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        let displayName = user.username;
        if (firstName || lastName) {
          displayName = (firstName + ' ' + lastName).trim();
        }
        const account = getAccounts().find(entry => normalize(entry.username) === normalize(user.username));
        return {
          username: user.username,
          role: normalizeRole(user.role),
          displayName: displayName,
          email: user.email,
          joinedAt: account && account.createdAt ? account.createdAt : null,
          lastLoginAt: Date.now(),
          loggedInAt: Date.now()
        };
      }
    }

    // Fallback to localStorage
    const raw = readStorage(SESSION_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.role || !parsed.username) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function setSession(session) {
    writeStorage(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    if (window.NexusAPI && window.NexusAPI.Auth.logout) {
      window.NexusAPI.Auth.logout();
    }
    removeStorage(SESSION_KEY);
  }

  function authenticate(username, password) {
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
      console.warn('Login blocked: account is banned', usernameNorm);
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

  async function createAccount(options) {
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

    let apiResult = null;
    if (window.NexusAPI) {
      apiResult = await window.NexusAPI.Auth.register(email, username, password, firstName, lastName, 'participant');
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
      createdAt: new Date().toISOString()
    });
    saveAccountsToStorage(accounts);

    return {
      ok: true,
      message: 'Account created successfully!'
    };
  }

  function getRoleProfilePath(role, roleRoutes) {
    if (!roleRoutes || typeof roleRoutes !== 'object') return null;
    return roleRoutes[role] || null;
  }

  function requireProfileAccess(options) {
    const opts = options || {};
    const session = getSession();

    if (!session) {
      if (opts.loginPath) {
        window.location.replace(opts.loginPath);
      }
      return null;
    }

    if (opts.pageRole && session.role !== opts.pageRole) {
      const expectedPath = getRoleProfilePath(session.role, opts.roleRoutes);
      if (expectedPath) {
        window.location.replace(expectedPath);
      }
      return null;
    }

    return session;
  }

  async function login(options) {
    const opts = options || {};

    if (!window.NexusAPI) {
      console.error('NexusAPI not available');
      return {
        ok: false,
        error: 'API service is unavailable.'
      };
    }

    console.log('Calling NexusAPI.Auth.login with:', { username: opts.username, password: '***' });

    // Call backend API
    const result = await window.NexusAPI.Auth.login(opts.username, opts.password);

    console.log('NexusAPI.Auth.login result:', result);

    if (!result.ok) {
      console.error('Login failed:', result.error);
      const local = authenticate(opts.username, opts.password);
      if (!local) {
        // Check if it's because they are banned
        const account = getAccounts().find(entry => normalize(entry.username) === normalize(opts.username));
        if (account && account.banned) {
            return { ok: false, error: 'Your account has been permanently banned for platform violations.' };
        }
        return {
          ok: false,
          error: result.error || 'Login failed'
        };
      }

      const localAccount = getAccounts().find(entry => normalize(entry.username) === normalize(local.username));
      setSession({
        username: local.username,
        role: normalizeRole(local.role),
        displayName: local.displayName,
        email: local.email || '',
        joinedAt: localAccount && localAccount.createdAt ? localAccount.createdAt : null,
        lastLoginAt: Date.now(),
        loggedInAt: Date.now()
      });

      const localRedirect = getRoleProfilePath(local.role, opts.roleRoutes) || opts.fallbackPath || '../index.html';
      setTimeout(() => {
        window.location.href = localRedirect;
      }, 200);

      return {
        ok: true,
        message: 'Login successful! (offline)'
      };
    }

    // Login successful
    const user = window.NexusAPI.Auth.getCurrentUser();
    console.log('Current user after login:', user);
    console.log('User role:', user?.role);
    console.log('Role routes available:', opts.roleRoutes);
    
    const account = getAccounts().find(entry => normalize(entry.username) === normalize(user?.username || opts.username));
    
    if (account && account.banned) {
      console.warn('API login succeeded but account is banned locally.');
      return { ok: false, error: 'Your account has been permanently banned for platform violations.' };
    }

    const userRole = normalizeRole((account && account.role) || user?.role || 'participant');
    console.log('Using role for redirect:', userRole);

    // Build and persist the session object so that page-level auth guards
    // (which check for 'nexus.auth.session' in localStorage) allow access.
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    let displayName = user?.username || 'User';
    if (firstName || lastName) {
      displayName = (firstName + ' ' + lastName).trim();
    }

    const sessionObj = {
      username: user?.username || opts.username,
      role: userRole,
      displayName: displayName,
      email: user?.email || '',
      joinedAt: account && account.createdAt ? account.createdAt : null,
      lastLoginAt: Date.now(),
      loggedInAt: Date.now()
    };
    setSession(sessionObj);
    console.log('Session saved:', sessionObj);
    
    // Get redirect path from roleRoutes passed in options
    const redirectPath = getRoleProfilePath(userRole, opts.roleRoutes) || opts.fallbackPath || '../index.html';

    console.log('getRoleProfilePath result:', getRoleProfilePath(userRole, opts.roleRoutes));
    console.log('Final redirect path:', redirectPath);
    console.log('About to redirect to:', redirectPath);

    // Redirect after short delay
    setTimeout(() => {
      console.log('Executing redirect to:', redirectPath);
      window.location.href = redirectPath;
    }, 300);

    return {
      ok: true,
      message: 'Login successful!',
      redirectPath
    };
  }

  window.NexusAuth = {
    SESSION_KEY,
    ACCOUNTS_KEY,
    getAccounts,
    getSession,
    setSession,
    clearSession,
    authenticate,
    createAccount,
    login,
    requireProfileAccess,
    getRoleProfilePath
  };
})(window);
