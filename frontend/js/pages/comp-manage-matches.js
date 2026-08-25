/* ============================================================
   NEXUS ESPORTS — Manage Matches JS
   ============================================================ */

let comp = null;
let matchFilter = 'all';
let matchSearch = '';
let matchPage = 1;
const PAGE_SIZE = 5;

// Round options per competition type
const ROUND_OPTIONS = {
  league:     ['Group Stage', 'Eliminations', 'Quarterfinals', 'Semifinals', 'Finals'],
  tournament: ['Eliminations', 'Quarterfinals', 'Semifinals', 'Finals']
};

/** Detect whether this comp is a league or tournament */
function getCompType(c) {
  const raw = String(c.type || c.format || '').toLowerCase();
  if (raw.includes('league') || raw.includes('round-robin') || raw.includes('round robin')) return 'league';
  return 'tournament';
}

/** Populate the Round dropdown to match the competition type */
function populateRoundDropdown() {
  const sel = document.getElementById('sf-round');
  if (!sel || !comp) return;
  const type  = getCompType(comp);
  const opts  = ROUND_OPTIONS[type] || ROUND_OPTIONS.tournament;
  const saved = sel.value;
  sel.innerHTML = opts.map(o => `<option value="${o}">${o}</option>`).join('');
  if (saved && opts.includes(saved)) sel.value = saved;
}

document.addEventListener('DOMContentLoaded', () => {
  const id = window.NexusData.getCompIdFromUrl();
  comp = window.NexusData.getCompetitionById(id) || { id, name: 'New Competition', game: '—', type: 'league', status: 'upcoming', teams: [], matches: [], maxTeams: 16, format: '—', season: '—', totalMatches: 0, matchesCompleted: 0 };

  document.getElementById('btn-back-to-comp').href = `competition-detail.html?id=${id}`;
  renderBanner();
  populateTeamDropdowns();
  populateRoundDropdown();
  renderMatches();
  setupControls();

  // Lock actions if competition has ended
  if (window.NexusData && window.NexusData.enforceNotEnded) {
    window.NexusData.enforceNotEnded(comp,
      '#btn-schedule-match,#btn-add-match,button[type="submit"],.btn-schedule,.btn-result,.btn-enter-result'
    );
  }
});

function renderBanner() {
  document.getElementById('comp-banner').innerHTML = `
    <div class="banner-img-placeholder banner-img-lg">🎮</div>
    <div class="banner-info">
      <span class="banner-status-tag">${comp.status === 'ongoing' ? 'ACTIVE COMPETITION' : comp.status.toUpperCase()}</span>
      <h2 class="banner-title banner-title-lg">${comp.name}</h2>
      <div class="banner-meta">
        <span class="banner-tag">🎮 ${comp.game}</span>
        <span class="banner-tag">🔄 ${comp.format}</span>
      </div>
    </div>
    <div class="banner-stats">
      <div><span class="banner-stat-label">TEAMS</span><span class="banner-stat-val">${comp.teams.filter(t=>t.status==='approved').length}</span></div>
      <div><span class="banner-stat-label">MATCHES</span><span class="banner-stat-val">${comp.totalMatches}</span></div>
    </div>
  `;
}

function buildTeamOptions(excludeName) {
  const key = String(excludeName || '').toLowerCase();
  return comp.teams
    .filter(t => t.status === 'approved')
    .filter(t => !key || String(t.name || '').toLowerCase() !== key)
    .map(t => `<option value="${t.name}">${t.name}</option>`)
    .join('');
}

function populateTeamDropdowns() {
  const team1 = document.getElementById('sf-team1');
  const team2 = document.getElementById('sf-team2');
  if (!team1 || !team2) return;

  const team1Value = team1.value;
  const team2Value = team2.value;

  team1.innerHTML = `<option value="">Select Team</option>${buildTeamOptions(team2Value)}`;
  team2.innerHTML = `<option value="">Select Team</option>${buildTeamOptions(team1Value)}`;

  if (team1Value) team1.value = team1Value;
  if (team2Value) team2.value = team2Value;
}

