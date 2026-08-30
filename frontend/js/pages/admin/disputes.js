initAdminSidebar('disputes');
initFooter('../../');

let currentFilter = 'all';
let disputesList = [];

// Sample seed disputes if DB is initially empty
const defaultSeedDisputes = [
  {
    id: 'disp-org-1',
    targetType: 'organizer',
    title: 'Dispute against Organizer — Tournament Schedule Delay',
    description: 'Tournament organizer delayed semi-finals by 4 hours without notice and altered bracket rules unfairly.',
    reportedBy: 'Team_Vanguard',
    targetId: 'organizer_alpha',
    status: 'escalated',
    competitionName: 'World Championship 2026',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'disp-usr-1',
    targetType: 'user',
    title: 'Dispute against Player — Exploiting Dust2 Map Glitch',
    description: 'Opponent player used illegal smoke bug during Round 18 giving unfair sight advantages. Demo evidence attached.',
    reportedBy: 'Inferno_Squad',
    targetId: 'Storm_Riders',
    status: 'open',
    competitionName: 'Pro League Season 5',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'disp-org-2',
    targetType: 'organizer',
    title: 'Dispute against Organizer — Prize Pool Distribution Delay',
    description: 'Organizer has not initiated winner prize payout 14 days after tournament completion.',
    reportedBy: 'Apex_Predators',
    targetId: 'esports_org_india',
    status: 'open',
    competitionName: 'Regional Cup 2026',
    createdAt: new Date().toISOString(),
  },
];

async function loadDisputes() {
  if (window.NexusAPI && window.NexusAPI.Disputes) {
    const res = await window.NexusAPI.Disputes.getAll();
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      disputesList = res.data;
      updateStats();
      renderDisputes();
      return;
    }
  }

  // Fallback to local storage or seed
  try {
    const stored = JSON.parse(localStorage.getItem('nexus_admin_disputes') || 'null');
    disputesList = (Array.isArray(stored) && stored.length) ? stored : defaultSeedDisputes;
  } catch (e) {
    disputesList = defaultSeedDisputes;
  }
  updateStats();
  renderDisputes();
}

function updateStats() {
  const orgCount = disputesList.filter(d => (d.targetType || '').toLowerCase() === 'organizer').length;
  const userCount = disputesList.filter(d => (d.targetType || 'user').toLowerCase() === 'user').length;
  const escalatedCount = disputesList.filter(d => (d.status || '').toLowerCase() === 'escalated').length;
  const resolvedCount = disputesList.filter(d => (d.status || '').toLowerCase() === 'resolved').length;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };

  setVal('stat-organizer', orgCount);
  setVal('stat-user', userCount);
  setVal('stat-escalated', escalatedCount);
  setVal('stat-resolved', resolvedCount);
}

function filterDisputes(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDisputes();
}

function renderDisputes() {
  const container = document.getElementById('disputes-list');
  if (!container) return;

  const filtered = disputesList.filter(d => {
    const status = (d.status || 'open').toLowerCase();
    const type = (d.targetType || 'user').toLowerCase();

    if (currentFilter === 'all') return true;
    if (currentFilter === 'organizer') return type === 'organizer';
    if (currentFilter === 'user') return type === 'user';
    if (currentFilter === 'escalated') return status === 'escalated';
    if (currentFilter === 'resolved') return status === 'resolved';
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 20px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;">
        <p style="color:var(--text-muted);font-size:15px;margin:0;">No disputes found in this category.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(d => {
    const isOrg = (d.targetType || '').toLowerCase() === 'organizer';
    const status = (d.status || 'open').toLowerCase();
    const isResolved = status === 'resolved';
    const isEscalated = status === 'escalated';

    const typeBadge = isOrg
      ? `<span style="background:rgba(231,0,11,0.15);color:#ff4d4f;border:1px solid rgba(231,0,11,0.3);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">⚡ DISPUTE AGAINST ORGANIZER</span>`
      : `<span style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">👥 DISPUTE AGAINST USER/TEAM</span>`;

    let statusBadge = `<span class="status-pill pending">Open</span>`;
    if (isEscalated) statusBadge = `<span class="status-pill warning" style="background:rgba(234,179,8,0.2);color:#eab308;border:1px solid rgba(234,179,8,0.4);">🔺 Escalated</span>`;
    if (isResolved) statusBadge = `<span class="status-pill completed">✅ Resolved</span>`;

    let actions = '';
    if (!isResolved) {
      actions = `
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
          <button class="btn-table-primary" style="padding:7px 16px;font-size:13px;" onclick="resolveDisputeAction('${d.id}', 'resolved', 'Approved after review')">Approve &amp; Resolve</button>
          <button class="btn-table-danger" style="padding:7px 16px;font-size:13px;" onclick="resolveDisputeAction('${d.id}', 'resolved', 'Dismissed - insufficient evidence')">Dismiss Dispute</button>
          ${!isEscalated ? `<button class="btn-table-secondary" style="padding:7px 16px;font-size:13px;color:#eab308;border-color:rgba(234,179,8,0.4);" onclick="resolveDisputeAction('${d.id}', 'escalated', 'Escalated to senior administration')">🔺 Escalate</button>` : ''}
        </div>`;
    } else {
      actions = `
        <div style="margin-top:12px;padding:10px 14px;background:rgba(34,197,94,0.08);border-left:3px solid #22c55e;border-radius:4px;font-size:13px;color:var(--text-muted);">
          <strong>Resolution:</strong> ${d.resolutionNotes || 'Dispute was reviewed and finalized by administration.'}
        </div>`;
    }

    return `
      <div class="dispute-card" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-weight:700;color:var(--text-main);font-size:14px;">#${d.id.slice(0, 8)}</span>
            ${typeBadge}
          </div>
          <div>${statusBadge}</div>
        </div>

        <h3 style="margin:0 0 8px 0;font-size:16px;color:var(--text-main);font-weight:700;">${d.title || (isOrg ? 'Dispute against Organizer' : 'Match Dispute')}</h3>
        <p style="margin:0 0 14px 0;color:var(--text-muted);font-size:14px;line-height:1.5;">${d.description}</p>

        <div style="display:flex;gap:18px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border-color);padding-top:12px;flex-wrap:wrap;">
          <span><strong>Filed by:</strong> ${d.reportedBy || 'Participant'}</span>
          <span><strong>Target:</strong> ${d.targetId || (isOrg ? 'Organizer' : 'Opponent')}</span>
          <span><strong>Filed:</strong> ${new Date(d.createdAt).toLocaleDateString()}</span>
        </div>

        ${actions}
      </div>`;
  }).join('');
}

async function resolveDisputeAction(id, newStatus, defaultNote) {
  const notes = prompt('Enter resolution notes / decision verdict:', defaultNote);
  if (notes === null) return;

  if (window.NexusAPI && window.NexusAPI.Disputes) {
    const res = await window.NexusAPI.Disputes.update(id, newStatus, notes);
    if (res.ok) {
      if (typeof showToast === 'function') showToast(`Dispute updated to: ${newStatus}`);
      await loadDisputes();
      return;
    }
  }

  // Local fallback
  const d = disputesList.find(item => item.id === id);
  if (d) {
    d.status = newStatus;
    d.resolutionNotes = notes;
    localStorage.setItem('nexus_admin_disputes', JSON.stringify(disputesList));
    if (typeof showToast === 'function') showToast(`Dispute updated to: ${newStatus}`);
    updateStats();
    renderDisputes();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDisputes();
});

window.filterDisputes = filterDisputes;
window.resolveDisputeAction = resolveDisputeAction;