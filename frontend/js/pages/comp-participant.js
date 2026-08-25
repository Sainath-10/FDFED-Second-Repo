/* =============================================================
   NEXUS ESPORTS — comp-participant.js
   Participant view: hero, about, my team (live roster),
   match schedule (live from organizer), standings.
   All data is read FRESH from localStorage on every render
   and auto-refreshed via polling every 3 seconds.
   ============================================================= */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const compId = params.get('id');

  /* ── Helpers ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  function fmtPrize(val) {
    if (!val) return '—';
    if (typeof val === 'string' && val.startsWith('₹')) return val;
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  function normalize(v) {
    return String(v || '').trim().toLowerCase();
  }

  /* ── Always-fresh data loaders ────────────────────────────── */
  function freshComp() {
    const all = window.NexusData ? window.NexusData.loadCompetitions() : [];
    return all.find(c => String(c.id) === String(compId))
      || all.find(c => c.role === 'participant')
      || {};
  }

  function freshMyTeam(comp) {
    if (!window.NexusTeamWorkflow || !comp.id) return null;
    if (typeof window.NexusTeamWorkflow.findUserTeamInCompetition !== 'function') return null;
    const bundle = window.NexusTeamWorkflow.findUserTeamInCompetition(comp.id);
    return (bundle && bundle.team) ? bundle.team : null;
  }

  /* ── Static competition metadata (read once) ──────────────── */
  const comp0       = freshComp();
  const isLeague    = (comp0.type || 'league') === 'league';
  const compName    = comp0.name     || 'Competition';
  const compGame    = comp0.game     || 'Unknown Game';
  const compStatus  = comp0.status   || 'ongoing';
  const compFormat  = comp0.format   || (isLeague ? 'Round Robin' : 'Single Elimination');
  const compLocation= comp0.location || 'Online';
  const compPrize   = comp0.prizePool|| comp0.prize || '₹0';
  const compDates   = comp0.dates    || 'TBD';
  const compParticipants = comp0.participants || comp0.registeredTeams || 0;
  const compDesc    = comp0.description
    || `${compName} is a competitive ${compGame} ${isLeague ? 'league' : 'tournament'}. Teams battle across ${isLeague ? 'a structured league format with standings' : 'a knockout bracket'} competing for the ${fmtPrize(compPrize)} prize pool.`;

  /* ── HERO (static — built once) ───────────────────────────── */
  function buildHero() {
    $('part-hero-tags').innerHTML =
      `<span class="hero-tag-status">${compStatus.toUpperCase()}</span>
       <span class="hero-tag-game">${compGame}</span>`;

    $('part-hero-title').textContent = compName;

    $('part-hero-meta').innerHTML = `
      <span class="hero-meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${compDates}
      </span>
      <span class="hero-meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        ${fmtPrize(compPrize)} Prize Pool
      </span>
      <span class="hero-meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
        ${compParticipants} participants
      </span>
      <span class="hero-meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
        ${compLocation}
      </span>`;

    const standingsBtn = isLeague
      ? `<button class="hero-btn hero-btn-secondary"
           onclick="document.getElementById('part-standings-section').scrollIntoView({behavior:'smooth',block:'start'})">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
           View Standings
         </button>`
      : '';

    const backId = comp0.id || compId || '';
    $('part-hero-actions').innerHTML = `
      <a class="hero-btn hero-btn-secondary" href="comp-info.html?id=${backId}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </a>
      ${standingsBtn}`;
  }

  /* ── ABOUT (static — built once) ──────────────────────────── */
  function buildAbout() {
    $('part-about-panel').innerHTML = `
      <div class="about-section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        About This Competition
      </div>
      <p class="about-panel-desc">${compDesc}</p>
      <div class="about-meta-blocks">
        <div class="about-meta-block">
          <span class="about-meta-label">Type</span>
          <span class="about-meta-val">${isLeague ? 'League' : 'Tournament'}</span>
        </div>
        <div class="about-meta-block">
          <span class="about-meta-label">Format</span>
          <span class="about-meta-val">${compFormat}</span>
        </div>
        <div class="about-meta-block">
          <span class="about-meta-label">Location</span>
          <span class="about-meta-val">${compLocation}</span>
        </div>
        <div class="about-meta-block">
          <span class="about-meta-label">Organizer</span>
          <span class="about-meta-val">${comp0.organizer || comp0.organizerName || comp0.createdBy || 'ArenaHub Events'}</span>
        </div>
      </div>`;
  }

  /* ── MY TEAM (live — re-reads localStorage every call) ─────── */
  function buildMyTeam() {
    const comp   = freshComp();
    const myTeam = freshMyTeam(comp);

    if (!myTeam) {
      $('my-team-content').innerHTML = `
        <p style="color:#4b5563;font-size:14px;padding:16px 0">
          You are not currently registered in a team for this competition.
        </p>`;
      return;
    }

    const teamName = myTeam.name || 'My Team';
    const abbr     = teamName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'MT';

    // Captain: prefer member with captain role, fallback to createdBy
    const captainMember = Array.isArray(myTeam.members)
      ? myTeam.members.find(m => ['captain', 'leader'].includes(normalize(m.role)))
      : null;
    const captainName = (captainMember && (captainMember.displayName || captainMember.username))
      || myTeam.createdBy || 'Team Captain';

    // All members (captain always shown; others shown if approved or no status set)
    const allMembers = Array.isArray(myTeam.members) ? myTeam.members : [];
    const rosterMembers = allMembers.filter(m => {
      const isCaptain = ['captain', 'leader'].includes(normalize(m.role))
        || normalize(m.username) === normalize(myTeam.createdBy);
      const st = normalize(m.status);
      return isCaptain || !st || st === 'approved' || st === 'active';
    });

    const memberCount = allMembers.length;

    // Standings rank from comp data
    const standings = Array.isArray(comp.standings) ? comp.standings : [];
    let rank = '#—';
    if (standings.length) {
      const idx = standings.findIndex(s => normalize(s.team) === normalize(teamName));
      if (idx >= 0) rank = '#' + (standings[idx].rank || idx + 1);
    }

    // Roster rows
    const rosterHtml = rosterMembers.length > 0
      ? `<div style="margin-top:20px;">
           <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.8px;">
             Team Roster · ${rosterMembers.length} / 5 players
           </div>
           <div style="display:flex;flex-direction:column;gap:7px;">
             ${rosterMembers.map(m => {
               const name = m.displayName || m.username || 'Unknown Player';
               const isCaptain = ['captain','leader'].includes(normalize(m.role))
                 || normalize(m.username) === normalize(myTeam.createdBy);
               const initials = name.substring(0, 2).toUpperCase();
               const badge = isCaptain
                 ? `<span style="font-size:10px;background:rgba(198,255,51,0.15);color:#C6FF33;padding:2px 7px;border-radius:4px;margin-left:8px;font-weight:600;">CAPTAIN</span>`
                 : `<span style="font-size:10px;background:rgba(255,255,255,0.06);color:#94a3b8;padding:2px 7px;border-radius:4px;margin-left:8px;">PLAYER</span>`;
               return `
                 <div style="display:flex;align-items:center;background:rgba(255,255,255,0.03);padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
                   <div style="width:30px;height:30px;border-radius:6px;background:${isCaptain ? 'rgba(198,255,51,0.15)' : '#1e293b'};color:${isCaptain ? '#C6FF33' : '#e2e8f0'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-right:12px;flex-shrink:0;">
                     ${initials}
                   </div>
                   <div style="font-size:14px;color:#f8fafc;font-weight:500;flex:1;">${name}${badge}</div>
                 </div>`;
             }).join('')}
           </div>
         </div>`
      : `<p style="color:#4b5563;font-size:13px;margin-top:16px;">No players in roster yet.</p>`;

    $('my-team-content').innerHTML = `
      <div class="my-team-card">
        <div class="my-team-avatar-box">${abbr}</div>
        <div class="my-team-info">
          <div class="my-team-name">${teamName}</div>
          <div class="my-team-sub">Season ${comp.season || '1'}</div>
        </div>
      </div>
      <div class="my-team-stats-grid">
        <div class="my-team-stat">
          <span class="my-team-stat-lbl">Members</span>
          <span class="my-team-stat-val">${memberCount}</span>
        </div>
        <div class="my-team-stat">
          <span class="my-team-stat-lbl">Captain</span>
          <span class="my-team-stat-val">${captainName}</span>
        </div>
        <div class="my-team-stat" style="grid-column:1/-1">
          <span class="my-team-stat-lbl">${isLeague ? 'League' : 'Tournament'} Rank</span>
          <span class="my-team-stat-val my-team-stat-accent">${rank}</span>
        </div>
      </div>
      ${rosterHtml}`;
  }

  /* ── MATCH SCHEDULE (live — re-reads localStorage every call) */
  function buildMatches() {
    const comp    = freshComp();
    const myTeam  = freshMyTeam(comp);
    const myTeamName = myTeam ? (myTeam.name || '') : '';
    const list    = $('part-matches-list');

    // Use real matches from the competition stored in localStorage
    const rawMatches = Array.isArray(comp.matches) ? comp.matches : [];

    if (!rawMatches.length) {
      list.innerHTML = '<p style="color:#4b5563;font-size:14px;padding:16px 0">No matches scheduled yet.</p>';
      return;
    }

    // Normalise to internal format
    const MATCHES = rawMatches.map(m => ({
      t1:     m.team1,
      t2:     m.team2,
      round:  m.round || '—',
      date:   m.date  || '—',
      time:   m.time  || '',
      status: m.status === 'scheduled' ? 'upcoming' : (m.status || 'upcoming'),
      score:  m.status === 'completed'
                ? `${m.score1 ?? '—'} - ${m.score2 ?? '—'}`
                : (m.status === 'live' ? `${m.score1 || 0} - ${m.score2 || 0}` : null),
    }));

    const statusMap = {
      completed: ['msb msb-completed', 'Completed'],
      live:      ['msb msb-live',      '● Live'],
      upcoming:  ['msb msb-upcoming',  'Upcoming'],
      scheduled: ['msb msb-upcoming',  'Upcoming'],
    };

    list.innerHTML = MATCHES.map(m => {
      const [cls, lbl] = statusMap[m.status] || ['msb msb-upcoming', 'Upcoming'];

      // Highlight the user's team name
      const t1Norm  = normalize(m.t1);
      const myNorm  = normalize(myTeamName);
      const t1Html  = (myNorm && t1Norm === myNorm)
        ? `<span class="my-hl">${m.t1}</span>`
        : m.t1;
      const t2Html  = (myNorm && normalize(m.t2) === myNorm)
        ? `<span class="my-hl">${m.t2}</span>`
        : m.t2;

      const scoreHtml = m.score
        ? `<div class="part-match-score">${m.score}</div>`
        : `<div class="part-match-score part-match-score-dim">— : —</div>`;

      const timeStr = m.date + (m.time ? ' — ' + m.time : '');

      return `
        <div class="part-match-item${m.status === 'live' ? ' part-match-item-live' : ''}">
          <div class="part-match-teams">
            <div class="part-match-title">${t1Html} vs ${t2Html}</div>
            <div class="part-match-round">${m.round}</div>
          </div>
          ${scoreHtml}
          <div class="part-match-right">
            <div class="part-match-time">${timeStr}</div>
            <span class="${cls}">${lbl}</span>
          </div>
        </div>`;
    }).join('');
  }

  /* ── STANDINGS (league only) ──────────────────────────────── */
  function buildStandings() {
    const comp     = freshComp();
    const myTeam   = freshMyTeam(comp);
    const myName   = myTeam ? normalize(myTeam.name || '') : '';
    const section  = $('part-standings-section');
    if (!section) return;

    if (!isLeague) {
      const titleSpan = section.querySelector('.part-panel-title-row span');
      if (titleSpan) titleSpan.textContent = 'Tournament Bracket';
      const svgEl = section.querySelector('.part-panel-title-row svg');
      if (svgEl) svgEl.outerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="6" height="4" rx="1"/><rect x="15" y="3" width="6" height="4" rx="1"/><rect x="9" y="10" width="6" height="4" rx="1"/><line x1="6" y1="7" x2="6" y2="12"/><line x1="18" y1="7" x2="18" y2="12"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="12" x2="12" y2="14"/></svg>`;
      $('part-standings-table').innerHTML = `
        <div style="padding:32px;text-align:center;">
          <p style="color:#9aa4b2;font-size:14px;margin:0 0 6px">
            This is a <strong style="color:#fff">${compFormat}</strong> tournament —<br>standings tables are not used.
          </p>
          <span style="font-size:12px;color:#4b5563">Bracket view available once all teams are confirmed.</span>
        </div>`;
      return;
    }

    // Build standings from real match results
    const teams = (comp.teams || []).filter(t => t.status === 'approved');
    const table = {};
    teams.forEach(t => {
      table[t.name] = { team: t.name, mp: 0, w: 0, l: 0, pts: 0 };
    });
    (comp.matches || []).forEach(m => {
      if (m.status !== 'completed') return;
      if (!table[m.team1]) table[m.team1] = { team: m.team1, mp: 0, w: 0, l: 0, pts: 0 };
      if (!table[m.team2]) table[m.team2] = { team: m.team2, mp: 0, w: 0, l: 0, pts: 0 };
      const t1 = table[m.team1]; const t2 = table[m.team2];
      t1.mp++; t2.mp++;
      if (m.score1 > m.score2)      { t1.w++; t1.pts += 3; t2.l++; }
      else if (m.score2 > m.score1) { t2.w++; t2.pts += 3; t1.l++; }
      else                           { t1.pts++; t2.pts++; }
    });

    const rows = Object.values(table)
      .sort((a, b) => (b.pts - a.pts) || (b.w - a.w))
      .map((s, i) => ({ ...s, rank: i + 1, you: myName && normalize(s.team) === myName }));

    if (!rows.length) {
      $('part-standings-table').innerHTML = '<p style="color:#4b5563;font-size:14px;padding:16px 0">No standing data yet.</p>';
      return;
    }

    $('part-standings-table').innerHTML = `
      <div class="part-standings-wrap">
        <table class="part-standings-table-el">
          <thead><tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>L</th><th>PTS</th></tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr${s.you ? ' class="you-row"' : ''}>
                <td><span class="s-rank-badge${s.rank <= 3 ? ' s-rank-' + s.rank : ''}">${s.rank}</span></td>
                <td><span class="s-team-cell">
                  <span class="s-team-name">${s.team}</span>
                  ${s.you ? '<span class="s-you-tag">You</span>' : ''}
                </span></td>
                <td style="color:#9aa4b2">${s.mp}</td>
                <td class="s-green">${s.w}</td>
                <td class="s-red">${s.l}</td>
                <td class="s-pts">${s.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ── Live-update polling: refresh dynamic sections every 3s ─ */
  function refreshDynamic() {
    buildMyTeam();
    buildMatches();
    buildStandings();
  }

  /* ── INIT ─────────────────────────────────────────────────── */
  buildHero();
  buildAbout();
  refreshDynamic();

  // Poll for changes from organizer (matches) and team lead (roster)
  setInterval(refreshDynamic, 3000);

})();
