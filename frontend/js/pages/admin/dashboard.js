/* ============================================================
   NEXUS ESPORTS — Admin Dashboard JS
   Handles Tournament Directory, Approvals (>₹50,000 Prize Pool),
   and Oversight
   ============================================================ */

initAdminSidebar('home');
initFooter('../../');

let activeCompFilter = 'all';
let activeSearch = '';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function formatPrizePool(prize) {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) {
    return 'No Prize Pool';
  }
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

function getCompStatus(comp) {
  if (!comp) return 'upcoming';
  if (comp.ended || comp.status === 'completed') return 'completed';
  if (comp.status === 'ongoing' || comp.status === 'active') return 'active';
  return 'upcoming';
}

function updateStats(comps) {
  const total = comps.length;
  const active = comps.filter(c => getCompStatus(c) === 'active').length;
  const upcoming = comps.filter(c => getCompStatus(c) === 'upcoming').length;
  const completed = comps.filter(c => getCompStatus(c) === 'completed').length;
  const pending = comps.filter(c => (c.approvalStatus || '').toLowerCase() === 'pending').length;

  let totalFees = 0;
  comps.forEach(c => {
    if (typeof c.platformFee === 'number') {
      totalFees += c.platformFee;
    } else {
      const prizeAmt = c.prize || (c.prizePool ? parseInt(String(c.prizePool).replace(/[^0-9]/g, '')) || 0 : 0);
      if (prizeAmt > 0 && window.NexusData && typeof window.NexusData.calculatePlatformFee === 'function') {
        totalFees += window.NexusData.calculatePlatformFee(prizeAmt);
      }
    }
  });

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  set('stat-total', total);
  set('stat-active', active);
  set('stat-upcoming', upcoming);
  set('stat-completed', completed);
  set('stat-pending', pending);
  set('stat-platform-fees', `₹${totalFees.toLocaleString('en-IN')}`);
}

function formatStatusBadge(status, comp) {
  const appStatus = String((comp && comp.approvalStatus) || 'approved').toLowerCase();
  if (appStatus === 'pending') {
    return '<span class="status-pill" style="background:rgba(251,146,60,0.2);color:#fb923c;border:1px solid #fb923c;">⏳ Pending Admin Approval</span>';
  }
  if (appStatus === 'rejected') {
    return '<span class="status-pill" style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid #ef4444;">✖ Rejected</span>';
  }
  const map = {
    active: '<span class="status-pill ongoing">Active &amp; Live</span>',
    upcoming: '<span class="status-pill upcoming">Upcoming</span>',
    completed: '<span class="status-pill completed">Completed</span>'
  };
  return map[status] || '<span class="status-pill ongoing">Active</span>';
}

