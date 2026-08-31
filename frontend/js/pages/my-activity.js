/* ============================================================
   NEXUS ESPORTS - My Activity Page
   Session-aware activity built from live competition/team state.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  renderAllSections();
  setupSearch();
});

const ICONS = {
  calendar: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" stroke-width="1.33" stroke-linecap="round"><rect x="1" y="2" width="14" height="13" rx="2"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/></svg>`,
  user: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" stroke-width="1.33" stroke-linecap="round"><path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 15c0-3 2.7-5 6-5s6 2 6 5"/></svg>`,
  pin: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" stroke-width="1.33" stroke-linecap="round"><path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z"/><circle cx="8" cy="6" r="1.5"/></svg>`,
  trophy: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C6FF33" stroke-width="1.33" stroke-linecap="round"><path d="M4.5 1h7l-1 5a3.5 3.5 0 0 1-5 0L4.5 1z"/><path d="M2 1h2.5m9 0H14"/><path d="M8 9v5m-2 0h4"/></svg>`
};

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function readSession() {
  try {
    const raw = localStorage.getItem('nexus.auth.session');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function badgeClass(status) {
  return { ongoing: 'act-badge-ongoing', completed: 'act-badge-completed', upcoming: 'act-badge-upcoming' }[status] || 'act-badge-ongoing';
}

function statusLabel(status) {
  return { ongoing: 'Ongoing', completed: 'Completed', upcoming: 'Upcoming' }[status] || status;
}

function approvalClass(status) {
  return {
    pending: 'act-badge-upcoming',
    approved: 'act-badge-ongoing',
    rejected: 'act-badge-completed'
  }[status] || 'act-badge-upcoming';
}

function approvalLabel(status) {
  return {
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected'
  }[status] || 'Pending Approval';
}

function teamRegClass(status) {
  return {
    pending: 'act-badge-upcoming',
    approved: 'act-badge-ongoing',
    rejected: 'act-badge-completed'
  }[status] || 'act-badge-upcoming';
}

function teamRegLabel(status) {
  return {
    pending: 'Team Pending',
    approved: 'Team Approved',
    rejected: 'Team Rejected'
  }[status] || 'Team Pending';
}

function ensureTeamShape(team, comp) {
  const safeTeam = Object.assign({}, team || {});
  safeTeam.members = Array.isArray(safeTeam.members) ? safeTeam.members : [];

  if (safeTeam.members.length === 0 && safeTeam.createdBy) {
    safeTeam.members = [{
      username: safeTeam.createdBy,
      displayName: safeTeam.leader || safeTeam.createdBy,
      role: 'captain',
      joinedAt: safeTeam.created || new Date().toISOString()
    }];
  }

  safeTeam.players = safeTeam.members.length || safeTeam.players || 0;
  safeTeam.competitionId = comp.id;
  return safeTeam;
}

function dedupeById(items) {
  const seen = new Set();
  return (items || []).filter(item => {
    const id = String(item && item.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildBuckets(allComps, session) {
  const userKey = normalize(session && session.username);
  const organized = [];
  const participated = [];
  const teamled = [];

  (allComps || []).forEach(comp => {
    const teams = Array.isArray(comp.teams) ? comp.teams.map(team => ensureTeamShape(team, comp)) : [];

    if (userKey) {
      const isCoOrganizer = Array.isArray(comp.organizers) && comp.organizers.map(normalize).includes(userKey);
      const isOwner = isCoOrganizer || (normalize(comp.organizerId) === userKey) || (normalize(comp.createdBy) === userKey) || (normalize(comp.organizerId) && normalize(comp.organizerId) === normalize((readSession() && readSession().id)));
      if (isOwner) {
        const approvalStatus = window.NexusData && typeof window.NexusData.getApprovalStatus === 'function'
          ? window.NexusData.getApprovalStatus(comp)
          : 'approved';
        if (approvalStatus !== 'rejected') {
          organized.push(Object.assign({}, comp, { role: 'organizer', approvalStatus }));
        }
      }

      const myTeam = teams.find(team => normalize(team.createdBy || team.leaderUsername) === userKey);
      if (myTeam) {
        const teamStatus = normalize(myTeam.status || 'approved');
        if (teamStatus !== 'rejected') {
          teamled.push(Object.assign({}, comp, {
            role: 'teamlead',
            userCreated: true,
            members: myTeam.players,
            participants: myTeam.players,
            teamStatus,
            teamContext: {
              compId: comp.id,
              teamId: myTeam.id,
              teamName: myTeam.name
            }
          }));
        }
      }

      const joinedTeam = teams.find(team => {
        if (normalize(team.createdBy || team.leaderUsername) === userKey) return false;
        return (team.members || []).some(member => normalize(member.username) === userKey);
      });

      if (joinedTeam) {
        participated.push(Object.assign({}, comp, {
          role: 'participant',
          teamJoined: joinedTeam.name,
          teamContext: {
            compId: comp.id,
            teamId: joinedTeam.id,
            teamName: joinedTeam.name
          }
        }));
      }

      return;
    }

    // Legacy fallback when session is not available.
    if (comp.role === 'organizer') organized.push(Object.assign({}, comp));
    if (comp.role === 'participant') participated.push(Object.assign({}, comp));
    if (comp.role === 'teamlead') teamled.push(Object.assign({}, comp));
  });

  return {
    organized: dedupeById(organized),
    participated: dedupeById(participated),
    teamled: dedupeById(teamled)
  };
}

function buildCard(comp) {
  const typeClass = comp.type === 'league' ? 'act-badge-league' : 'act-badge-tournament';
  const typeLabel = comp.type === 'league' ? 'League' : 'Tournament';

  let clickHandler = `window.location.href='../pages/competition-detail.html?id=${encodeURIComponent(comp.id)}'`;
  let cardAttrs = '';

  if (comp.role === 'participant') {
    clickHandler = `window.location.href='../pages/comp-participant.html?id=${encodeURIComponent(comp.id)}'`;
  } else if (comp.role === 'teamlead') {
    const status = normalize(comp.teamStatus || 'approved');
    if (status !== 'approved') {
      clickHandler = `if(typeof showToast==='function'){showToast('Your team registration is ${status}. Access is available after organiser approval.','error');}`;
      cardAttrs = 'style="cursor:not-allowed;opacity:0.9;"';
    } else if (comp.teamContext && comp.teamContext.teamId) {
      clickHandler = `window.location.href='../pages/team/team-roster.html?compId=${encodeURIComponent(comp.teamContext.compId)}&teamId=${encodeURIComponent(comp.teamContext.teamId)}'`;
    } else {
      clickHandler = `window.location.href='../pages/team/team-roster.html?teamId=${encodeURIComponent(comp.id)}'`;
    }
  }

  const myTeamBadge = comp.userCreated
    ? `<span class="act-badge" style="background:rgba(198,255,51,0.12);border:1px solid rgba(198,255,51,0.35);color:#c6ff33;">My Team</span>`
    : '';

  const joinedBadge = comp.teamJoined && comp.role === 'participant'
    ? `<span class="act-badge" style="background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.35);color:#60a5fa;">${comp.teamJoined}</span>`
    : '';

  const participantLabel = comp.userCreated ? 'members' : 'participants';
  const participantValue = comp.participants || comp.members || 0;
  const approvalBadge = comp.role === 'organizer'
    ? `<span class="act-badge act-approved">Auto-Approved (Live)</span>`
    : '';

  const teamRegBadge = comp.role === 'teamlead'
    ? `<span class="act-badge ${teamRegClass(comp.teamStatus || 'pending')}">${teamRegLabel(comp.teamStatus || 'pending')}</span>`
    : '';

  return `
    <div class="act-comp-card"
         data-id="${comp.id}"
         data-name="${(comp.name || '').toLowerCase()}"
         data-game="${(comp.game || '').toLowerCase()}"
         onclick="${clickHandler}" ${cardAttrs}>
      <div class="act-card-top">
        <div class="act-card-meta">
          <p class="act-card-game">${comp.game || 'Unknown Game'}</p>
          <h3 class="act-card-title">${comp.name || 'Unnamed Competition'}</h3>
        </div>
        <div class="act-card-badges">
          <span class="act-badge ${typeClass}">${typeLabel}</span>
          <span class="act-badge ${badgeClass(comp.status)}">${statusLabel(comp.status)}</span>
          ${approvalBadge}
          ${teamRegBadge}
          ${myTeamBadge}
          ${joinedBadge}
        </div>
      </div>
      <div class="act-card-details">
        <div class="act-detail-row">${ICONS.calendar}<span>${comp.dates || 'TBD'}</span></div>
        <div class="act-detail-row">${ICONS.user}<span>${participantValue} ${participantLabel}</span></div>
        <div class="act-detail-row">${ICONS.pin}<span>${comp.location || 'Online'}</span></div>
      </div>
      <div class="act-card-footer">
        ${ICONS.trophy}
        <span class="act-prize">${comp.prizePool || comp.prize || '-'} Prize Pool</span>
      </div>
    </div>
  `;
}

function renderGrid(gridId, countId, comps) {
  const grid = document.getElementById(gridId);
  const count = document.getElementById(countId);
  if (!grid || !count) return;

  const isOrganized = gridId === 'organized-grid';
  const noun = isOrganized ? 'competition' : 'tournament';
  count.textContent = `${comps.length} ${noun}${comps.length !== 1 ? 's' : ''}`;

  if (!comps.length) {
    grid.innerHTML = `<p class="act-empty">No ${noun}s yet.</p>`;
    return;
  }

  let html = '';
  comps.forEach((comp, i) => {
    const isLast = i === comps.length - 1;
    const isOdd = comps.length % 2 !== 0;
    const wide = isLast && isOdd ? ' act-comp-card--wide' : '';
    const card = buildCard(comp).replace('class="act-comp-card"', `class="act-comp-card${wide}"`);
    html += card;
  });

  grid.innerHTML = html;
}

async function renderAllSections() {
  const session = readSession();

  // Start with local data for immediate render
  let allComps = window.NexusData ? window.NexusData.loadCompetitions() : [];
  const buckets = buildBuckets(allComps, session);
  renderGrid('organized-grid', 'organized-count', buckets.organized);
  renderGrid('participated-grid', 'participated-count', buckets.participated);
  renderGrid('teamlead-grid', 'teamlead-count', buckets.teamled);

  // Then try to pull from backend and re-render with merged data
  if (window.NexusAPI && window.NexusAPI.Competitions) {
    try {
      const res = await window.NexusAPI.Competitions.getAll();
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const apiComps = res.data.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          game: c.game || 'Esports',
          type: c.type || 'tournament',
          status: c.status === 'active' ? 'ongoing' : c.status,
          startDate: c.startDate,
          endDate: c.endDate,
          createdBy: c.createdBy,
          organizerId: c.createdBy,
          organizers: c.organizers || [],
          prizePool: c.prizePool || '—',
          entryFee: c.entryFee || 'Free',
          participants: c.participants || 0,
          teams: [],
          matches: [],
          dates: c.startDate
            ? `${new Date(c.startDate).toLocaleDateString('en-IN')} to ${new Date(c.endDate).toLocaleDateString('en-IN')}`
            : 'TBD',
        }));

        // Merge: API comps first, then local comps not already represented (by name)
        const apiNames = new Set(apiComps.map(c => normalize(c.name)));
        const localOnly = allComps.filter(c => !apiNames.has(normalize(c.name)));
        allComps = [...apiComps, ...localOnly];

        const mergedBuckets = buildBuckets(allComps, session);
        renderGrid('organized-grid', 'organized-count', mergedBuckets.organized);
        renderGrid('participated-grid', 'participated-count', mergedBuckets.participated);
        renderGrid('teamlead-grid', 'teamlead-count', mergedBuckets.teamled);
      }
    } catch (err) {
      console.warn('[NexusAPI] Could not load competitions for My Activity:', err.message);
    }
  }
}

function setupSearch() {
  const input = document.getElementById('act-search');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('.act-comp-card').forEach(card => {
      const name = card.dataset.name || '';
      const game = card.dataset.game || '';
      card.style.display = (!q || name.includes(q) || game.includes(q)) ? '' : 'none';
    });
  });
}
