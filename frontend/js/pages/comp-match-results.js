/* ============================================================
   NEXUS ESPORTS — Match Results JS
   ============================================================ */

let comp = null;
let resFilter = 'all';
let roundFilter = 'all';
let resSearch = '';
let resPage = 1;
const PAGE_SIZE = 5;
let editMatchId = null;

document.addEventListener('DOMContentLoaded', () => {
  const id = window.NexusData.getCompIdFromUrl();
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('matchId');
  comp = window.NexusData.getCompetitionById(id) || { id, name: 'Competition', game: '—', type: 'league', status: 'upcoming', teams: [], matches: [], totalMatches: 0, matchesCompleted: 0, format: '—', season: '—' };

  document.getElementById('btn-back-to-comp').href = `competition-detail.html?id=${id}`;
  renderSummary();
  populateRoundFilter();
  renderResults();
  setupControls();

  if (matchId) {
    const target = comp.matches.find(m => String(m.id) === String(matchId));
    if (target) {
      openEnter(matchId);
    }
  }
});

document.addEventListener('click', (event) => {
  console.log("clicked enter result");
  const btn = event.target.closest('.btn-enter');
  if (!btn) return;
  const matchId = btn.getAttribute('data-match-id') || btn.getAttribute('data-id');
  if (matchId) {
    openEnter(matchId);
  }
});

function renderSummary() {
  const pct = comp.totalMatches ? Math.round((comp.matchesCompleted / comp.totalMatches) * 100) : 0;
  document.getElementById('comp-summary').innerHTML = `
    <div class="summary-icon">🎮</div>
    <div class="summary-info">
      <div class="summary-header">
        <h2 class="summary-title">${comp.name}</h2>
        <span class="badge-status status-approved">${comp.status.toUpperCase()}</span>
      </div>
      <div class="summary-sub">${comp.game} • ${comp.format}</div>
      <div class="summary-stats">
        <div><span class="stat-label">TOTAL MATCHES</span><span class="stat-val-sm">${comp.totalMatches}</span></div>
        <div><span class="stat-label">MATCHES COMPLETED</span><span class="stat-val-sm stat-green">${comp.matchesCompleted}</span></div>
        <div class="summary-progress-wrap">
          <span class="stat-label">PROGRESS</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
      </div>
    </div>
  `;
}

function populateRoundFilter() {
  const rounds = [...new Set(comp.matches.map(m => m.round))];
  const sel = document.getElementById('results-round-filter');
  sel.innerHTML = `<option value="all">All Rounds</option>` + rounds.map(r => `<option value="${r}">${r}</option>`).join('');
}

function getFiltered() {
  return comp.matches.filter(m => {
    const ms = resFilter === 'all' || m.status === resFilter;
    const mr = roundFilter === 'all' || m.round === roundFilter;
    const mq = !resSearch || m.team1.toLowerCase().includes(resSearch) || m.team2.toLowerCase().includes(resSearch) || m.id.toLowerCase().includes(resSearch);
    return ms && mr && mq;
  });
}