function renderCards() {
  const wrap = document.getElementById('tournament-cards');
  const empty = document.getElementById('admin-empty');
  if (!wrap || !window.NexusData) return;

  const comps = window.NexusData.loadCompetitions().filter(comp => {
    return normalize(comp.role) === 'organizer' || !!comp.createdBy || !!comp.organizerId;
  });
  updateStats(comps);

  const filtered = comps.filter(comp => {
    const status = getCompStatus(comp);
    const appStatus = String((comp && comp.approvalStatus) || 'approved').toLowerCase();

    if (activeCompFilter === 'pending' && appStatus !== 'pending') return false;
    if (activeCompFilter !== 'all' && activeCompFilter !== 'pending' && status !== activeCompFilter) return false;
    if (!activeSearch) return true;

    const organizersStr = Array.isArray(comp.organizers) ? comp.organizers.join(' ') : '';
    const haystack = [
      comp.name,
      comp.game,
      comp.location,
      comp.description,
      (comp.createdBy || comp.organizerId),
      organizersStr
    ].map(v => normalize(v)).join(' ');
    return haystack.includes(activeSearch);
  });

  if (!filtered.length) {
    wrap.querySelectorAll('.t-card').forEach(card => card.remove());
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  wrap.innerHTML = filtered.map(comp => {
    const status = getCompStatus(comp);
    const appStatus = String((comp && comp.approvalStatus) || 'approved').toLowerCase();
    const orgList = Array.isArray(comp.organizers) && comp.organizers.length > 0
      ? comp.organizers.join(', ')
      : (comp.createdBy || comp.organizerId || 'System');

    const actionButtons = (appStatus === 'pending') ? `
      <button class="btn-table-primary" onclick="adminApproveComp('${comp.id}', 'approved')" style="background:#22c55e;border:none;color:#fff;font-weight:700;">✔ Approve</button>
      <button class="btn-table-secondary" onclick="adminApproveComp('${comp.id}', 'rejected')" style="border-color:#ef4444;color:#ef4444;font-weight:700;">✖ Reject</button>
      <button class="btn-table-secondary" onclick="openCompDetails('${comp.id}')">Details</button>
    ` : `
      <button class="btn-table-primary t-btn-manage" onclick="location.href='competition-detail.html?id=${comp.id}'">Overview</button>
      <button class="btn-table-secondary" onclick="openCompDetails('${comp.id}')">Details</button>
    `;

    return `
      <div class="t-card" data-search="${normalize(comp.name)} ${normalize(comp.game)} ${normalize(comp.location)}">
        <div class="t-card-header">
          <div class="t-card-title-row">
            <h3 class="t-card-name">${comp.name || 'Competition'}</h3>
            ${formatStatusBadge(status, comp)}
          </div>
          <div class="t-card-game">${comp.game || 'Unknown Game'}</div>
        </div>
        <div class="t-card-meta">
          <div class="t-meta-item"><span>👥 Organizers: <strong>${orgList}</strong></span></div>
          <div class="t-meta-item"><span>📅 ${comp.dates || 'TBD'}</span></div>
          <div class="t-meta-item"><span>📍 ${comp.location || 'Online'}</span></div>
          <div class="t-meta-item"><span>🛡️ ${comp.participants || (comp.teams ? comp.teams.length : 0)} teams</span></div>
          <div class="t-meta-item t-meta-prize"><span class="prize-text">${formatPrizePool(comp.prizePool)}</span></div>
        </div>
        <div class="t-card-actions">${actionButtons}</div>
      </div>`;
  }).join('');
}

function adminApproveComp(compId, decision) {
  const sessionRaw = localStorage.getItem('nexus.auth.session');
  let adminUname = 'admin';
  try { const s = JSON.parse(sessionRaw); adminUname = s?.username || 'admin'; } catch(e) {}

  const result = window.NexusData.setCompetitionApproval(compId, decision, adminUname);
  if (result && result.ok) {
    if (typeof showToast === 'function') {
      showToast(decision === 'approved'
        ? `Tournament "${result.competition.name}" has been APPROVED & published!`
        : `Tournament "${result.competition.name}" has been REJECTED.`,
        decision === 'approved' ? 'success' : 'error'
      );
    }
    renderCards();
    closeCompDetails();
  } else {
    if (typeof showToast === 'function') showToast(result?.error || 'Failed to update status.', 'error');
  }
}

function filterCards(q) {
  activeSearch = normalize(q);
  renderCards();
}

function setCompFilter(filter, btn) {
  activeCompFilter = filter;
  document.querySelectorAll('#approval-tabs .approval-tab').forEach(tab => tab.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCards();
}

function openCompDetails(compId) {
  if (!window.NexusData) return;
  const comp = window.NexusData.getCompetitionById(compId);
  if (!comp) return;

  const modal = document.getElementById('comp-detail-modal');
  const title = document.getElementById('admin-modal-title');
  const body = document.getElementById('admin-modal-body');
  if (!modal || !title || !body) return;

  const orgList = Array.isArray(comp.organizers) && comp.organizers.length > 0
    ? comp.organizers.join(', ')
    : (comp.createdBy || comp.organizerId || '—');

  const appStatus = String((comp && comp.approvalStatus) || 'approved').toLowerCase();
  const statusLabel = appStatus === 'pending'
    ? '<span style="color:#fb923c;font-weight:700">⏳ Pending Admin Approval (>₹50k Prize Pool)</span>'
    : (appStatus === 'rejected' ? '<span style="color:#ef4444;font-weight:700">✖ Rejected</span>' : '<span style="color:#c6ff33;font-weight:700">Active &amp; Live</span>');

  const modalActions = (appStatus === 'pending') ? `
    <div style="margin-top:20px;display:flex;gap:12px;border-top:1px solid #1e293b;padding-top:16px;">
      <button onclick="adminApproveComp('${comp.id}', 'approved')" style="flex:1;padding:12px;background:#22c55e;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;">✔ Approve Tournament</button>
      <button onclick="adminApproveComp('${comp.id}', 'rejected')" style="flex:1;padding:12px;background:#ef4444;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;">✖ Reject Tournament</button>
    </div>` : '';

  const prizeAmt = comp.prize || (comp.prizePool ? parseInt(String(comp.prizePool).replace(/[^0-9]/g, '')) || 0 : 0);
  const pFee = typeof comp.platformFee === 'number'
    ? comp.platformFee
    : (window.NexusData ? window.NexusData.calculatePlatformFee(prizeAmt) : (prizeAmt <= 700 ? 50 : Math.round(prizeAmt * 0.07)));

  title.textContent = comp.name || 'Competition Details';
  body.innerHTML = `
    <div class="admin-detail-grid">
      <p><strong>Game:</strong> ${comp.game || '—'}</p>
      <p><strong>Primary Creator:</strong> ${comp.createdBy || comp.organizerId || '—'}</p>
      <p><strong>All Organizers:</strong> ${orgList}</p>
      <p><strong>Type:</strong> ${comp.type || '—'}</p>
      <p><strong>Format:</strong> ${comp.format || '—'}</p>
      <p><strong>Dates:</strong> ${comp.dates || '—'}</p>
      <p><strong>Registration Open:</strong> ${(comp.registrationDates && comp.registrationDates.open) || '—'}</p>
      <p><strong>Registration Close:</strong> ${(comp.registrationDates && comp.registrationDates.close) || '—'}</p>
      <p><strong>Entry Fee Model:</strong> ${comp.entryFee || 'Free'}</p>
      <p><strong>Max Teams:</strong> ${comp.maxTeams || '—'}</p>
      <p><strong>Prize Pool:</strong> ${formatPrizePool(comp.prizePool)}</p>
      <p><strong>Platform Fee (Revenue):</strong> <span style="color:#fb923c;font-weight:700">₹${pFee.toLocaleString('en-IN')}</span></p>
      <p><strong>Location:</strong> ${comp.location || 'Online'}</p>
      <p><strong>Approval Status:</strong> ${statusLabel}</p>
    </div>
    <div class="admin-detail-desc"><strong>Description:</strong><br>${comp.description || 'No description provided.'}</div>
    ${modalActions}
  `;
  modal.style.display = 'flex';
}

function closeCompDetails() {
  const modal = document.getElementById('comp-detail-modal');
  if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const filter = normalize(params.get('filter'));
  if (filter === 'active' || filter === 'upcoming' || filter === 'completed' || filter === 'pending') {
    activeCompFilter = filter;
    document.querySelectorAll('#approval-tabs .approval-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-filter') === filter);
    });
  }
  renderCards();
  if (window.NexusData && typeof window.NexusData.fetchCompetitionsFromAPI === 'function') {
    Promise.race([
      window.NexusData.fetchCompetitionsFromAPI(),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]).then(() => renderCards()).catch(() => {});
  }
  const modal = document.getElementById('comp-detail-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCompDetails();
    });
  }
});

window.filterCards = filterCards;
window.setCompFilter = setCompFilter;
window.setApprovalFilter = setCompFilter;
window.openCompDetails = openCompDetails;
window.closeCompDetails = closeCompDetails;
window.adminApproveComp = adminApproveComp;