function getFiltered() {
  return comp.matches.filter(m => {
    const ms = matchFilter === 'all' || m.status === matchFilter;
    const mq = !matchSearch || m.team1.toLowerCase().includes(matchSearch) || m.team2.toLowerCase().includes(matchSearch) || m.id.toLowerCase().includes(matchSearch);
    return ms && mq;
  });
}

function renderMatches() {
  const filtered = getFiltered();
  const total = filtered.length;
  const start = (matchPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    document.getElementById('matches-rows').innerHTML = `<div class="empty-state">No matches found. Schedule one!</div>`;
  } else {
    const statusMap = { scheduled: ['Scheduled', 'sm-scheduled'], live: ['Live Now', 'sm-live'], completed: ['Completed', 'sm-completed'] };
    document.getElementById('matches-rows').innerHTML = slice.map(m => {
      const [label, cls] = statusMap[m.status] || ['—', ''];
      const isLive = m.status === 'live';
      const scoreHtml = m.status === 'completed' ? `${m.score1}–${m.score2}` : 'vs';
      return `
        <div class="sm-row">
          <span class="sm-col-id match-id-link">#${m.id}</span>
          <span class="sm-col-teams">${m.team1} <span class="vs-sep">${scoreHtml}</span> ${m.team2}</span>
          <span class="sm-col-round">${m.round}</span>
          <span class="sm-col-date">
            <span>${m.date}</span>
            <span class="match-time ${isLive ? 'time-live' : ''}">${isLive ? 'In Progress' : m.time}</span>
          </span>
          <span class="sm-col-status">
            <span class="sm-status-badge ${cls}">${label}</span>
            ${m.status !== 'completed' ? `<a href="comp-match-results.html?id=${comp.id}&matchId=${encodeURIComponent(m.id)}" class="btn-xs btn-enter" data-match-id="${m.id}">ENTER RESULT</a>` : ''}
          </span>
        </div>`;
    }).join('');
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  document.getElementById('matches-pagination').innerHTML = `
    <span class="pg-info">Showing ${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE,total)} of ${total} matches</span>
    <div class="pg-btns">
      <button class="pg-btn" onclick="setMP(${matchPage-1})" ${matchPage===1?'disabled':''}>Previous</button>
      <button class="pg-btn" onclick="setMP(${matchPage+1})" ${matchPage>=pages?'disabled':''}>Next</button>
    </div>`;
}

window.setMP = p => { matchPage = p; renderMatches(); };

function setupControls() {
  document.getElementById('matches-search').addEventListener('input', e => { matchSearch = e.target.value.toLowerCase().trim(); matchPage = 1; renderMatches(); });
  document.getElementById('matches-status-filter').addEventListener('change', e => { matchFilter = e.target.value; matchPage = 1; renderMatches(); });

  const team1Select = document.getElementById('sf-team1');
  const team2Select = document.getElementById('sf-team2');
  if (team1Select && team2Select) {
    team1Select.addEventListener('change', () => populateTeamDropdowns());
    team2Select.addEventListener('change', () => populateTeamDropdowns());
  }

  document.getElementById('schedule-form').addEventListener('submit', e => {
    e.preventDefault();
    const t1    = document.getElementById('sf-team1').value;
    const t2    = document.getElementById('sf-team2').value;
    const date  = document.getElementById('sf-date').value;
    const time  = document.getElementById('sf-time').value;
    const round = document.getElementById('sf-round').value;

    if (!t1 || !t2 || t1 === t2) { alert('Please select two different teams.'); return; }

    const newMatch = {
      id: `M${Date.now().toString().slice(-6)}`,
      team1: t1, team2: t2,
      round, status: 'scheduled',
      date: date ? new Date(date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '—',
      time: time || '—'
    };

    comp.matches.unshift(newMatch);
    comp.totalMatches = comp.matches.length;
    window.NexusData.updateCompetition(comp);
    document.getElementById('schedule-form').reset();
    populateTeamDropdowns();
    populateRoundDropdown();   // re-apply correct options after reset
    renderMatches();
  });
}
