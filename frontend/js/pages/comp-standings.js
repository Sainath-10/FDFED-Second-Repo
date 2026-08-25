/* ============================================================
   NEXUS ESPORTS — Standings Page (Organizer View)
   ============================================================ */

let comp = null;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStatus(status) {
  const map = {
    ongoing: 'ONGOING',
    upcoming: 'UPCOMING',
    completed: 'COMPLETED',
    live: 'LIVE'
  };
  return map[status] || String(status || '—').toUpperCase();
}

/**
 * Build standings from match results + any manual customPoints overrides.
 * customPoints is stored as { "TeamName": deltaNumber } on the comp object.
 */
function buildStandings(compData) {
  const teamNames = (compData.teams || []).filter(t => t.status === 'approved').map(t => t.name);
  const table = {};

  teamNames.forEach(name => {
    table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
  });

  const matches = (compData.matches || []).slice();

  matches.forEach(match => {
    if (match.status !== 'completed') return;
    if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };

    const t1 = table[match.team1];
    const t2 = table[match.team2];
    t1.mp += 1;
    t2.mp += 1;

    if (match.score1 > match.score2) {
      t1.w += 1; t2.l += 1; t1.points += 3;
      t1.last5.unshift('W'); t2.last5.unshift('L');
    } else if (match.score2 > match.score1) {
      t2.w += 1; t1.l += 1; t2.points += 3;
      t1.last5.unshift('L'); t2.last5.unshift('W');
    } else {
      t1.d += 1; t2.d += 1; t1.points += 1; t2.points += 1;
      t1.last5.unshift('D'); t2.last5.unshift('D');
    }
  });

  const custom = compData.customPoints || {};

  return Object.values(table)
    .map(row => {
      // Apply any manual adjustments the organizer made
      const extra = custom[row.team] || 0;
      row.points = Math.max(0, row.points + extra);
      return Object.assign({}, row, { last5: row.last5.slice(0, 5) });
    })
    .sort((a, b) => (b.points - a.points) || (b.w - a.w))
    .map((row, index) => Object.assign({}, row, { rank: index + 1 }));
}

/**
 * Called by the ▲/▼ buttons. Updates customPoints on the comp object,
 * persists it, and re-renders so all views stay consistent.
 */
function updatePoints(teamName, delta) {
  if (!comp) return;
  if (!comp.customPoints) comp.customPoints = {};
  comp.customPoints[teamName] = (comp.customPoints[teamName] || 0) + delta;

  // Persist the change so that comp-info.html and participant pages read it
  if (window.NexusData && typeof window.NexusData.updateCompetition === 'function') {
    window.NexusData.updateCompetition(comp);
  }

  renderStandings();
}

// Expose globally so inline onclick="" works
window.updatePoints = updatePoints;

function renderSummary() {
  const total     = comp.matches ? comp.matches.length : 0;
  const completed = comp.matches ? comp.matches.filter(m => m.status === 'completed').length : 0;
  const live      = comp.matches ? comp.matches.filter(m => m.status === 'live').length : 0;
  const scheduled = comp.matches ? comp.matches.filter(m => m.status === 'scheduled').length : 0;

  document.getElementById('standings-summary').innerHTML = `
    <div class="summary-icon">🏆</div>
    <div class="summary-info">
      <div class="summary-header">
        <h2 class="summary-title">${comp.name || 'Competition'}</h2>
        <span class="badge-status status-approved">${formatStatus(comp.status)}</span>
      </div>
      <div class="summary-sub">${comp.game || '—'} • ${comp.format || comp.type || '—'} • ${comp.dates || formatDate(comp.startDate)}</div>
      <div class="summary-stats">
        <div><span class="stat-label">TOTAL MATCHES</span><span class="stat-val-sm">${total}</span></div>
        <div><span class="stat-label">COMPLETED</span><span class="stat-val-sm stat-green">${completed}</span></div>
        <div><span class="stat-label">LIVE</span><span class="stat-val-sm">${live}</span></div>
        <div><span class="stat-label">SCHEDULED</span><span class="stat-val-sm">${scheduled}</span></div>
      </div>
    </div>
  `;
}

function renderStandings() {
  const rows = buildStandings(comp);
  const container = document.getElementById('standings-rows');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">No standings yet.</div>';
    return;
  }

  container.innerHTML = rows.map(row => {
    const last = row.last5.length ? row.last5 : ['-', '-', '-', '-', '-'];
    const lastHtml = last.map(result => {
      if (result === 'W') return '<span class="last-chip last-win">✔</span>';
      if (result === 'L') return '<span class="last-chip last-loss">X</span>';
      return '<span class="last-chip last-draw">-</span>';
    }).join('');

    // Escape team name for safe use in onclick attribute
    const safeName = row.team.replace(/'/g, "\\'");

    return `
      <div class="standings-row">
        <span class="col-rank"><span class="rank-badge ${row.rank === 1 ? 'rank-1' : ''}">${String(row.rank).padStart(2, '0')}</span></span>
        <span class="col-team">${row.team}</span>
        <span class="col-mp">${row.mp}</span>
        <span class="col-w stat-green">${row.w}</span>
        <span class="col-l">${row.l}</span>
        <span class="col-d">${row.d}</span>
        <span class="col-pts">
          <span class="pts-adjuster">
            <button class="pts-btn pts-inc" onclick="updatePoints('${safeName}', 1)" title="Add 1 point">&#9650;</button>
            <span class="pts-value stat-green">${row.points}</span>
            <button class="pts-btn pts-dec" onclick="updatePoints('${safeName}', -1)" title="Remove 1 point">&#9660;</button>
          </span>
        </span>
        <span class="col-last5"><span class="last-five">${lastHtml}</span></span>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const id = window.NexusData.getCompIdFromUrl();
  comp = window.NexusData.getCompetitionById(id) || {
    id, name: 'Competition', game: '—', type: 'league',
    status: 'upcoming', teams: [], matches: [], customPoints: {}
  };

  const back = document.getElementById('btn-back-to-comp');
  if (back) back.href = `competition-detail.html?id=${id}`;

  renderSummary();
  renderStandings();
});