function renderResults() {
  const filtered = getFiltered();
  const total = filtered.length;
  const start = (resPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    document.getElementById('results-rows').innerHTML = `<div class="empty-state">No matches found.</div>`;
  } else {
    document.getElementById('results-rows').innerHTML = slice.map(m => {
      const isComp = m.status === 'completed';
      const isLive = m.status === 'live';
      const stLabel = { completed: 'COMPLETED', live: 'LIVE', scheduled: 'SCHEDULED' }[m.status] || m.status;
      const stCls   = { completed: 'sm-completed', live: 'sm-live', scheduled: 'sm-scheduled' }[m.status] || '';

      const teamsCell = isComp
        ? `<span class="res-team res-team-win">${m.team1}</span>
           <span class="res-score">${m.score1} – ${m.score2}</span>
           <span class="res-team">${m.team2}</span>`
        : `<span class="res-team">${m.team1}</span><span class="res-vs">vs</span><span class="res-team">${m.team2}</span>`;

      const canGoLive = canStartMatch(m);
      const actionsCell = isComp
        ? `<a class="icon-btn" onclick="openEdit('${m.id}')" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></a>
           <a class="icon-btn" title="View"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></a>`
        : (isLive
            ? `<button class="btn-xs btn-enter" type="button" data-match-id="${m.id}" onclick="openEnter('${m.id}')">ENTER RESULT</button>`
            : `<button class="btn-xs btn-enter" type="button" data-match-id="${m.id}" onclick="startMatchLive('${m.id}')" ${canGoLive ? '' : 'disabled'}>${canGoLive ? 'START LIVE' : 'PENDING'}</button>`);

      return `
        <div class="results-row">
          <span class="rc-id match-id-link">#${m.id}</span>
          <span class="rc-teams">${teamsCell}</span>
          <span class="rc-round">${m.round}</span>
          <span class="rc-date">
            <span>${m.date}</span>
            <span class="match-time ${isLive ? 'time-live' : ''}">${isLive ? 'In Progress' : m.time}</span>
          </span>
          <span class="rc-status"><span class="sm-status-badge ${stCls}">${stLabel}</span></span>
          <span class="rc-actions">${actionsCell}</span>
        </div>`;
    }).join('');
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  document.getElementById('results-pagination').innerHTML = `
    <span class="pg-info">Showing ${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE,total)} of ${total} matches</span>
    <div class="pg-btns">
      <button class="pg-btn" onclick="setRP(${resPage-1})" ${resPage===1?'disabled':''}>Previous</button>
      <button class="pg-btn active" onclick="setRP(${resPage})">${resPage}</button>
      <button class="pg-btn" onclick="setRP(${resPage+1})" ${resPage>=pages?'disabled':''}>Next</button>
    </div>`;
}

window.setRP = p => { resPage = p; renderResults(); };

function setupControls() {
  document.getElementById('results-search').addEventListener('input', e => { resSearch = e.target.value.toLowerCase().trim(); resPage = 1; renderResults(); });
  document.getElementById('results-round-filter').addEventListener('change', e => { roundFilter = e.target.value; resPage = 1; renderResults(); });
  document.getElementById('results-status-filter').addEventListener('change', e => { resFilter = e.target.value; resPage = 1; renderResults(); });
}

window.openEnter = function(matchId) {
  editMatchId = matchId;
  const m = comp.matches.find(x => String(x.id) === String(matchId));
  if (!m) return;
  document.getElementById('result-modal-body').innerHTML = `
    <div class="result-teams-display">
      <div class="result-team-block"><div class="team-avatar-sm">${m.team1[0]}</div><span>${m.team1}</span></div>
      <div class="result-score-inputs">
        <input type="number" id="score1-input" min="0" max="99" value="0" class="score-input">
        <span class="score-sep">–</span>
        <input type="number" id="score2-input" min="0" max="99" value="0" class="score-input">
      </div>
      <div class="result-team-block"><div class="team-avatar-sm">${m.team2[0]}</div><span>${m.team2}</span></div>
    </div>
    <div class="result-modal-actions">
      <button class="btn-cancel" onclick="closeResultModal()">Cancel</button>
      <button class="btn-submit" onclick="submitResult()">Save Result</button>
    </div>`;
  const modal = document.getElementById('result-modal');
  if (modal) {
    modal.classList.add('active');
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
};

window.openEdit = function(matchId) { window.openEnter(matchId); };

window.submitResult = function() {
  const s1 = parseInt(document.getElementById('score1-input').value) || 0;
  const s2 = parseInt(document.getElementById('score2-input').value) || 0;
  const m = comp.matches.find(x => String(x.id) === String(editMatchId));
  if (m) {
    m.score1 = s1; m.score2 = s2; m.status = 'completed';
    comp.matchesCompleted = comp.matches.filter(x => x.status === 'completed').length;
    startNextScheduledMatch();
    if (comp.type === 'league') {
      comp.standings = buildStandings(comp);
    }
    window.NexusData.updateCompetition(comp);
    const modal = document.getElementById('result-modal');
    closeResultModal();
    renderSummary(); renderResults();
  }
};

function closeResultModal() {
  const modal = document.getElementById('result-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.classList.remove('open');
  modal.style.display = 'none';
}

function canStartMatch(match) {
  if (!match || match.status !== 'scheduled') return false;
  const hasLive = comp.matches.some(item => item.status === 'live');
  if (hasLive) return false;

  // Prevent start if either team is banned in this competition
  const isT1Banned = window.NexusData.isTeamBannedInComp(match.team1, comp);
  const isT2Banned = window.NexusData.isTeamBannedInComp(match.team2, comp);
  if (isT1Banned || isT2Banned) return false;

  if (!comp || !comp.startDate) return true;
  const start = new Date(comp.startDate);
  return !Number.isNaN(start.getTime()) && Date.now() >= start.getTime();
}

window.startMatchLive = function(matchId) {
  const m = comp.matches.find(x => String(x.id) === String(matchId));
  if (!m) return;
  if (!canStartMatch(m)) return;
  m.status = 'live';
  window.NexusData.updateCompetition(comp);
  renderSummary();
  renderResults();
};

function startNextScheduledMatch() {
  const hasLive = comp.matches.some(item => item.status === 'live');
  if (hasLive) return;
  const next = comp.matches.find(item => item.status === 'scheduled');
  if (!next) return;
  next.status = 'live';
  window.NexusData.updateCompetition(comp);
}

function buildStandings(compData) {
  const teamNames = (compData.teams || []).filter(t => t.status === 'approved').map(t => t.name);
  const table = {};

  teamNames.forEach(name => {
    table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0 };
  });

  (compData.matches || []).forEach(match => {
    if (match.status !== 'completed') return;
    if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0 };
    if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0 };

    const t1 = table[match.team1];
    const t2 = table[match.team2];
    t1.mp += 1;
    t2.mp += 1;

    if (match.score1 > match.score2) {
      t1.w += 1;
      t2.l += 1;
      t1.points += 3;
    } else if (match.score2 > match.score1) {
      t2.w += 1;
      t1.l += 1;
      t2.points += 3;
    } else {
      t1.d += 1;
      t2.d += 1;
      t1.points += 1;
      t2.points += 1;
    }
  });

  return Object.values(table)
    .sort((a, b) => (b.points - a.points) || (b.w - a.w))
    .map((row, index) => Object.assign({}, row, { rank: index + 1 }));
}
