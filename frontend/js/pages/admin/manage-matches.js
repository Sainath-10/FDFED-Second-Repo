/* ============================================================
   NEXUS ESPORTS — Dynamic Admin Manage Matches
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

  loadMatchesData();
});

function loadMatchesData() {
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
    const list = document.getElementById('matches-list');
    if (list) list.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:30px;">Competition not found.</p>`;
    return;
  }

  currentComp = comp;
  currentCompId = comp.id;
  sessionStorage.setItem('last_admin_comp_id', comp.id);

  document.title = `NEXUS ESPORTS — Matches (${comp.name})`;

  // Update Tab links
  const suffix = `?id=${encodeURIComponent(comp.id)}`;

  ['tab-overview', 'tab-teams', 'tab-matches', 'tab-results', 'tab-standings'].forEach(tabId => {
    const a = document.getElementById(tabId);
    if (a) {
      const baseHref = a.getAttribute('href').split('?')[0];
      a.href = baseHref + suffix;
    }
  });

  const subtitle = document.getElementById('matches-subtitle');
  if (subtitle) {
    subtitle.textContent = `${comp.name} · ${comp.format || 'Group Stage'}`;
  }

  renderMatchesList();
}

function renderMatchesList() {
  const container = document.getElementById('matches-list');
  if (!container || !currentComp) return;

  const matches = Array.isArray(currentComp.matches) && currentComp.matches.length > 0
    ? currentComp.matches
    : generateDefaultMatchesForComp(currentComp);

  if (!matches || matches.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;color:var(--text-muted,#9aa4b2);padding:50px 20px;background:#0a0a0a;border-radius:14px;border:1px solid #262626;">
        <div style="font-size:36px;margin-bottom:14px;">🎮</div>
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#fff;">No matches scheduled yet</p>
        <span style="font-size:13px;">Approve teams to auto-generate match schedules for <strong style="color:var(--accent,#c6ff33);">${currentComp.name}</strong>.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = matches.map((m, idx) => {
    const status   = m.status || 'upcoming';
    const isLive   = status === 'live';
    const isDone   = status === 'completed';

    const badgeStyle = isLive
      ? 'background:rgba(198,255,51,0.12);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);'
      : isDone
        ? 'background:rgba(255,255,255,0.06);color:#9aa4b2;border:1px solid rgba(255,255,255,0.1);'
        : 'background:rgba(100,200,255,0.08);color:#64c8ff;border:1px solid rgba(100,200,255,0.2);';

    const badgeLabel = isLive ? '● LIVE' : isDone ? '✓ FINAL' : '⌛ UPCOMING';

    const team1 = m.team1 || m.homeTeam || 'Team A';
    const team2 = m.team2 || m.awayTeam || 'Team B';

    const hasScore = (isLive || isDone) && m.score1 !== undefined && m.score2 !== undefined;
    const s1 = hasScore ? m.score1 : null;
    const s2 = hasScore ? m.score2 : null;

    const t1Win = hasScore && s1 > s2;
    const t2Win = hasScore && s2 > s1;

    const stage = m.stage || `Match ${idx + 1}`;
    const time  = m.scheduledAt || m.time || 'TBD';

    return `
      <div class="match-card-row" data-status="${status}" style="position:relative;overflow:hidden;">

        <!-- Live glow strip -->
        ${isLive ? '<div style="position:absolute;top:0;left:0;width:3px;height:100%;background:#c6ff33;border-radius:3px 0 0 3px;"></div>' : ''}

        <!-- Status + Stage header -->
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:11px;font-weight:800;letter-spacing:1px;padding:4px 10px;border-radius:20px;${badgeStyle}">${badgeLabel}</span>
            <span style="font-size:12px;color:#9aa4b2;font-weight:600;">${stage}</span>
          </div>
          <span style="font-size:12px;color:#666;font-style:italic;">${time}</span>
        </div>

        <!-- Teams vs Score row -->
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;width:100%;">

          <!-- Team 1 -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="font-size:16px;font-weight:800;color:${t1Win ? '#c6ff33' : '#fff'};letter-spacing:0.5px;">${team1}</div>
            ${t1Win ? '<span style="font-size:10px;font-weight:700;letter-spacing:1px;color:#c6ff33;">WINNER</span>' : ''}
          </div>

          <!-- Score / VS -->
          <div style="text-align:center;min-width:80px;">
            ${hasScore
              ? `<div style="font-family:var(--font-display,monospace);font-size:28px;font-weight:800;color:#fff;letter-spacing:2px;">${s1}<span style="color:#333;margin:0 4px;">–</span>${s2}</div>`
              : `<div style="font-size:18px;font-weight:800;color:#444;letter-spacing:3px;">VS</div>`
            }
          </div>

          <!-- Team 2 -->
          <div style="display:flex;flex-direction:column;gap:4px;text-align:right;">
            <div style="font-size:16px;font-weight:800;color:${t2Win ? '#c6ff33' : '#fff'};letter-spacing:0.5px;">${team2}</div>
            ${t2Win ? '<span style="font-size:10px;font-weight:700;letter-spacing:1px;color:#c6ff33;text-align:right;">WINNER</span>' : ''}
          </div>

        </div>
      </div>
    `;
  }).join('');
}

function generateDefaultMatchesForComp(comp) {
  const teams = (comp.teams || []).filter(t => !t.status || t.status === 'approved');
  if (teams.length < 2) return [];

  const matches = [];
  for (let i = 0; i < teams.length - 1; i += 2) {
    const t1 = teams[i].name || `Team ${i + 1}`;
    const t2 = teams[i + 1] ? (teams[i + 1].name || `Team ${i + 2}`) : 'BYE';
    matches.push({
      id: `m_${comp.id}_${i}`,
      team1: t1,
      team2: t2,
      stage: `Round 1 · Match ${Math.floor(i / 2) + 1}`,
      status: i === 0 && comp.status === 'ongoing' ? 'live' : 'upcoming',
      score1: i === 0 && comp.status === 'ongoing' ? 14 : undefined,
      score2: i === 0 && comp.status === 'ongoing' ? 9 : undefined,
      time: comp.dates || 'Upcoming'
    });
  }
  return matches;
}

function filterMatches(filter, btn) {
  document.querySelectorAll('.filter-tabs-row .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const rows = document.querySelectorAll('#matches-list .match-card-row');
  rows.forEach(r => {
    const s = r.getAttribute('data-status');
    if (filter === 'all' || s === filter) {
      r.style.display = 'flex';
    } else {
      r.style.display = 'none';
    }
  });
}

window.filterMatches = filterMatches;
