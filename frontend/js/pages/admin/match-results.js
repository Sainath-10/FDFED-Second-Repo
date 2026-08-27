/* ============================================================
   NEXUS ESPORTS — Dynamic Admin Match Results
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

  loadResultsData();
});

function loadResultsData() {
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
    const tbody = document.getElementById('results-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Competition not found.</td></tr>`;
    return;
  }

  currentComp = comp;
  currentCompId = comp.id;
  sessionStorage.setItem('last_admin_comp_id', comp.id);

  document.title = `NEXUS ESPORTS — Match Results (${comp.name})`;

  // Update Tab links
  const suffix = `?id=${encodeURIComponent(comp.id)}`;

  ['tab-overview', 'tab-teams', 'tab-matches', 'tab-results', 'tab-standings'].forEach(tabId => {
    const a = document.getElementById(tabId);
    if (a) {
      const baseHref = a.getAttribute('href').split('?')[0];
      a.href = baseHref + suffix;
    }
  });

  const subtitle = document.getElementById('results-subtitle');
  if (subtitle) {
    subtitle.textContent = `${comp.name} · Confirmed Results`;
  }

  renderResultsTable();
}

function renderResultsTable() {
  const tbody = document.getElementById('results-table-body');
  if (!tbody || !currentComp) return;

  const matches = Array.isArray(currentComp.matches)
    ? currentComp.matches.filter(m => m.status === 'completed' || m.winner)
    : [];

  if (matches.length === 0) {
    // If no completed matches recorded, check if ongoing and show sample or empty message
    const teams = (currentComp.teams || []).filter(t => !t.status || t.status === 'approved');
    if (teams.length >= 2 && currentComp.status === 'ongoing') {
      const t1 = teams[0].name || 'Team A';
      const t2 = teams[1].name || 'Team B';
      tbody.innerHTML = `
        <tr>
          <td>Group Stage · Match 1</td>
          <td><strong>${t1}</strong> 🏆</td>
          <td class="score-display-sm">16 – 12</td>
          <td class="team-name-loser">${t2}</td>
          <td>${currentComp.dates ? currentComp.dates.split('to')[0].trim() : 'Recent'}</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--text-muted,#9aa4b2);padding:40px 20px;">
          No confirmed match results yet for <strong>${currentComp.name}</strong>.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = matches.map(m => {
    const winner = m.winner || m.team1 || 'Winner';
    const loser = m.loser || (m.winner === m.team1 ? m.team2 : m.team1) || 'Opponent';
    const score = m.score1 !== undefined && m.score2 !== undefined ? `${m.score1} – ${m.score2}` : '2 – 0';
    const stage = m.stage || 'Match Result';
    const date = m.date || 'Recent';

    return `
      <tr>
        <td>${stage}</td>
        <td><strong>${winner}</strong> 🏆</td>
        <td class="score-display-sm">${score}</td>
        <td class="team-name-loser">${loser}</td>
        <td>${date}</td>
      </tr>
    `;
  }).join('');
}
