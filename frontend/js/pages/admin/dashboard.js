initAdminSidebar('home');
initFooter('../../');

let activeCompFilter = 'all';
let activeSearch = '';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
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

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  set('stat-total', total);
  set('stat-active', active);
  set('stat-upcoming', upcoming);
  set('stat-completed', completed);
}

function formatStatusBadge(status) {
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
    if (activeCompFilter !== 'all' && status !== activeCompFilter) return false;
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
    const orgList = Array.isArray(comp.organizers) && comp.organizers.length > 0
      ? comp.organizers.join(', ')
      : (comp.createdBy || comp.organizerId || 'System');

    const actionButtons = `
      <button class="btn-table-primary t-btn-manage" onclick="location.href='../competition-detail.html?id=${comp.id}'">Overview</button>
      <button class="btn-table-secondary" onclick="openCompDetails('${comp.id}')">Details</button>
    `;

    return `
      <div class="t-card" data-search="${normalize(comp.name)} ${normalize(comp.game)} ${normalize(comp.location)}">
        <div class="t-card-header">
          <div class="t-card-title-row">
            <h3 class="t-card-name">${comp.name || 'Competition'}</h3>
            ${formatStatusBadge(status)}
          </div>
          <div class="t-card-game">${comp.game || 'Unknown Game'}</div>
        </div>
        <div class="t-card-meta">
          <div class="t-meta-item"><span>👥 Organizers: <strong>${orgList}</strong></span></div>
          <div class="t-meta-item"><span>📅 ${comp.dates || 'TBD'}</span></div>
          <div class="t-meta-item"><span>📍 ${comp.location || 'Online'}</span></div>
          <div class="t-meta-item"><span>🛡️ ${comp.participants || (comp.teams ? comp.teams.length : 0)} teams</span></div>
          <div class="t-meta-item t-meta-prize"><span class="prize-text">${comp.prizePool || '—'} Prize Pool</span></div>
        </div>
        <div class="t-card-actions">${actionButtons}</div>
      </div>`;
  }).join('');
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
      <p><strong>Entry Fee:</strong> ${comp.entryFee || 'Free'}</p>
      <p><strong>Max Teams:</strong> ${comp.maxTeams || '—'}</p>
      <p><strong>Prize Pool:</strong> ${comp.prizePool || '—'}</p>
      <p><strong>Location:</strong> ${comp.location || 'Online'}</p>
      <p><strong>Status:</strong> <span style="color:#c6ff33;font-weight:700">Active &amp; Live</span></p>
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
  if (filter === 'active' || filter === 'upcoming' || filter === 'completed') {
    activeCompFilter = filter;
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
window.setCompFilter = setCompFilter;
window.setApprovalFilter = setCompFilter;
window.openCompDetails = openCompDetails;
window.closeCompDetails = closeCompDetails;
