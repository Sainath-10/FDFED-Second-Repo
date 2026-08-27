initAdminSidebar('profile');
initFooter('../../');

/* ── Session-driven profile population ────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch (e) { return null; }
  })();

  if (session) {
    // Display name in sidebar card
    const displayEl = document.getElementById('display-name');
    if (displayEl) {
      const name = session.displayName || session.username || 'Admin';
      displayEl.textContent = name;
    }

    // Avatar initials
    const avatarEl = document.getElementById('avatar-display');
    if (avatarEl && avatarEl.tagName !== 'IMG') {
      const name = session.displayName || session.username || 'A';
      avatarEl.textContent = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }

    // Dynamic Last Login
    const lastLoginEl = document.getElementById('admin-last-login');
    if (lastLoginEl) {
      const loginTime = session.lastLoginAt || session.loggedInAt || Date.now();
      lastLoginEl.textContent = formatActivityTime(loginTime);
    }

    // Prefill Account Information fields
    const nameField = document.getElementById('field-name');
    if (nameField) nameField.value = session.displayName || '';

    const emailField = document.querySelector('input[type="email"]');
    if (emailField) emailField.value = session.email || '';

    const usernameField = document.querySelectorAll('.form-input')[1];
    if (usernameField && usernameField.type === 'text') {
      const uname = session.username || '';
      usernameField.value = uname.includes('@') ? uname : (uname ? '@' + uname : '');
    }
  }

  // Render dynamic stats & recent activity
  renderAdminStats();
  renderAdminActivity();
});

function renderAdminStats() {
  try {
    const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
    const disputes = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
    
    const managedCount = comps.length;
    const resolvedDisputesCount = disputes.filter(d => d.status === 'resolved').length;
    const processedCount = comps.filter(c => c.approvalStatus === 'approved' || c.approvalStatus === 'rejected').length;

    const statVals = document.querySelectorAll('.comp-sidebar-block .stat-val-accent');
    if (statVals.length >= 3) {
      statVals[0].textContent = String(managedCount);
      statVals[1].textContent = String(resolvedDisputesCount);
      statVals[2].textContent = String(processedCount);
    }
  } catch (e) {}
}

/* ── Save account info ─────────────────────────────────────── */
function saveAccountInfo() {
  const nameField = document.getElementById('field-name');
  if (nameField) {
    const name = nameField.value.trim();
    if (!name) {
      if (typeof showToast === 'function') showToast('Name cannot be empty.', 'error');
      return;
    }

    // Update sidebar display
    const displayEl = document.getElementById('display-name');
    if (displayEl) displayEl.textContent = name;

    // Update avatar initials if no image
    const avatarEl = document.getElementById('avatar-display');
    if (avatarEl && avatarEl.tagName !== 'IMG') {
      avatarEl.textContent = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }

    // Persist display name to session
    try {
      const raw = localStorage.getItem('nexus.auth.session');
      if (raw) {
        const session = JSON.parse(raw);
        session.displayName = name;
        localStorage.setItem('nexus.auth.session', JSON.stringify(session));
      }
    } catch (e) {}
  }
  if (typeof showToast === 'function') showToast('Account information saved!');
}

/* ── Password eye toggle ───────────────────────────────────── */
function togglePwd(fieldId, btn) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const isVisible = input.type === 'text';
  input.type = isVisible ? 'password' : 'text';
  btn.textContent = isVisible ? '👁️' : '🙈';
}

/* ── Update password ───────────────────────────────────────── */
function updatePassword() {
  const current  = (document.getElementById('pwd-current')  || {}).value || '';
  const newPwd   = (document.getElementById('pwd-new')      || {}).value || '';
  const confirm  = (document.getElementById('pwd-confirm')  || {}).value || '';

  if (!current) {
    if (typeof showToast === 'function') showToast('Please enter your current password.', 'error');
    return;
  }
  if (!newPwd || newPwd.length < 6) {
    if (typeof showToast === 'function') showToast('New password must be at least 6 characters.', 'error');
    return;
  }
  if (newPwd !== confirm) {
    if (typeof showToast === 'function') showToast('New passwords do not match.', 'error');
    return;
  }

  // Verify current password against stored accounts
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch (e) { return null; }
  })();

  const accounts = (() => {
    try {
      const raw = localStorage.getItem('nexus.auth.accounts');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  })();

  if (session && accounts.length) {
    const username = (session.username || '').toLowerCase();
    const acct = accounts.find(a => (a.username || '').toLowerCase() === username || (a.email || '').toLowerCase() === username);
    if (acct) {
      if (acct.password !== current) {
        if (typeof showToast === 'function') showToast('Current password is incorrect.', 'error');
        return;
      }
      // Update password in accounts store
      acct.password = newPwd;
      try {
        localStorage.setItem('nexus.auth.accounts', JSON.stringify(accounts));
      } catch (e) {}
    }
  }

  // Clear fields
  ['pwd-current', 'pwd-new', 'pwd-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.type = 'password'; }
  });
  document.querySelectorAll('.pwd-eye-btn').forEach(btn => { btn.textContent = '👁️'; });

  // Log to admin activity
  pushAdminActivity({ type: 'password', title: 'Password updated successfully.' });

  if (typeof showToast === 'function') showToast('Password updated successfully!');
}

