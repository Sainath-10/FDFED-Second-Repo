/* ============================================================
   NEXUS ESPORTS — Dynamic Admin Standings
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

  loadStandingsData();
});

function loadStandingsData() {
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
    const container = document.getElementById('standings-container');
    if (container) container.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:30px;">Competition not found.</p>`;
    return;
  }

  currentComp = comp;
  currentCompId = comp.id;
  sessionStorage.setItem('last_admin_comp_id', comp.id);

  document.title = `NEXUS ESPORTS — Standings (${comp.name})`;

  // Update Tab links
  const suffix = `?id=${encodeURIComponent(comp.id)}`;

  ['tab-overview', 'tab-teams', 'tab-matches', 'tab-results', 'tab-standings'].forEach(tabId => {
    const a = document.getElementById(tabId);
    if (a) {
      const baseHref = a.getAttribute('href').split('?')[0];
      a.href = baseHref + suffix;
    }
  });

  const subtitle = document.getElementById('standings-subtitle');
  if (subtitle) {
    subtitle.textContent = `${comp.name} · Current Tournament Rankings`;
  }

  renderStandings();
}

function renderStandings() {
  const container = document.getElementById('standings-container');
  if (!container || !currentComp) return;

  const approvedTeams = (currentComp.teams || []).filter(t => !t.status || t.status === 'approved');

  if (approvedTeams.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;color:var(--text-muted,#9aa4b2);padding:40px 20px;background:#0d1117;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0 0 8px;">No approved teams registered for <strong>${currentComp.name}</strong>.</p>
        <span style="font-size:13px;">Rankings and standings will be generated once teams are approved and matches conclude.</span>
      </div>
    `;
    return;
  }

  // Generate rankings table from approved teams
  const rows = approvedTeams.map((t, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'rank-num gold' : (rank === 2 ? 'rank-num silver' : (rank === 3 ? 'rank-num bronze' : 'rank-num'));
    const wins = t.wins !== undefined ? t.wins : (idx === 0 ? 3 : (idx === 1 ? 2 : 1));
    const losses = t.losses !== undefined ? t.losses : (idx === 0 ? 0 : (idx === 1 ? 1 : 2));
    const pts = (wins * 3);

    return `
      <tr>
        <td><span class="${rankClass}">${rank}</span></td>
        <td class="text-left-align team-name-white"><strong>${t.name || `Team ${rank}`}</strong></td>
        <td>${wins}</td>
        <td>${losses}</td>
        <td class="score-pts-accent">${pts}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="standings-grid-layout" style="display:grid;grid-template-columns:1fr;gap:20px;">
      <div class="standings-card-wrap">
        <div class="standings-card-header">${currentComp.name} — Standings</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="text-left-align">Team</th>
              <th>W</th>
              <th>L</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
