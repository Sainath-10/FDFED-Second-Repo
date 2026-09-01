document.addEventListener('DOMContentLoaded', async () => {
  const sessionRaw = localStorage.getItem('nexus.auth.session');
  let loggedInUser = 'admin@nexus.gg';
  let loggedInRole = 'admin';

  try {
    const s = JSON.parse(sessionRaw || '{}');
    loggedInUser = s.username || s.email || 'admin@nexus.gg';
    loggedInRole = String(s.role || s.adminType || 'admin').toLowerCase();
  } catch (e) {}

  // Parse URL query param `?admin=...`
  const params = new URLSearchParams(window.location.search);
  const targetAdmin = (params.get('admin') || loggedInUser).trim();

  // Sidebar initialization based on logged-in role
  if (loggedInRole === 'super-admin' || loggedInRole === 'super_admin') {
    if (typeof initSuperAdminSidebar === 'function') {
      initSuperAdminSidebar('admins', '../../');
    }
  } else {
    if (typeof initAdminSidebar === 'function') {
      initAdminSidebar('activity', '../../');
    }
  }

  await renderAdminProfile(targetAdmin);
  await renderActivityLogs(targetAdmin);
});

async function renderAdminProfile(username) {
  const titleEl = document.getElementById('admin-username-title');
  const emailEl = document.getElementById('admin-email-text');
  const roleEl = document.getElementById('admin-role-badge');
  const avatarEl = document.getElementById('admin-avatar');

  if (titleEl) titleEl.textContent = username;
  if (emailEl) emailEl.textContent = username.includes('@') ? username : `${username}@nexus.gg`;
  if (avatarEl && username) avatarEl.textContent = username.charAt(0).toUpperCase();

  // Detect role badge for target admin
  let detectedType = 'Administrator';
  let isSuper = username.toLowerCase().includes('super');

  try {
    const res = await fetch('http://localhost:3001/auth/users');
    if (res.ok) {
      const users = await res.json();
      const u = users.find(x => String(x.username || x.email).toLowerCase() === username.toLowerCase());
      if (u) {
        const t = String(u.adminType || u.role || '').toLowerCase();
        if (t.includes('dispute')) detectedType = 'Dispute Admin';
        else if (t.includes('revenue')) detectedType = 'Revenue Admin';
        else if (t.includes('comp') || t === 'admin') detectedType = 'Comp Admin';
        else if (t.includes('super')) { detectedType = 'Super Admin'; isSuper = true; }
      }
    }
  } catch (e) {}

  if (roleEl) {
    roleEl.textContent = detectedType;
    if (isSuper) {
      roleEl.style.background = 'rgba(231,0,11,0.15)';
      roleEl.style.color = '#e7000b';
      roleEl.style.border = '1px solid rgba(231,0,11,0.3)';
    } else {
      roleEl.style.background = 'rgba(198,255,51,0.15)';
      roleEl.style.color = '#c6ff33';
      roleEl.style.border = '1px solid rgba(198,255,51,0.3)';
    }
  }
}

