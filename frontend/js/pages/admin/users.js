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

function applySearch() {
  const input = document.getElementById('users-search');
  const query = normalize(input && input.value);
  const list = mergeAccountsWithBanStatus();

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

document.addEventListener('DOMContentLoaded', () => {
  renderUsers(mergeAccountsWithBanStatus());
  const input = document.getElementById('users-search');
  if (input) input.addEventListener('input', applySearch);
});