/* ── Avatar preview ────────────────────────────────────────── */
function previewAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const circle = document.getElementById('avatar-display');
    if (circle) {
      circle.innerHTML = `<img src="${ev.target.result}" alt="Avatar">`;
    }
  };
  reader.readAsDataURL(file);
}

/* ── Admin activity log (localStorage-backed) ─────────────── */
const ADMIN_ACTIVITY_KEY = 'nexus.admin.activity';

function loadAdminActivity() {
  try {
    const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function pushAdminActivity(entry) {
  const list = loadAdminActivity();
  list.unshift({
    id: 'act-' + Math.random().toString(36).slice(2, 10),
    type: entry.type || 'info',
    title: entry.title || '',
    time: new Date().toISOString()
  });
  // Keep only last 30 entries
  const trimmed = list.slice(0, 30);
  try {
    localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(trimmed));
  } catch (e) {}
}

function formatActivityTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';
  if (diffDays === 0) return 'Today · ' + timeStr;
  if (diffDays === 1) return 'Yesterday · ' + timeStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + timeStr;
}

function iconForType(type) {
  switch (type) {
    case 'approved':   return { icon: '✅', cls: 'activity-icon-success' };
    case 'rejected':   return { icon: '❌', cls: 'activity-icon-danger' };
    case 'pending':    return { icon: '🕐', cls: 'activity-icon-warn' };
    case 'dispute':    return { icon: '⚖️', cls: 'activity-icon-warn' };
    case 'password':   return { icon: '🔐', cls: 'activity-icon-info' };
    default:           return { icon: '📝', cls: 'activity-icon-info' };
  }
}

function buildActivityFromCompetitions() {
  // Generate activity entries from competition approval history stored in nexus_competitions
  const entries = [];
  try {
    const raw = localStorage.getItem('nexus_competitions');
    if (!raw) return entries;
    const comps = JSON.parse(raw);
    if (!Array.isArray(comps)) return entries;

    comps.forEach(comp => {
      if (!comp) return;
      const status = (comp.approvalStatus || '').toLowerCase();
      if (status === 'approved' || status === 'rejected') {
        const name = comp.name || 'Competition';
        entries.push({
          id: 'comp-act-' + comp.id,
          type: status,
          title: (status === 'approved' ? 'Approved tournament: ' : 'Rejected tournament: ') + name,
          time: comp.approvalUpdatedAt || comp.createdAt || new Date().toISOString()
        });
      } else if (status === 'pending') {
        const name = comp.name || 'Competition';
        const organizer = comp.createdBy || comp.organizerId || 'An organizer';
        entries.push({
          id: 'comp-pend-' + comp.id,
          type: 'pending',
          title: organizer + ' submitted a tournament request: ' + name,
          time: comp.approvalUpdatedAt || comp.createdAt || new Date().toISOString()
        });
      }
    });
  } catch (e) {}
  return entries;
}

function renderAdminActivity() {
  const container = document.getElementById('admin-activity-list');
  if (!container) return;

  // Merge: manual activity log + competition-derived activity
  const manualLog = loadAdminActivity();
  const compLog   = buildActivityFromCompetitions();
  const combined  = [...manualLog, ...compLog];

  if (!combined.length) {
    container.innerHTML = `
      <div class="activity-item">
        <span class="activity-icon">⏳</span>
        <div class="activity-info">
          <div class="activity-title" style="color:var(--text-muted)">No recent activity yet.</div>
        </div>
      </div>`;
    return;
  }

  // Sort by time descending
  combined.sort((a, b) => new Date(b.time) - new Date(a.time));

  // Take the most recent 15
  const visible = combined.slice(0, 15);

  container.innerHTML = visible.map(entry => {
    const { icon, cls } = iconForType(entry.type);
    return `
      <div class="activity-item">
        <span class="activity-icon ${cls}">${icon}</span>
        <div class="activity-info">
          <div class="activity-title">${entry.title}</div>
          <div class="activity-time">${formatActivityTime(entry.time)}</div>
        </div>
      </div>`;
  }).join('');
}

/* ── Logout ────────────────────────────────────────────────── */
const adminProfileLogoutBtn = document.getElementById('admin-profile-logout-btn');
if (adminProfileLogoutBtn) {
  adminProfileLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('nexus.auth.session');
    if (window.NexusAuth && typeof window.NexusAuth.clearSession === 'function') {
      window.NexusAuth.clearSession();
    }
    window.location.replace('../login.html');
  });
}

/* ── Expose to inline handlers ─────────────────────────────── */
window.saveAccountInfo = saveAccountInfo;
window.previewAvatar   = previewAvatar;
window.updatePassword  = updatePassword;
window.togglePwd       = togglePwd;