async function renderActivityLogs(username) {
  const listEl = document.getElementById('activity-timeline-list');
  const emptyEl = document.getElementById('activity-empty-state');
  const countText = document.getElementById('log-count-text');

  const configCountEl = document.getElementById('stat-config-count');
  const disputesCountEl = document.getElementById('stat-disputes-count');
  const approvalsCountEl = document.getElementById('stat-approvals-count');

  let logs = [];

  // 1. Fetch from local store
  if (window.NexusData && typeof window.NexusData.getAdminActivityLogs === 'function') {
    logs = window.NexusData.getAdminActivityLogs(username) || [];
  } else if (typeof getAdminActivityLogs === 'function') {
    logs = getAdminActivityLogs(username) || [];
  }

  // 2. Fetch from PostgreSQL DB API if connected
  try {
    if (window.NexusAPI && window.NexusAPI.Admin && typeof window.NexusAPI.Admin.getActivity === 'function') {
      const res = await window.NexusAPI.Admin.getActivity(username);
      if (res && res.ok && Array.isArray(res.data)) {
        const dbLogs = res.data;
        const mergedMap = new Map();
        [...logs, ...dbLogs].forEach(item => {
          if (item && item.id) mergedMap.set(item.id, item);
        });
        logs = Array.from(mergedMap.values());
      }
    }
  } catch (e) {}

  // Strictly filter logs for the target admin only
  const targetNorm = String(username || '').trim().toLowerCase();
  const adminLogs = logs.filter(l => {
    if (!l) return false;
    const author = String(l.adminUsername || l.username || '').trim().toLowerCase();
    return author === targetNorm || (!author && targetNorm === 'admin');
  });

  // Calculate statistics for this admin
  const configCount = adminLogs.filter(l => l.actionType === 'REVENUE_CONFIG_CHANGE').length;
  const disputesCount = adminLogs.filter(l => l.actionType === 'DISPUTE_RESOLVED').length;
  const approvalsCount = adminLogs.filter(l => l.actionType === 'COMPETITION_APPROVAL' || l.actionType === 'COMPETITION_APPROVED').length;

  if (configCountEl) configCountEl.textContent = configCount;
  if (disputesCountEl) disputesCountEl.textContent = disputesCount;
  if (approvalsCountEl) approvalsCountEl.textContent = approvalsCount;

  if (countText) countText.textContent = `Showing ${adminLogs.length} activity log${adminLogs.length === 1 ? '' : 's'} for ${username}`;

  if (!adminLogs.length) {
    if (listEl) listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  // Sort descending by timestamp
  adminLogs.sort((a, b) => new Date(b.timestamp || Date.now()) - new Date(a.timestamp || Date.now()));

  if (emptyEl) emptyEl.style.display = 'none';
  if (listEl) {
    listEl.style.display = 'flex';
    listEl.innerHTML = adminLogs.map(item => renderActivityItem(item)).join('');
  }
}

function renderActivityItem(item) {
  let badgeLabel = 'ADMIN ACTION';
  let badgeBg = 'rgba(255,255,255,0.1)';
  let badgeColor = '#ffffff';
  let icon = '⚡';

  if (item.actionType === 'REVENUE_CONFIG_CHANGE') {
    badgeLabel = 'REVENUE CONFIGURATION UPDATE';
    badgeBg = 'rgba(251,146,60,0.15)';
    badgeColor = '#fb923c';
    icon = '⚙️';
  } else if (item.actionType === 'DISPUTE_RESOLVED') {
    badgeLabel = 'DISPUTE RESOLUTION';
    badgeBg = 'rgba(96,165,250,0.15)';
    badgeColor = '#60a5fa';
    icon = '⚖️';
  } else if (item.actionType === 'COMPETITION_APPROVAL' || item.actionType === 'COMPETITION_APPROVED') {
    badgeLabel = 'TOURNAMENT APPROVAL';
    badgeBg = 'rgba(198,255,51,0.15)';
    badgeColor = '#c6ff33';
    icon = '🏆';
  }

  const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently';

  return `
    <div style="background:#141414;border:1px solid #262626;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px;position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">${icon}</span>
          <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:800;background:${badgeBg};color:${badgeColor};border:1px solid ${badgeColor}33;letter-spacing:0.5px;">
            ${badgeLabel}
          </span>
        </div>
        <span style="color:var(--text-muted);font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;">
          🕒 ${dateStr}
        </span>
      </div>

      <div style="color:#ffffff;font-size:14px;font-weight:600;line-height:1.5;">
        ${escapeHtml(item.details)}
      </div>

      ${item.metadata && Object.keys(item.metadata).length ? `
        <div style="background:#0a0a0a;border:1px solid #262626;border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;">
          ${item.metadata.prevPercentage !== undefined ? `<div>Prize Fee: <strong style="color:#ffffff;">${item.metadata.prevPercentage}% → ${item.metadata.newPercentage}%</strong></div>` : ''}
          ${item.metadata.prevMinCost !== undefined ? `<div>Min Cost: <strong style="color:#ffffff;">₹${item.metadata.prevMinCost} → ₹${item.metadata.newMinCost}</strong></div>` : ''}
          ${item.metadata.target ? `<div>Target: <strong style="color:#ffffff;">${escapeHtml(item.metadata.target)}</strong></div>` : ''}
          ${item.metadata.disputeId ? `<div>Dispute ID: <strong style="color:#ffffff;">#${escapeHtml(item.metadata.disputeId.slice(-8))}</strong></div>` : ''}
        </div>
      ` : ''}
    </div>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
