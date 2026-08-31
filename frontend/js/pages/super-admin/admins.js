if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('admins', '../../');
}

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function readStoredAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function getSeedAccounts() {
  return Array.isArray(window.NEXUS_DEMO_ACCOUNTS) ? window.NEXUS_DEMO_ACCOUNTS : [];
}

function mergeAccountsWithBanStatus() {
  const seed = getSeedAccounts();
  const stored = readStoredAccounts();

  const storedMap = {};
  stored.forEach(a => {
    if (a && a.username) storedMap[normalize(a.username)] = a;
  });

  const seen = new Set();
  const allAccounts = seed.concat(stored).filter(account => {
    const key = normalize(account && account.username);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(account => {
    const key = normalize(account.username);
    const storedEntry = storedMap[key];
    return storedEntry ? Object.assign({}, account, storedEntry) : account;
  });

  // Filter ONLY admins & super admins
  return allAccounts.filter(account => {
    const r = normalize(account.role);
    return r === 'admin' || r === 'super-admin' || r === 'super_admin';
  });
}

function formatRole(role) {
  const map = {
    admin: 'Admin',
    'super-admin': 'Super Admin',
    super_admin: 'Super Admin'
  };
  return map[normalize(role)] || 'Admin';
}

function renderAdmins(list) {
  const body = document.getElementById('admins-table-body');
  const empty = document.getElementById('admins-empty');
  if (!body) return;

  if (!list.length) {
    body.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  body.innerHTML = list.map(account => {
    const username = account.username || 'unknown';
    const roleLabel = formatRole(account.role);
    const email = account.email || (username.includes('@') ? username : '—');
    const isBanned = !!account.banned;
    const rolePill = isBanned
      ? `<span class="sa-role-pill" style="background:rgba(231,0,11,0.15);color:#e7000b;border:1px solid rgba(231,0,11,0.3);">BANNED</span>`
      : `<span class="sa-role-pill" style="background:rgba(198,255,51,0.12);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);">${roleLabel}</span>`;
    
    return `
      <tr style="cursor:pointer;" onclick="window.location.href='../admin/admin-activity.html?admin=${encodeURIComponent(username)}'">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:rgba(198,255,51,0.15);border:1px solid rgba(198,255,51,0.3);display:flex;align-items:center;justify-content:center;font-weight:800;color:#c6ff33;font-size:13px;">
              ${username.charAt(0).toUpperCase()}
            </div>
            <span style="font-weight:600;color:#f5f5f5;">${username}</span>
          </div>
        </td>
        <td>${rolePill}</td>
        <td class="sa-email">${email}</td>
        <td style="text-align:right;" onclick="event.stopPropagation();">
          <a href="../admin/admin-activity.html?admin=${encodeURIComponent(username)}" 
             style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(198,255,51,0.12);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;transition:all 0.2s ease;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="8" cy="8" r="6"/>
              <path d="M8 5v3.5l2.5 1.5"/>
            </svg>
            View Activity
          </a>
        </td>
      </tr>`;
  }).join('');
}

let currentRoster = [];

function applySearch() {
  const input = document.getElementById('admins-search');
  const query = normalize(input && input.value);
  const list = currentRoster.length ? currentRoster : mergeAccountsWithBanStatus();

  if (!query) {
    renderAdmins(list);
    return;
  }

  const filtered = list.filter(account => {
    const haystack = [
      account.username,
      account.email,
      account.role
    ].map(normalize).join(' ');
    return haystack.includes(query);
  });

  renderAdmins(filtered);
}

async function syncAndRenderAdmins() {
  currentRoster = mergeAccountsWithBanStatus();
  renderAdmins(currentRoster);

  try {
    const res = await fetch('http://localhost:3001/auth/users');
    if (res.ok) {
      const dbUsers = await res.json();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        const stored = readStoredAccounts();
        const map = {};

        getSeedAccounts().forEach(a => {
          if (a && a.username) map[normalize(a.username)] = a;
        });

        stored.forEach(a => {
          if (a && a.username) map[normalize(a.username)] = a;
        });

        dbUsers.forEach(u => {
          if (u && (u.username || u.email)) {
            const username = u.username || u.email;
            const key = normalize(username);
            map[key] = {
              username: username,
              role: u.role || 'regular',
              email: u.email || (username.includes('@') ? username : `${username}@nexus.gg`),
              banned: !!u.banned
            };
          }
        });

        const mergedAll = Object.values(map);
        currentRoster = mergedAll.filter(a => {
          const r = normalize(a.role);
          return r === 'admin' || r === 'super-admin' || r === 'super_admin';
        });

        renderAdmins(currentRoster);
      }
    }
  } catch (e) {
    console.warn('Could not fetch DB users for Admins roster, using local fallback:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  syncAndRenderAdmins();
  const searchInput = document.getElementById('admins-search');
  if (searchInput) {
    searchInput.addEventListener('input', applySearch);
  }
});
