if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('admins', '../../');
}

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function formatAdminType(role, adminType) {
  const normRole = normalize(role);
  const normType = normalize(adminType);

  if (normRole === 'comp_admin' || normType === 'comp_admin') {
    return { label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
  }
  if (normRole === 'dispute_admin' || normType === 'dispute_admin') {
    return { label: 'Dispute Admin', icon: '🛡️', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)' };
  }
  if (normRole === 'revenue_admin' || normType === 'revenue_admin') {
    return { label: 'Revenue Admin', icon: '💳', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)' };
  }
  if (normRole === 'super_admin' || normRole === 'super-admin' || normType === 'super_admin') {
    return { label: 'Super Admin', icon: '⚡', color: '#c6ff33', bg: 'rgba(198, 255, 51, 0.15)', border: 'rgba(198, 255, 51, 0.3)' };
  }
  return { label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
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
    const typeInfo = formatAdminType(account.role, account.adminType);
    const email = account.email || (username.includes('@') ? username : `${username}@nexus.gg`);
    const isBanned = !!account.banned;

    const rolePill = isBanned
      ? `<span class="sa-role-pill" style="background:rgba(231,0,11,0.15);color:#e7000b;border:1px solid rgba(231,0,11,0.3);">BANNED</span>`
      : `<span class="sa-role-pill" style="background:${typeInfo.bg};color:${typeInfo.color};border:1px solid ${typeInfo.border};font-weight:700;">${typeInfo.icon} ${typeInfo.label}</span>`;
    
    return `
      <tr style="cursor:pointer;" onclick="window.location.href='../admin/admin-activity.html?admin=${encodeURIComponent(username)}'">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${typeInfo.bg};border:1px solid ${typeInfo.border};display:flex;align-items:center;justify-content:center;font-weight:800;color:${typeInfo.color};font-size:13px;">
              ${username.charAt(0).toUpperCase()}
            </div>
            <span style="font-weight:600;color:#f5f5f5;">${username}</span>
          </div>
        </td>
        <td>${rolePill}</td>
        <td class="sa-email">${email}</td>
        <td style="text-align:right;" onclick="event.stopPropagation();">
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <a href="../admin/admin-activity.html?admin=${encodeURIComponent(username)}" 
               style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(198,255,51,0.12);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;transition:all 0.2s ease;">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 5v3.5l2.5 1.5"/>
              </svg>
              Activity
            </a>
          </div>
        </td>
      </tr>`;
  }).join('');
}

let currentRoster = [];

function applySearch() {
  const input = document.getElementById('admins-search');
  const query = normalize(input && input.value);
  if (!query) {
    renderAdmins(currentRoster);
    return;
  }

  const filtered = currentRoster.filter(account => {
    const typeInfo = formatAdminType(account.role, account.adminType);
    const haystack = [
      account.username,
      account.email,
      account.role,
      account.adminType,
      typeInfo.label
    ].map(normalize).join(' ');
    return haystack.includes(query);
  });

  renderAdmins(filtered);
}

async function syncAndRenderAdmins() {
  try {
    const res = await fetch('http://localhost:3001/auth/users');
    if (res.ok) {
      const dbUsers = await res.json();
      if (Array.isArray(dbUsers)) {
        currentRoster = dbUsers.filter(u => {
          if (!u) return false;
          const r = normalize(u.role);
          const t = normalize(u.adminType);
          
          if (r === 'participant' || r === 'regular' || r === 'user') {
            return false;
          }

          return [
            'comp_admin',
            'dispute_admin',
            'revenue_admin',
            'super_admin',
            'super-admin',
            'admin'
          ].includes(r) || [
            'comp_admin',
            'dispute_admin',
            'revenue_admin',
            'super_admin',
            'super-admin',
            'admin'
          ].includes(t);
        }).map(u => ({
          username: u.username || u.email,
          email: u.email || `${u.username}@nexus.gg`,
          role: u.role,
          adminType: u.adminType || u.role,
          banned: !!u.banned
        }));

        renderAdmins(currentRoster);
        return;
      }
    }
  } catch (e) {
    console.warn('Could not fetch DB users for Admins roster:', e);
  }

  // Fallback to local accounts if server offline
  try {
    const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    currentRoster = stored.filter(a => {
      const r = normalize(a.role);
      if (r === 'participant' || r === 'regular') return false;
      return [
        'comp_admin',
        'dispute_admin',
        'revenue_admin',
        'super_admin',
        'super-admin',
        'admin'
      ].includes(r);
    });
    renderAdmins(currentRoster);
  } catch (err) {}
}

document.addEventListener('DOMContentLoaded', () => {
  syncAndRenderAdmins();

  const searchInput = document.getElementById('admins-search');
  if (searchInput) searchInput.addEventListener('input', applySearch);
});
