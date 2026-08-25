/* ============================================================
   NEXUS ESPORTS — Competition Detail JS
   Works for both League and Tournament
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const id = window.NexusData.getCompIdFromUrl();
  if (!id) { window.location.href = 'my-activity.html'; return; }

  const comp = window.NexusData.getCompetitionById(id);
  if (!comp) {
    renderEmptyComp(id);
    return;
  }
  render(comp);

  // Apply ended guard after render (hero buttons are in DOM now)
  if (window.NexusData && window.NexusData.enforceNotEnded) {
    window.NexusData.enforceNotEnded(comp,
      '.act-btn-approve,.act-btn-reject,.disp-btn-resolve,.btn-schedule'
    );
  }
});

function render(comp) {
  renderHero(comp);
  renderStats(comp);
  renderTeams(comp);
  renderMatches(comp);
  if (comp.type === 'league') renderLeagueBracket(comp);
  else renderBracket(comp);
  setupNavLinks(comp.id);
}

// ─── Hero ────────────────────────────────────────────────────
function renderHero(comp) {
  document.title = `NEXUS ESPORTS — ${comp.name}`;

  const hero = document.getElementById('comp-hero');
  hero.style.background = `linear-gradient(135deg, ${comp.bannerColor || '#1a2e1a'} 0%, #0a0a0a 70%)`;

  const statusColors = { ongoing: '#c6ff33', completed: '#9aa4b2', upcoming: '#60a5fa' };
  const statusLabels = { ongoing: 'ONGOING', completed: 'COMPLETED', upcoming: 'UPCOMING' };

  document.getElementById('comp-hero-tags').innerHTML = `
    <span class="hero-tag hero-tag-status" style="color:${statusColors[comp.status] || '#c6ff33'}">${statusLabels[comp.status] || comp.status.toUpperCase()}</span>
    <span class="hero-tag-sep">•</span>
    <span class="hero-tag hero-tag-game">${comp.game.toUpperCase()}</span>
  `;

  document.getElementById('comp-hero-title').textContent = comp.name;

  document.getElementById('comp-hero-meta').innerHTML = `
    <span class="hero-meta-item">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="2" width="14" height="13" rx="2"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/></svg>
      ${comp.dates}
    </span>
    <span class="hero-meta-item">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z"/><circle cx="8" cy="6" r="1.5"/></svg>
      ${comp.location}
    </span>
    <span class="hero-meta-item">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 15c0-3 2.7-5 6-5s6 2 6 5"/></svg>
      ${comp.participants} Participants
    </span>
    <span class="hero-meta-item">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.5 1h7l-1 5a3.5 3.5 0 0 1-5 0L4.5 1z"/><path d="M2 1h2.5m9 0H14"/><path d="M8 9v5m-2 0h4"/></svg>
      ${comp.prizePool} Prize Pool
    </span>
    <span class="hero-meta-item">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
      ${comp.season}
    </span>
  `;

  const isEnded = !!(comp.ended || comp.status === 'completed');

  const standingsAction = `<a href="comp-standings.html?id=${comp.id}" class="hero-btn hero-btn-secondary">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      VIEW STANDINGS
    </a>`;

  // If ended: only show view-only actions, hide edit/manage
  const actionButtons = isEnded
    ? `${standingsAction}
       <span class="hero-btn" style="background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.35);color:#fb923c;cursor:default;pointer-events:none;">
         🏁 COMPETITION ENDED
       </span>`
    : `<a href="comp-manage-teams.html?id=${comp.id}" class="hero-btn hero-btn-secondary">
       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
       MANAGE TEAMS
     </a>
     <a href="comp-manage-matches.html?id=${comp.id}" class="hero-btn hero-btn-secondary">
       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
       MANAGE MATCHES
     </a>
     ${standingsAction}
     <a href="comp-dispute-review.html?id=${comp.id}" class="hero-btn hero-btn-secondary" style="border-color:rgba(239,68,68,0.4);color:#fca5a5;">
       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
       DISPUTES (${(comp.disputes || []).filter(d => d.status !== 'resolved').length})
     </a>
     <a href="edit-competition.html?id=${comp.id}" class="hero-btn hero-btn-secondary">
       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
       EDIT COMPETITION
     </a>`;

  document.getElementById('comp-hero-actions').innerHTML = actionButtons;
}

function renderStats(comp) {
  const approved = comp.teams.filter(t => t.status === 'approved').length;
  const maxTeams = comp.maxTeams || 16;
  const typeLabel = comp.type === 'tournament' ? 'TOURNAMENT' : 'LEAGUE';

  document.getElementById('comp-stats-row').innerHTML = `
    <div class="stat-card"><span class="stat-label">${typeLabel}</span><span class="stat-val">${comp.name}</span></div>
    <div class="stat-card"><span class="stat-label">TITLE</span><span class="stat-val">
      <span class="stat-game-icon">🎮</span> ${comp.game}
    </span></div>
    <div class="stat-card"><span class="stat-label">MATCHES</span><span class="stat-val stat-accent">${comp.totalMatches}</span></div>
    <div class="stat-card"><span class="stat-label">TEAMS</span><span class="stat-val stat-accent">${approved} / ${maxTeams}</span></div>
    <div class="stat-card stat-card-highlight"><span class="stat-label">STATUS</span><span class="stat-val stat-accent">${comp.status.toUpperCase()}</span></div>
  `;
}

// ─── Teams Table ─────────────────────────────────────────────
function renderTeams(comp) {
  const teams = comp.teams || [];
  const approvedCount = teams.filter(t => t.status === 'approved').length;
  document.getElementById('teams-count-label').textContent = `Showing all ${teams.length} teams (${approvedCount} approved)`;

  if (!teams.length) {
    document.getElementById('comp-teams-table').innerHTML = `<div class="empty-state">No teams registered yet.</div>`;
    return;
  }

  const rows = teams.map(t => {
    const statusMap = { approved: 'APPROVED', pending: 'PENDING', rejected: 'REJECTED' };
    const statusCls = { approved: 'status-approved', pending: 'status-pending', rejected: 'status-rejected' };
    
    // Only show approve/reject for organizer if pending
    const canManage = comp.role === 'organizer' && t.status === 'pending';
    const actionHtml = canManage
      ? `<button class="act-btn act-btn-approve" onclick="approveTeam('${comp.id}','${t.id}')">Approve</button>
         <button class="act-btn act-btn-reject" onclick="rejectTeam('${comp.id}','${t.id}')">Reject</button>`
      : '';

    return `
      <div class="team-row">
        <div class="team-avatar" style="cursor:pointer" onclick="location.href='team/team-roster.html?compId=${comp.id}&teamId=${t.id}'">${t.avatar || '🛡️'}</div>
        <div class="team-info" style="cursor:pointer" onclick="location.href='team/team-roster.html?compId=${comp.id}&teamId=${t.id}'">
          <span class="team-name">${t.name}</span>
          <span class="team-players">${t.players || 0} Players</span>
        </div>
        <span class="team-status ${statusCls[t.status] || ''}">${statusMap[t.status] || t.status.toUpperCase()}</span>
        <div class="team-actions">${actionHtml}</div>
      </div>`;
  }).join('');

  document.getElementById('comp-teams-table').innerHTML = `<div class="teams-list" style="max-height: 400px; overflow-y: auto;">${rows}</div>`;
}

window.approveTeam = function (compId, teamId) {
  const comp = window.NexusData.getCompetitionById(compId);
  if (!comp) return;
  if (window.NexusData.isCompEnded && window.NexusData.isCompEnded(comp)) {
    if (typeof showToast === 'function') showToast('Competition has ended — team approvals are locked.', 'error');
    return;
  }
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch (_) { return null; }
  })();
  const by = session && session.username ? session.username : 'organizer';

  if (window.NexusData && typeof window.NexusData.setTeamRegistrationStatus === 'function') {
    window.NexusData.setTeamRegistrationStatus(compId, teamId, 'approved', by);
  } else {
    const t = comp.teams.find(t => t.id === teamId);
    if (t) { t.status = 'approved'; window.NexusData.updateCompetition(comp); }
  }

  renderTeams(window.NexusData.getCompetitionById(compId) || comp);
};
window.rejectTeam = function (compId, teamId) {
  const comp = window.NexusData.getCompetitionById(compId);
  if (!comp) return;
  if (window.NexusData.isCompEnded && window.NexusData.isCompEnded(comp)) {
    if (typeof showToast === 'function') showToast('Competition has ended — team approvals are locked.', 'error');
    return;
  }
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch (_) { return null; }
  })();
  const by = session && session.username ? session.username : 'organizer';

  if (window.NexusData && typeof window.NexusData.setTeamRegistrationStatus === 'function') {
    window.NexusData.setTeamRegistrationStatus(compId, teamId, 'rejected', by);
  } else {
    const t = comp.teams.find(t => t.id === teamId);
    if (t) { t.status = 'rejected'; window.NexusData.updateCompetition(comp); }
  }

  renderTeams(window.NexusData.getCompetitionById(compId) || comp);
};

// ─── Matches ─────────────────────────────────────────────────
let matchPage = 0;
let currentComp = null;

function renderMatches(comp) {
  currentComp = comp;
  const LIMIT = 3;
  const slice = comp.matches.slice(matchPage * LIMIT, matchPage * LIMIT + LIMIT);

  if (!comp.matches.length) {
    document.getElementById('comp-matches-list').innerHTML = `<div class="empty-state">No matches scheduled yet.</div>`;
    return;
  }

  const html = slice.map(m => {
    const isLive = m.status === 'live';
    const isComp = m.status === 'completed';
    const liveTag = isLive ? `<span class="live-tag">LIVE</span>` : '';

    let teamsHtml;
    if (isComp) {
      teamsHtml = `
        <span class="match-team">${m.team1}</span>
        <span class="match-score">${m.score1} – ${m.score2}</span>
        <span class="match-team">${m.team2}</span>`;
    } else {
      teamsHtml = `
        <span class="match-team">${m.team1}</span>
        <span class="match-vs">VS</span>
        <span class="match-team">${m.team2}</span>`;
    }

    return `
      <div class="match-item ${isLive ? 'match-item-live' : ''}">
        <div class="match-round">${m.round} ${liveTag}</div>
        <div class="match-teams-row">${teamsHtml}</div>
        <div class="match-meta">${m.date} · ${m.time}</div>
        ${isLive ? `<a href="comp-match-results.html?id=${comp.id}" class="match-result-btn">MATCH RESULTS</a>` : ''}
      </div>`;
  }).join('');

  document.getElementById('comp-matches-list').innerHTML = html;

  document.getElementById('match-prev').disabled = matchPage === 0;
  document.getElementById('match-next').disabled = (matchPage + 1) * LIMIT >= comp.matches.length;
}

document.getElementById('match-prev').addEventListener('click', () => { if (matchPage > 0) { matchPage--; renderMatches(currentComp); } });
document.getElementById('match-next').addEventListener('click', () => {
  if (currentComp && (matchPage + 1) * 3 < currentComp.matches.length) { matchPage++; renderMatches(currentComp); }
});

// ─── League Bracket (replaces Standings for leagues) ──────────────────
function renderLeagueBracket(comp) {
  const section = document.getElementById('comp-bracket-section');
  if (section) section.style.display = 'block';

  // Update title to League Bracket
  const titleEl = document.getElementById('bracket-section-title');
  if (titleEl) titleEl.textContent = 'League Bracket';

  if (!comp.matches || comp.matches.length === 0) {
    document.getElementById('comp-bracket-info').innerHTML =
      '<p style="color:#9aa4b2;font-size:14px;">No matches scheduled yet.</p>';
    return;
  }

  // Robust round sorting priority
  const getPriority = (r) => {
    const s = r.toLowerCase().replace(/\s/g, '');
    if (s.includes('group')) return 1;
    if (s.includes('elim'))  return 2;
    if (s.includes('quarter') || s.includes('quater')) return 3;
    if (s.includes('semi'))  return 4;
    if (s.includes('final')) return 5;
    return 99;
  };

  const rounds = {};
  comp.matches.forEach(m => {
    const key = m.round || 'Group Stage';
    if (!rounds[key]) rounds[key] = [];
    rounds[key].push(m);
  });

  // Sort rounds by priority
  const sortedRoundKeys = Object.keys(rounds).sort((a, b) => getPriority(a) - getPriority(b) || a.localeCompare(b));

  let html = '<div class="bracket-grid">';
  sortedRoundKeys.forEach(round => {
    html += `<div class="bracket-round"><div class="bracket-round-label">${round}</div>`;
    rounds[round].forEach(m => {
      const isComp = m.status === 'completed';
      const isLive = m.status === 'live';
      const liveChip = isLive ? '<span style="background:#c6ff33;color:#000;font-size:9px;padding:1px 6px;border-radius:999px;font-weight:800;margin-left:6px;">LIVE</span>' : '';
      html += `
        <div class="bracket-match ${isLive ? 'bracket-match-live' : ''}">
          <div class="bracket-team ${isComp && m.score1 > m.score2 ? 'bracket-winner' : ''}">
            <span>${m.team1}</span>${isComp ? `<span>${m.score1}</span>` : ''}
          </div>
          <div class="bracket-team ${isComp && m.score2 > m.score1 ? 'bracket-winner' : ''}">
            <span>${m.team2}</span>${isComp ? `<span>${m.score2}</span>` : ''}
          </div>
          ${isLive ? liveChip : ''}
        </div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('comp-bracket-info').innerHTML = html;
}

// ─── Standings (League) ──────────────────────────────────────
function renderStandings(comp) {
  document.getElementById('comp-standings-section').style.display = 'block';

  if (!comp.standings.length) {
    document.getElementById('comp-standings-table').innerHTML = `<div class="empty-state">Standings will appear once matches begin.</div>`;
    return;
  }

  const header = `
    <div class="standings-header">
      <span class="col-rank">RANK</span>
      <span class="col-team">TEAM</span>
      <span class="col-mp">MP</span>
      <span class="col-w">W</span>
      <span class="col-l">L</span>
      <span class="col-d">D</span>
      <span class="col-pts">POINTS</span>
    </div>`;

  const standings = comp.standings
    .map((s, i) => ({
      rank: s.rank || i + 1,
      team: s.team,
      mp: s.mp || 0,
      w: s.w || 0,
      l: s.l || 0,
      d: s.d || 0,
      points: s.points || s.pts || 0
    }))
    .sort((a, b) => (b.points - a.points) || (b.w - a.w));

  const rows = standings.map((s, index) => `
    <div class="standings-row">
      <span class="col-rank"><span class="rank-badge ${index === 0 ? 'rank-1' : ''}">${String(index + 1).padStart(2, '0')}</span></span>
      <span class="col-team">${s.team}</span>
      <span class="col-mp">${s.mp}</span>
      <span class="col-w stat-green">${s.w}</span>
      <span class="col-l">${s.l}</span>
      <span class="col-d">${s.d}</span>
      <span class="col-pts stat-green">${s.points}</span>
    </div>`).join('');

  document.getElementById('comp-standings-table').innerHTML = header + rows;
}

// ─── Bracket (Tournament) ────────────────────────────────────
function renderBracket(comp) {
  document.getElementById('comp-bracket-section').style.display = 'block';

  // Ensure title says Tournament Bracket for tournaments
  const titleEl = document.getElementById('bracket-section-title');
  if (titleEl) titleEl.textContent = 'Tournament Bracket';

  if (comp.matches.length === 0) return;

  // Robust round sorting priority
  const getPriority = (r) => {
    const s = r.toLowerCase().replace(/\s/g, '');
    if (s.includes('group')) return 1;
    if (s.includes('elim'))  return 2;
    if (s.includes('roundof16')) return 2.5;
    if (s.includes('quarter') || s.includes('quater')) return 3;
    if (s.includes('semi'))  return 4;
    if (s.includes('final')) return 5;
    return 99;
  };

  const rounds = {};
  comp.matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  const sortedRoundKeys = Object.keys(rounds).sort((a, b) => getPriority(a) - getPriority(b) || a.localeCompare(b));

  let html = '<div class="bracket-grid">';
  sortedRoundKeys.forEach(round => {
    html += `<div class="bracket-round"><div class="bracket-round-label">${round}</div>`;
    rounds[round].forEach(m => {
      const isComp = m.status === 'completed';
      html += `
        <div class="bracket-match">
          <div class="bracket-team ${isComp && m.score1 > m.score2 ? 'bracket-winner' : ''}">
            <span>${m.team1}</span> ${isComp ? `<span>${m.score1}</span>` : ''}
          </div>
          <div class="bracket-team ${isComp && m.score2 > m.score1 ? 'bracket-winner' : ''}">
            <span>${m.team2}</span> ${isComp ? `<span>${m.score2}</span>` : ''}
          </div>
        </div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('comp-bracket-info').innerHTML = html;
}



// ─── Nav Links ────────────────────────────────────────────────
function setupNavLinks(id) {
  const lt = document.getElementById('link-manage-teams');
  if (lt) lt.href = `comp-manage-teams.html?id=${id}`;
  const ls = document.getElementById('link-standings');
  if (ls) ls.href = `comp-standings.html?id=${id}`;
}

// ─── Empty state for unknown comp ────────────────────────────
function renderEmptyComp(id) {
  document.getElementById('comp-hero-title').textContent = 'Competition Not Found';
  document.getElementById('comp-hero-tags').innerHTML = `<span class="hero-tag">Unknown</span>`;
}
