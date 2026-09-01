if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('users', '../../');
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

  // Build a map of stored accounts by username for quick lookup
  const storedMap = {};
  stored.forEach(a => {
    if (a && a.username) storedMap[normalize(a.username)] = a;
  });

  const seen = new Set();
  return seed.concat(stored).filter(account => {
    const key = normalize(account && account.username);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(account => {
    // Overlay stored data (including banned flag) onto seed data
    const key = normalize(account.username);
    const storedEntry = storedMap[key];
    return storedEntry ? Object.assign({}, account, storedEntry) : account;
  });
}

function formatRole(role, adminType) {
  const t = String(adminType || role || '').toLowerCase();
  if (t.includes('super')) return 'Super Admin';
  if (t.includes('dispute')) return 'Dispute Admin';
  if (t.includes('revenue')) return 'Revenue Admin';
  if (t.includes('comp')) return 'Comp Admin';
  if (t === 'admin') return 'Admin';
  return 'User';
}

function getRoleBadgeHtml(account) {
  if (account.banned || account.isBanned) {
    return `<span class="sa-role-pill" style="background:rgba(231,0,11,0.15);color:#e7000b;border:1px solid rgba(231,0,11,0.3);">BANNED</span>`;
  }
  const t = String(account.adminType || account.role || '').toLowerCase();
  if (t.includes('super')) {
    return `<span class="sa-role-pill" style="background:rgba(231,0,11,0.15);color:#e7000b;border:1px solid rgba(231,0,11,0.3);">SUPER ADMIN</span>`;
  }
  if (t.includes('comp')) {
    return `<span class="sa-role-pill" style="background:rgba(198,255,51,0.15);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);">COMP ADMIN</span>`;
  }
  if (t.includes('dispute')) {
    return `<span class="sa-role-pill" style="background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.3);">DISPUTE ADMIN</span>`;
  }
  if (t.includes('revenue')) {
    return `<span class="sa-role-pill" style="background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3);">REVENUE ADMIN</span>`;
  }
  if (t === 'admin') {
    return `<span class="sa-role-pill" style="background:rgba(198,255,51,0.15);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);">ADMIN</span>`;
  }
  return `<span class="sa-role-pill" style="background:rgba(255,255,255,0.06);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);">USER</span>`;
}

function renderUsers(list) {
  const body = document.getElementById('users-table-body');
  const empty = document.getElementById('users-empty');
  if (!body) return;

  if (!list.length) {
    body.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  body.innerHTML = list.map(account => {
    const username = account.username || 'unknown';
    const email = account.email || (username.includes('@') ? username : '—');
    const isBanned = !!(account.banned || account.isBanned);
    const rolePill = getRoleBadgeHtml(account);
    const rowStyle = isBanned ? ' style="opacity:0.5;"' : '';
    return `
      <tr${rowStyle}>
        <td>${username}${isBanned ? ' <span style="font-size:10px;color:#e7000b;">(banned)</span>' : ''}</td>
        <td>${rolePill}</td>
        <td class="sa-email">${email}</td>
      </tr>`;
  }).join('');
}


let currentRoster = [];

function applySearch() {
  const input = document.getElementById('users-search');
  const query = normalize(input && input.value);
  const list = currentRoster.length ? currentRoster : mergeAccountsWithBanStatus();

  if (!query) {
    renderUsers(list);
    return;
  }

  const filtered = list.filter(account => {
    const haystack = [
      account.username,
      account.email,
      account.adminType,
      account.role,
      account.banned ? 'banned' : ''
    ].map(normalize).join(' ');
    return haystack.includes(query);
  });

  renderUsers(filtered);
}

async function syncAndRenderUsers() {
  currentRoster = mergeAccountsWithBanStatus();
  renderUsers(currentRoster);

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
            const existing = map[key] || {};
            map[key] = Object.assign({}, existing, {
              id: u.id || existing.id,
              username: username,
              email: u.email || existing.email || (username.includes('@') ? username : '—'),
              role: u.adminType || u.role || existing.role || 'regular',
              adminType: u.adminType || existing.adminType || u.role,
              banned: typeof u.banned === 'boolean' ? u.banned : !!existing.banned,
              warningCount: typeof u.warningCount === 'number' ? u.warningCount : (existing.warningCount || 0)
            });
          }
        });

        currentRoster = Object.values(map);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(currentRoster));

        const searchInput = document.getElementById('users-search');
        if (searchInput && searchInput.value.trim()) {
          applySearch();
        } else {
          renderUsers(currentRoster);
        }
      }
    }
  } catch (err) {
    console.warn('Backend DB fetch offline, using cached roster:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  syncAndRenderUsers();
  const input = document.getElementById('users-search');
  if (input) input.addEventListener('input', applySearch);
});
