initAdminSidebar('home');
initFooter('../../');

let activeApprovalFilter = 'pending';
let activeSearch = '';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getApprovalStatus(comp) {
  if (window.NexusData && typeof window.NexusData.getApprovalStatus === 'function') {
    return window.NexusData.getApprovalStatus(comp);
  }
  return normalize(comp && comp.approvalStatus) || 'approved';
}

function updateStats(comps) {
  const total = comps.length;
  const pending = comps.filter(c => getApprovalStatus(c) === 'pending').length;
  const approved = comps.filter(c => getApprovalStatus(c) === 'approved').length;
  const rejected = comps.filter(c => getApprovalStatus(c) === 'rejected').length;

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  set('stat-total', total);
  set('stat-pending', pending);
  set('stat-approved', approved);
  set('stat-rejected', rejected);
}

function formatApprovalBadge(status) {
  const map = {
    pending: '<span class="status-pill upcoming">Pending</span>',
    approved: '<span class="status-pill ongoing">Approved</span>',
    rejected: '<span class="status-pill completed">Rejected</span>'
  };
  return map[status] || map.pending;
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
    const approval = getApprovalStatus(comp);
    if (activeApprovalFilter && approval !== activeApprovalFilter) return false;
    if (!activeSearch) return true;

    const haystack = [
      comp.name,
      comp.game,
      comp.location,
      comp.description,
      (comp.createdBy || comp.organizerId)
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
    const approval = getApprovalStatus(comp);
    const actionButtons = approval === 'pending'
      ? `
      <button class="btn-table-primary t-btn-manage" onclick="approveCompetition('${comp.id}')">Approve</button>
      <button class="btn-table-danger" onclick="rejectCompetition('${comp.id}')">Reject</button>
      <button class="btn-table-secondary" onclick="openCompDetails('${comp.id}')">View Details</button>`
      : `<button class="btn-table-secondary t-btn-full" onclick="openCompDetails('${comp.id}')">View Details</button>`;

    return `
      <div class="t-card" data-search="${normalize(comp.name)} ${normalize(comp.game)} ${normalize(comp.location)}">
        <div class="t-card-header">
          <div class="t-card-title-row">
            <h3 class="t-card-name">${comp.name || 'Competition'}</h3>
            ${formatApprovalBadge(approval)}
          </div>
          <div class="t-card-game">${comp.game || 'Unknown Game'}</div>
        </div>
        <div class="t-card-meta">
          <div class="t-meta-item"><span>Organizer: ${comp.createdBy || comp.organizerId || '—'}</span></div>
          <div class="t-meta-item"><span>${comp.dates || 'TBD'}</span></div>
          <div class="t-meta-item"><span>${comp.location || 'Online'}</span></div>
          <div class="t-meta-item"><span>${comp.participants || 0} participants</span></div>
          <div class="t-meta-item t-meta-prize"><span class="prize-text">${comp.prizePool || '—'} Prize Pool</span></div>
        </div>
        ${approval === 'pending' ? '<div class="t-card-pending-bar"><span>Awaiting admin decision</span></div>' : ''}
        <div class="t-card-actions">${actionButtons}</div>
      </div>`;
  }).join('');
}

function filterCards(q) {
  activeSearch = normalize(q);
  renderCards();
}

function setApprovalFilter(filter, btn) {
  activeApprovalFilter = filter;
  document.querySelectorAll('#approval-tabs .approval-tab').forEach(tab => tab.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCards();
}

function approveCompetition(compId) {
  if (!window.NexusData || typeof window.NexusData.setCompetitionApproval !== 'function') return;
  const session = JSON.parse(localStorage.getItem('nexus.auth.session') || 'null');
  const adminUser = session && session.username ? session.username : 'admin';
  const result = window.NexusData.setCompetitionApproval(compId, 'approved', adminUser);
  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Unable to approve competition.', 'error');
    return;
  }
  // Record in admin activity log
  const comp = result.competition || {};
  pushAdminActivityEntry({ type: 'approved', title: 'Approved tournament: ' + (comp.name || compId) });
  if (typeof showToast === 'function') showToast('Competition approved successfully.');
  renderCards();
}

function rejectCompetition(compId) {
  if (!window.NexusData || typeof window.NexusData.setCompetitionApproval !== 'function') return;
  const session = JSON.parse(localStorage.getItem('nexus.auth.session') || 'null');
  const adminUser = session && session.username ? session.username : 'admin';
  const result = window.NexusData.setCompetitionApproval(compId, 'rejected', adminUser);
  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Unable to reject competition.', 'error');
    return;
  }
  // Record in admin activity log
  const comp = result.competition || {};
  pushAdminActivityEntry({ type: 'rejected', title: 'Rejected tournament: ' + (comp.name || compId) });
  if (typeof showToast === 'function') showToast('Competition rejected. Organizer notified.', 'error');
  renderCards();
}

/* ── Shared admin activity helper ── */
function pushAdminActivityEntry(entry) {
  const ADMIN_ACTIVITY_KEY = 'nexus.admin.activity';
  try {
    const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: 'act-' + Math.random().toString(36).slice(2, 10),
      type: entry.type || 'info',
      title: entry.title || '',
      time: new Date().toISOString()
    });
    localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch (e) {}
}

function openCompDetails(compId) {
  if (!window.NexusData) return;
  const comp = window.NexusData.getCompetitionById(compId);
  if (!comp) return;

  const modal = document.getElementById('comp-detail-modal');
  const title = document.getElementById('admin-modal-title');
  const body = document.getElementById('admin-modal-body');
  if (!modal || !title || !body) return;

  title.textContent = comp.name || 'Competition Details';
  body.innerHTML = `
    <div class="admin-detail-grid">
      <p><strong>Game:</strong> ${comp.game || '—'}</p>
      <p><strong>Organizer:</strong> ${comp.createdBy || comp.organizerId || '—'}</p>
      <p><strong>Type:</strong> ${comp.type || '—'}</p>
      <p><strong>Format:</strong> ${comp.format || '—'}</p>
      <p><strong>Dates:</strong> ${comp.dates || '—'}</p>
      <p><strong>Registration Open:</strong> ${(comp.registrationDates && comp.registrationDates.open) || '—'}</p>
      <p><strong>Registration Close:</strong> ${(comp.registrationDates && comp.registrationDates.close) || '—'}</p>
      <p><strong>Entry Fee:</strong> ${comp.entryFee || 'Free'}</p>
      <p><strong>Max Teams:</strong> ${comp.maxTeams || '—'}</p>
      <p><strong>Prize Pool:</strong> ${comp.prizePool || '—'}</p>
      <p><strong>Location:</strong> ${comp.location || 'Online'}</p>
      <p><strong>Approval Status:</strong> ${getApprovalStatus(comp)}</p>
    </div>
    <div class="admin-detail-desc"><strong>Description:</strong><br>${comp.description || 'No description provided.'}</div>
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
  if (filter === 'pending' || filter === 'approved' || filter === 'rejected') {
    activeApprovalFilter = filter;
    document.querySelectorAll('#approval-tabs .approval-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-filter') === filter);
    });
  }
  renderCards();
  const modal = document.getElementById('comp-detail-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCompDetails();
    });
  }
});

window.filterCards = filterCards;
window.setApprovalFilter = setApprovalFilter;
window.approveCompetition = approveCompetition;
window.rejectCompetition = rejectCompetition;
window.openCompDetails = openCompDetails;
window.closeCompDetails = closeCompDetails;
