/* ============================================================
   NEXUS ESPORTS — Manage Teams JS
   ============================================================ */

let comp = null;
const PAGE_SIZE = 10;
let currentPage = 1;
let filter = 'all';
let searchQ = '';

document.addEventListener('DOMContentLoaded', () => {
  const id = window.NexusData.getCompIdFromUrl();
  comp = window.NexusData.getCompetitionById(id);

  if (!comp) {
    comp = { id, name: 'New Competition', game: '—', type: 'league', status: 'upcoming',
      teams: [], maxTeams: 16, format: '—', season: '—' };
  }

  document.getElementById('btn-back-to-comp').href = `competition-detail.html?id=${id}`;
  renderBanner();
  renderStats();
  renderTeams();
  setupControls();

  // Lock actions if competition has ended
  if (window.NexusData.enforceNotEnded) {
    window.NexusData.enforceNotEnded(comp,
      '#btn-approve-selected,#btn-reject-selected,.btn-approve,.btn-reject,.btn-xs'
    );
  }
});

function renderBanner() {
  document.getElementById('comp-banner').innerHTML = `
    <div class="banner-img-placeholder">🎮</div>
    <div class="banner-info">
      <span class="banner-status-tag">${comp.status.toUpperCase()}</span>
      <span class="banner-created">• Created ${comp.createdDaysAgo || 0} days ago</span>
      <h2 class="banner-title">${comp.name}</h2>
      <div class="banner-meta">
        <span>🎮 ${comp.game}</span>
        <span>👥 ${comp.teams.filter(t=>t.status==='approved').length} / ${comp.maxTeams} Teams Registered</span>
      </div>
    </div>
    <a href="competition-detail.html?id=${comp.id}" class="btn-back">Edit Settings</a>
  `;
}

function renderStats() {
  const total = comp.teams.length;
  const approved = comp.teams.filter(t=>t.status==='approved').length;
  const pending  = comp.teams.filter(t=>t.status==='pending').length;
  const rejected = comp.teams.filter(t=>t.status==='rejected').length;

  document.getElementById('teams-stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Teams Registered</div><div class="stat-big">${total} <span class="stat-delta">+5%</span></div></div>
    <div class="stat-card"><div class="stat-label">Approved Teams</div><div class="stat-big stat-green">${approved}</div></div>
    <div class="stat-card"><div class="stat-label">Pending Approval</div><div class="stat-big stat-yellow">${pending}</div></div>
    <div class="stat-card"><div class="stat-label">Rejected Teams</div><div class="stat-big stat-red">${rejected}</div></div>
  `;
}

function getFiltered() {
  return comp.teams.filter(t => {
    const matchFilter = filter === 'all' || t.status === filter;
    const matchSearch = !searchQ || t.name.toLowerCase().includes(searchQ) || (t.captain||'').toLowerCase().includes(searchQ);
    return matchFilter && matchSearch;
  });
}

function renderTeams() {
  const filtered = getFiltered();
  const total = filtered.length;
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    document.getElementById('teams-rows').innerHTML = `<div class="empty-state">No teams found.</div>`;
  } else {
    document.getElementById('teams-rows').innerHTML = slice.map(t => {
      const stCls = { approved: 'status-approved', pending: 'status-pending', rejected: 'status-rejected' }[t.status];
      const stLabel = { approved: 'APPROVED', pending: 'PENDING', rejected: 'REJECTED' }[t.status];
      const actionHtml = t.status === 'pending'
        ? `<button class="btn-xs btn-approve" onclick="doApprove('${t.id}')">Approve</button>
           <button class="btn-xs btn-reject" onclick="doReject('${t.id}')">Reject</button>`
        : '';
      return `
        <div class="teams-table-row" data-id="${t.id}">
          <label class="check-wrap"><input type="checkbox" class="row-check" data-id="${t.id}"><span class="checkmark"></span></label>
          <div class="col-team" style="cursor:pointer" onclick="location.href='team/team-roster.html?compId=${comp.id}&teamId=${t.id}'">
            <div class="team-avatar-sm">${t.avatar||t.name[0]}</div>
            <span>${t.name}</span>
          </div>
          <span class="col-captain">${t.captain||'—'}</span>
          <span class="col-players">${t.players||'—'}</span>
          <span class="col-regdate">${t.regDate||'—'}</span>
          <span class="col-status"><span class="badge-status ${stCls}">${stLabel}</span></span>
          <span class="col-actions">${actionHtml}</span>
        </div>`;
    }).join('');
  }

  // Pagination
  const pages = Math.ceil(total / PAGE_SIZE);
  let pgHtml = `<span class="pg-info">Showing ${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE,total)} of ${total} teams</span><div class="pg-btns">`;
  for (let p = 1; p <= pages; p++) pgHtml += `<button class="pg-btn ${p===currentPage?'active':''}" onclick="setPage(${p})">${p}</button>`;
  pgHtml += `</div>`;
  document.getElementById('teams-pagination').innerHTML = pgHtml;
}

window.setPage = p => { currentPage = p; renderTeams(); };

function setupControls() {
  document.getElementById('teams-search').addEventListener('input', e => {
    searchQ = e.target.value.toLowerCase().trim();
    currentPage = 1; renderTeams();
  });
  document.getElementById('teams-status-filter').addEventListener('change', e => {
    filter = e.target.value; currentPage = 1; renderTeams();
  });

  document.getElementById('check-all').addEventListener('change', e => {
    document.querySelectorAll('.row-check').forEach(c => c.checked = e.target.checked);
  });

  document.getElementById('btn-approve-selected').addEventListener('click', () => {
    getSelected().forEach(id => decideTeam(id, 'approved'));
    renderStats();
    renderTeams();
  });
  document.getElementById('btn-reject-selected').addEventListener('click', () => {
    getSelected().forEach(id => decideTeam(id, 'rejected'));
    renderStats();
    renderTeams();
  });
}

function getSelected() {
  return [...document.querySelectorAll('.row-check:checked')].map(c => c.dataset.id);
}
function changeStatus(id, status) {
  const t = comp.teams.find(t => t.id === id);
  if (t) t.status = status;
}
function save() { window.NexusData.updateCompetition(comp); }

function decideTeam(teamId, decision) {
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch (_) { return null; }
  })();
  const by = session && session.username ? session.username : 'organizer';

  if (window.NexusData && typeof window.NexusData.setTeamRegistrationStatus === 'function' && comp && comp.id) {
    const result = window.NexusData.setTeamRegistrationStatus(comp.id, teamId, decision, by);
    if (!result.ok) {
      if (typeof showToast === 'function') showToast(result.error || 'Unable to update team status.', 'error');
      return;
    }

    // Refresh local comp snapshot
    comp = window.NexusData.getCompetitionById(comp.id) || comp;
    if (typeof showToast === 'function') {
      showToast('Team ' + (decision === 'approved' ? 'approved' : 'rejected') + '.');
    }
    return;
  }

  // Fallback
  changeStatus(teamId, decision);
  save();
}

window.doApprove = id => { decideTeam(id,'approved'); renderStats(); renderTeams(); };
window.doReject  = id => { decideTeam(id,'rejected'); renderStats(); renderTeams(); };
