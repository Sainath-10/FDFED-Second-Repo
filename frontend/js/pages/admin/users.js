initAdminSidebar('users');
initFooter('../../');

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function formatRole(role) {
  const map = {
    regular: 'Participant',
    participant: 'Participant',
    team_lead: 'Team Lead',
    admin: 'Admin',
    'super-admin': 'Super Admin',
    super_admin: 'Super Admin',
  };
  return map[normalize(role)] || 'Participant';
}

function getRolePillClass(role) {
  const r = normalize(role);
  if (r === 'super_admin' || r === 'super-admin') return 'sa-role-pill-super';
  if (r === 'admin') return 'sa-role-pill-admin';
  if (r === 'team_lead') return 'sa-role-pill-lead';
  return 'sa-role-pill-user';
}

let cachedUsers = [];

async function loadUsers() {
  if (window.NexusAPI && window.NexusAPI.Admin) {
    const res = await window.NexusAPI.Admin.getAllUsers();
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      cachedUsers = res.data;
      renderUsers(cachedUsers);
      return;
    }
  }

  // Fallback to local accounts
  try {
    const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    const seed = Array.isArray(window.NEXUS_DEMO_ACCOUNTS) ? window.NEXUS_DEMO_ACCOUNTS : [];
    const seen = new Set();
    cachedUsers = seed.concat(stored).filter(account => {
      const key = normalize(account && account.username);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (e) {
    cachedUsers = [];
  }
  renderUsers(cachedUsers);
}

function renderUsers(list) {
  const body = document.getElementById('users-table-body');
  const empty = document.getElementById('users-empty');
  if (!body) return;

  if (!list || !list.length) {
    body.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  body.innerHTML = list.map(account => {
    const username = account.username || 'unknown';
    const roleLabel = formatRole(account.role);
    const email = account.email || (username.includes('@') ? username : '—');
    const rolePill = `<span class="sa-role-pill" style="font-size:11px;font-weight:700;">${roleLabel}</span>`;
    
    return `
      <tr>
        <td style="font-weight:600;color:var(--text-main);">${username}</td>
        <td>${rolePill}</td>
        <td class="sa-email" style="color:var(--text-muted);">${email}</td>
      </tr>`;
  }).join('');
}

function applySearch() {
  const input = document.getElementById('users-search');
  const query = normalize(input && input.value);

  if (!query) {
    renderUsers(cachedUsers);
    return;
  }

  const filtered = cachedUsers.filter(account => {
    const haystack = [
      account.username,
      account.email,
      account.role,
      account.firstName,
      account.lastName,
    ].map(normalize).join(' ');
    return haystack.includes(query);
  });

  renderUsers(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  const input = document.getElementById('users-search');
  if (input) input.addEventListener('input', applySearch);
});
