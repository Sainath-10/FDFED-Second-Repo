/* ============================================================
   NEXUS ESPORTS — Dynamic Admin Manage Teams
   ============================================================ */

let currentComp = null;
let currentCompId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initAdminSidebar === 'function') {
    initAdminSidebar('competitions');
  }
  if (typeof initFooter === 'function') {
    initFooter('../../');
  }

  loadTeamsData();
});

function loadTeamsData() {
  const params = new URLSearchParams(window.location.search);
  let compId = params.get('id');

  const allComps = window.NexusData ? window.NexusData.loadCompetitions() : [];

  if (!compId) {
    compId = sessionStorage.getItem('last_admin_comp_id');
  }

  let comp = null;
  if (compId && allComps.length > 0) {
    comp = allComps.find(c => String(c.id) === String(compId));
  }

  if (!comp && allComps.length > 0) {
    comp = allComps[0];
    compId = comp.id;
  }

  if (!comp) {
    const tbody = document.getElementById('teams-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">Competition not found.</td></tr>`;
    return;
  }

  currentComp = comp;
  currentCompId = comp.id;
  sessionStorage.setItem('last_admin_comp_id', comp.id);

  document.title = `NEXUS ESPORTS — Manage Teams (${comp.name})`;

  // Update Tab links
  const suffix = `?id=${encodeURIComponent(comp.id)}`;

  ['tab-overview', 'tab-teams', 'tab-matches', 'tab-results', 'tab-standings'].forEach(tabId => {
    const a = document.getElementById(tabId);
    if (a) {
      const baseHref = a.getAttribute('href').split('?')[0];
      a.href = baseHref + suffix;
    }
  });

  // Render Subtitle
  const teams = Array.isArray(comp.teams) ? comp.teams : [];
  const subtitle = document.getElementById('teams-subtitle');
  if (subtitle) {
    subtitle.textContent = `${comp.name} · ${teams.length} Registered`;
  }

  renderTeamsTable(teams);
}

function renderTeamsTable(teams) {
  const tbody = document.getElementById('teams-table-body');
  if (!tbody) return;

  if (!teams || teams.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--text-muted,#9aa4b2);padding:40px 20px;">
          No teams registered yet for <strong>${currentComp ? currentComp.name : 'this competition'}</strong>.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = teams.map((team, idx) => {
    const teamName = team.name || `Team ${idx + 1}`;
    const players = team.players ? `${team.players}/${currentComp?.maxPlayersPerTeam || 5}` : (team.members ? `${team.members.length}/${currentComp?.maxPlayersPerTeam || 5}` : '5/5');
    const region = team.region || team.location || 'Global';
    const status = team.status || 'approved';
    const registeredDate = team.createdAt ? new Date(team.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Jul 10';

    const statusPill = status === 'approved'
      ? `<span class="status-pill approved">Approved</span>`
      : status === 'pending'
      ? `<span class="status-pill pending">Pending</span>`
      : `<span class="status-pill rejected">Rejected</span>`;

    const actionHtml = status === 'approved'
      ? `<button class="btn-table-danger" onclick="revokeTeam('${team.id || idx}')">Revoke</button>`
      : status === 'pending'
      ? `<button class="btn-table-primary" style="padding:4px 10px;font-size:12px;" onclick="approveTeam('${team.id || idx}')">Approve</button>`
      : `—`;

    return `
      <tr data-team-id="${team.id || idx}">
        <td><strong>${teamName}</strong></td>
        <td>${players}</td>
        <td>${region}</td>
        <td>${statusPill}</td>
        <td>${registeredDate}</td>
        <td class="table-actions">${actionHtml}</td>
      </tr>
    `;
  }).join('');
}

function filterTable(q) {
  const query = String(q || '').toLowerCase();
  document.querySelectorAll('#teams-table-body tr').forEach(r => {
    r.style.display = r.innerText.toLowerCase().includes(query) ? '' : 'none';
  });
}

function revokeTeam(teamId) {
  if (!currentComp) return;
  if (!confirm('Revoke this team\'s approval?')) return;

  const team = (currentComp.teams || []).find(t => String(t.id) === String(teamId));
  if (team) {
    team.status = 'rejected';
    if (window.NexusData && typeof window.NexusData.updateCompetition === 'function') {
      window.NexusData.updateCompetition(currentComp);
    }
  }
  loadTeamsData();
  if (typeof showToast === 'function') showToast('Team approval revoked.', 'error');
}

function approveTeam(teamId) {
  if (!currentComp) return;
  const team = (currentComp.teams || []).find(t => String(t.id) === String(teamId));
  if (team) {
    team.status = 'approved';
    if (window.NexusData && typeof window.NexusData.updateCompetition === 'function') {
      window.NexusData.updateCompetition(currentComp);
    }
  }
  loadTeamsData();
  if (typeof showToast === 'function') showToast('Team approved.', 'success');
}

window.filterTable = filterTable;
window.revokeTeam = revokeTeam;
window.approveTeam = approveTeam;
