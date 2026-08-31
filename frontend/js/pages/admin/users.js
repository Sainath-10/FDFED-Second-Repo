initAdminSidebar('users');
initFooter('../../');

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

function mergeAccounts() {
  const seed = getSeedAccounts();
  const stored = readStoredAccounts();
  const seen = new Set();

  return seed.concat(stored).filter(account => {
    const key = normalize(account && account.username);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatRole(role) {
  const map = {
    regular: 'User',
    participant: 'User',
    team_lead: 'User',
    admin: 'Admin',
    'super-admin': 'Super Admin',
    super_admin: 'Super Admin'
  };
  return map[normalize(role)] || 'User';
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
    const roleLabel = formatRole(account.role);
    const email = account.email || (username.includes('@') ? username : '—');
    const isBanned = !!account.banned;
    const rolePill = isBanned
      ? `<span class="sa-role-pill" style="background:rgba(231,0,11,0.15);color:#e7000b;border:1px solid rgba(231,0,11,0.3);">BANNED</span>`
      : `<span class="sa-role-pill">${roleLabel}</span>`;
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
              role: u.role || existing.role || 'regular',
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
