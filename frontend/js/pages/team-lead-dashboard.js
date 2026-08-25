/* ============================================================
   NEXUS ESPORTS — team-lead-dashboard.js

   Responsibilities:
   1. loadTeamData()     — reads ?compId= and ?teamId= from URL,
                           finds the competition via NexusData, then
                           finds the team within comp.teams[], and
                           populates every element on the page.
   2. renderRoster()     — builds the roster grid from live team
                           members in localStorage; called on load
                           and again after every acceptReq().
   3. Tab switching
   4. Add Players list   (renderPlayers)
   5. Invitations Sent   (renderInvitations / revokeInvite)
   6. Join Request UI    (acceptReq / declineReq)
   7. Invite modal       (openInviteModal / closeInviteModal / sendModalInvite)
   8. Settings save      (saveSettings)
   9. Toast utility
   ============================================================ */

'use strict';

/* ─── Shared gradient/emoji pools ─── */
const POOL_GRAD = [
  'linear-gradient(135deg,#0d2235,#1a3a55)',
  'linear-gradient(135deg,#1e0d35,#38185a)',
  'linear-gradient(135deg,#0d2015,#1a3d25)',
  'linear-gradient(135deg,#2a1500,#4a2800)',
  'linear-gradient(135deg,#001a2a,#003350)',
  'linear-gradient(135deg,#1a0a25,#30154a)',
  'linear-gradient(135deg,#2a1a1a,#4a2a20)',
  'linear-gradient(135deg,#0d1a2a,#1a3350)',
  'linear-gradient(135deg,#1a2a1a,#2a4a2a)',
  'linear-gradient(135deg,#2a2a0d,#4a4a1a)',
];
const POOL_EMOJI = ['🎮','⚡','🦅','🔥','💎','🌌','🕵️','🌠','🛡️','⚔️'];

/* ─── Fallback player pool for Add Players tab ─── */
const PLAYERS_DATA = [
  { tag:'GhostViper_99',   pid:'#GV9920', rank:'Grand Champion III', role:'Striker / IGL',    region:'Delhi',     online:true  },
  { tag:'LunarSlayer',     pid:'#LNSR01', rank:'Grand Champion II',  role:'Support / Anchor', region:'Sri City',  online:false },
  { tag:'Rogue_Tactician', pid:'#RGTC88', rank:'Grand Champion III', role:'Flex / Mid',       region:'Hyderabad', online:true  },
  { tag:'NeonPulse_X',     pid:'#NPX441', rank:'Champion III',       role:'Entry Fragger',    region:'Chennai',   online:true  },
  { tag:'ZeroGravity',     pid:'#ZG007',  rank:'Immortal II',        role:'IGL',              region:'Mumbai',    online:false },
  { tag:'PhantomAce',      pid:'#PA992',  rank:'Radiant',            role:'Fragger',          region:'Bangalore', online:true  },
];

/* Tracks which players have been invited this session */
const invited = new Set();
const PROFILE_RANKS = ['Radiant', 'Immortal', 'Grand Champion III', 'Grand Champion II', 'Champion III'];
const PROFILE_ROLES = ['IGL', 'Fragger', 'Support / Anchor', 'Flex / Mid', 'Striker'];
const PROFILE_REGIONS = ['Delhi', 'Mumbai', 'Hyderabad', 'Chennai', 'Bangalore', 'Sri City'];

/* ================================================================
   HELPERS — get active comp + team from URL + NexusData
   ================================================================ */
function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return { compId: p.get('compId'), teamId: p.get('teamId') || p.get('id') };
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null');
  } catch (_) {
    return null;
  }
}

function getWorkflowContext() {
  if (!window.NexusTeamWorkflow || typeof window.NexusTeamWorkflow.resolveTeamContext !== 'function') {
    return null;
  }
  const ctx = window.NexusTeamWorkflow.resolveTeamContext();
  if (!ctx || !ctx.comp || !ctx.team) return null;
  return ctx;
}

function getCompTeamIds() {
  const url = getUrlParams();
  if (url.compId && url.teamId) {
    return { compId: url.compId, teamId: url.teamId };
  }

  const workflow = getWorkflowContext();
  if (workflow && workflow.context) {
    return { compId: workflow.context.compId, teamId: workflow.context.teamId };
  }

  const comp = getActiveComp();
  const team = getActiveTeam();
  return {
    compId: comp ? comp.id : null,
    teamId: team ? team.id : null
  };
}

function hashCode(value) {
  const str = String(value || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function makeProfileFromUsername(username) {
  const seed = hashCode(username);
  const cleaned = String(username || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return {
    tag: username,
    pid: '#' + (cleaned.slice(0, 6) || 'NEXUS'),
    rank: PROFILE_RANKS[seed % PROFILE_RANKS.length],
    role: PROFILE_ROLES[seed % PROFILE_ROLES.length],
    region: PROFILE_REGIONS[seed % PROFILE_REGIONS.length],
    online: (seed % 2) === 0,
    seed
  };
}

function getInviteCandidates() {
  const ctx = getWorkflowContext();
  if (
    ctx &&
    window.NexusTeamWorkflow &&
    typeof window.NexusTeamWorkflow.getAvailablePlayers === 'function'
  ) {
    return window.NexusTeamWorkflow
      .getAvailablePlayers(ctx.comp.id, ctx.team.id)
      .map(player => makeProfileFromUsername(player.username || player.displayName || 'player'));
  }

  return PLAYERS_DATA.slice();
}

function formatTime(value) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString();
}

function getActiveComp() {
  if (!window.NexusData || typeof window.NexusData.loadCompetitions !== 'function') return null;
  const { compId, teamId } = getUrlParams();
  const all = window.NexusData.loadCompetitions();

  if (compId) return all.find(c => c.id === compId) || null;
  if (teamId) return all.find(c => Array.isArray(c.teams) && c.teams.some(t => t.id === teamId)) || null;

  const workflow = getWorkflowContext();
  if (workflow && workflow.comp) return workflow.comp;

  const session = getSession();
  const userKey = normalize(session && session.username);
  if (!userKey) return null;

  return all.find(c => Array.isArray(c.teams) && c.teams.some(t => normalize(t.createdBy || t.leaderUsername) === userKey)) || null;
}

function getActiveTeamFromComp(comp) {
  if (!comp || !Array.isArray(comp.teams)) return null;
  const { teamId } = getUrlParams();
  if (teamId) return comp.teams.find(t => t.id === teamId) || null;

  const session = getSession();
  const userKey = normalize(session && session.username);
  if (!userKey) return null;

  return comp.teams.find(t =>
    normalize(t.createdBy) === userKey ||
    normalize(t.leaderUsername) === userKey
  ) || null;
}

function getActiveTeam() {
  const comp = getActiveComp();
  const fromComp = getActiveTeamFromComp(comp);
  if (fromComp) return fromComp;

  const workflow = getWorkflowContext();
  if (workflow && workflow.team) return workflow.team;

  return null;
}

/* ── Tiny DOM helpers ── */
function setTxt(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function selectByText(id, text) {
  const sel = document.getElementById(id);
  if (!sel || !text) return;
  const lower = text.toLowerCase();
  for (const opt of sel.options) {
    if (opt.text.toLowerCase() === lower || opt.value.toLowerCase() === lower) { opt.selected = true; break; }
  }
}

/* ================================================================
   1. LOAD TEAM DATA — hero banner + settings pre-fill
   ================================================================ */
function loadTeamData() {
  const comp = getActiveComp();
  const team = getActiveTeam();

  if (!comp && !team) return;

  /* ── Competition subtitle above team name ── */
  if (comp && comp.name) {
    let sub = document.getElementById('hero-comp-subtitle');
    if (!sub) {
      sub = document.createElement('div');
      sub.id = 'hero-comp-subtitle';
      sub.style.cssText = [
        'font-size:12px','letter-spacing:1.5px','text-transform:uppercase',
        'color:rgba(198,255,51,0.75)','font-weight:700','margin-bottom:6px',
        "font-family:'Lato',sans-serif",
      ].join(';');
      const heroName = document.getElementById('hero-name');
      if (heroName && heroName.parentNode) heroName.parentNode.insertBefore(sub, heroName);
    }
    sub.textContent = '📋 ' + comp.name;
  }

  /* ── Team details ── */
  if (team) {
    const teamName    = (team.name || 'My Team').trim();
    const memberCount = Array.isArray(team.members) ? team.members.length : (team.players || 1);
    const game        = (comp && comp.game) || team.game || 'Unknown Game';
    const location    = (comp && (comp.location || comp.region)) || 'Online';

    setTxt('hero-name',    teamName.toUpperCase());
    setTxt('hero-game',    game);
    setTxt('hero-members', memberCount);
    setTxt('hero-active',  memberCount);
    setTxt('hero-rank',    team.rank || '#—');
    setTxt('hero-winrate', team.winRate ? team.winRate + '%' : '—%');

    setVal('set-team-name',   teamName);
    setVal('set-tag',         team.tag || teamName.slice(0, 3).toUpperCase());
    setVal('set-roster-size', team.rosterLimit || memberCount || 12);
    selectByText('set-game',   game);
    selectByText('set-region', location);

    setTxt('modal-team-sub', teamName + ' — Elite Tier Roster');
    document.title = 'NEXUS ESPORTS — ' + teamName;

    // Team registration status (pending/approved/rejected)
    const statusRaw = normalize(team.status || 'approved');
    const statusLabel = statusRaw === 'approved' ? 'Approved' : (statusRaw === 'rejected' ? 'Rejected' : 'Pending');
    const meta = document.querySelector('.hero-meta');
    if (meta) {
      let statusEl = document.getElementById('hero-team-status');
      if (!statusEl) {
        statusEl = document.createElement('span');
        statusEl.id = 'hero-team-status';
        statusEl.className = 'hero-game-tag';
        meta.appendChild(statusEl);
      }
      statusEl.textContent = 'Team ' + statusLabel;
    }

  } else if (comp) {
    const game     = comp.game     || 'Unknown Game';
    const location = comp.location || comp.region || 'Online';
    setTxt('hero-name', (comp.name || 'My Team').toUpperCase());
    setTxt('hero-game', game);
    selectByText('set-game',   game);
    selectByText('set-region', location);
    document.title = 'NEXUS ESPORTS — ' + (comp.name || 'Dashboard');
  }
}

/* ================================================================
   2. ROSTER — render from live team.members[]
   ================================================================ */
function renderRoster() {
  const grid = document.getElementById('roster-grid-dynamic');
  if (!grid) return;

  const team    = getActiveTeam();
  const members = (team && Array.isArray(team.members)) ? team.members : [];

  if (!members.length) {
    grid.innerHTML = `
      <div class="add-card" onclick="switchTab('add-players')">
        <div class="add-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#99a1af" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <p>Add New Player</p>
      </div>`;
    return;
  }

  const cards = members.map((m, i) => {
    const isCaptain = m.role === 'captain';
    const name      = m.displayName || m.username || 'Player';
    const grad      = POOL_GRAD[i % POOL_GRAD.length];
    const emoji     = POOL_EMOJI[i % POOL_EMOJI.length];
    const joined    = m.joinedAt
      ? new Date(m.joinedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
      : 'Recently';

    return `
    <div class="player-card${isCaptain ? ' is-captain' : ''}">
      ${isCaptain
        ? `<div class="cap-star"><svg width="10" height="10" viewBox="0 0 10 10" fill="#000">
             <polygon points="5,1 6.2,3.8 9.5,4 7.5,6 8.1,9.5 5,7.7 1.9,9.5 2.5,6 0.5,4 3.8,3.8"/>
           </svg></div>`
        : ''}
      <div class="pc-emoji" style="background:${grad}">${emoji}</div>
      <div class="pc-name">${name}</div>
      <span class="pc-role-pill">${isCaptain ? 'Captain' : 'Member'}</span>
      <hr class="pc-divider">
      <div class="pc-stats">
        <div><span class="pc-stat-val">—</span><span class="pc-stat-key">Win Rate</span></div>
        <div><span class="pc-stat-val">—</span><span class="pc-stat-key">K/D</span></div>
      </div>
      <div class="pc-status"><span class="online-dot"></span>—</div>
      <div class="pc-joined">Joined ${joined}</div>
    </div>`;
  }).join('');

  const addCard = `
    <div class="add-card" onclick="switchTab('add-players')">
      <div class="add-circle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#99a1af" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <p>Add New Player</p>
    </div>`;

  grid.innerHTML = cards + addCard;

  /* Keep hero stats in sync */
  setTxt('hero-members', members.length);
  setTxt('hero-active',  members.length);

  /* Update section subtitle */
  const sub = document.querySelector('#panel-roster .section-sub');
  if (sub) sub.textContent = members.length + ' active player' + (members.length !== 1 ? 's' : '');
}

/* ================================================================
   3. TAB SWITCHING
   ================================================================ */
function switchTab(id) {
  document.querySelectorAll('.ttab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

  const btn   = document.querySelector(`[data-tab="${id}"]`);
  const panel = document.getElementById('panel-' + id);
  if (btn)   btn.classList.add('active');
  if (panel) panel.classList.add('active');

  if (id === 'add-players') renderPlayers();
  if (id === 'join-requests') renderJoinRequests();
  if (id === 'invitations') renderInvitations();
  if (id === 'roster')      renderRoster();
}

/* ================================================================
   4. TOAST
   ================================================================ */
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', right:'24px', zIndex:9999,
    background: type === 'ok' ? '#c6ff33' : '#e7000b',
    color:      type === 'ok' ? '#000'    : '#fff',
    fontFamily: "'Lato',sans-serif", fontWeight: 700,
    padding:'12px 24px', borderRadius:'8px',
    boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
    fontSize:'14px', letterSpacing:'0.5px',
    transform:'translateY(20px)', opacity:0, transition:'all 0.3s',
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.transform = 'translateY(0)'; t.style.opacity = 1; });
  setTimeout(() => {
    t.style.transform = 'translateY(20px)';
    t.style.opacity   = 0;
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* ================================================================
   5. ADD PLAYERS — render & invite
   ================================================================ */
function renderPlayers() {
  const q    = (document.getElementById('ap-search')?.value   || '').toLowerCase().trim();
  const rank = (document.getElementById('flt-rank')?.value    || '').toLowerCase();
  const role = (document.getElementById('flt-role')?.value    || '').toLowerCase();
  const rgn  = (document.getElementById('flt-region')?.value  || '').toLowerCase();
  const avl  =  document.getElementById('flt-avail')?.value   || '';

  const list = getInviteCandidates().filter(p => {
    if (q    && !p.tag.toLowerCase().includes(q) && !p.role.toLowerCase().includes(q) && !p.region.toLowerCase().includes(q)) return false;
    if (rank && !p.rank.toLowerCase().includes(rank)) return false;
    if (role && !p.role.toLowerCase().includes(role.replace(' / ', '/'))) return false;
    if (rgn  && p.region.toLowerCase() !== rgn) return false;
    if (avl === 'Online Now' && !p.online) return false;
    return true;
  });

  const el = document.getElementById('player-list');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = '<p style="font-size:14px;color:var(--text-muted);padding:32px 0;">No players match your filters.</p>';
    return;
  }

  el.innerHTML = list.map(p => {
    const gi     = (typeof p.seed === 'number') ? p.seed : PLAYERS_DATA.indexOf(p);
    const isSent = invited.has(p.tag);
    const safeTag = String(p.tag).replace(/"/g, '&quot;');
    return `
    <div class="player-row">
      <div class="pr-ava-wrap">
        <div class="pr-ava" style="background:${POOL_GRAD[gi % POOL_GRAD.length]}">${POOL_EMOJI[gi % POOL_EMOJI.length]}</div>
        <div class="pr-online${p.online ? ' on' : ''}"></div>
      </div>
      <div class="pr-names">
        <div class="pr-tag">${p.tag}</div>
        <div class="pr-pid">Player ID: ${p.pid}</div>
      </div>
      <div class="pr-rank">
        <span style="font-size:16px;">🏆</span>
        <span class="pr-rank-val">${p.rank}</span>
      </div>
      <div class="pr-col">
        <span class="pr-col-label">Role</span>
        <span class="pr-col-val">${p.role}</span>
      </div>
      <div class="pr-col">
        <span class="pr-col-label">Region</span>
        <span class="pr-col-val">${p.region}</span>
      </div>
      <button class="btn-invite-sm${isSent ? ' sent' : ''}"
              data-username="${safeTag}"
              onclick="${isSent ? '' : 'doInvite(this.dataset.username, this)'}"
              ${isSent ? 'disabled' : ''}>
        ${isSent ? 'Sent ✓' : 'Send Invite'}
      </button>
    </div>`;
  }).join('');
}

function doInvite(tag, btn) {
  const workflow = getWorkflowContext();
  if (workflow && window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.sendInvite === 'function') {
    const roleChoice = document.getElementById('flt-role')?.value || 'Player';
    const roleOffered = roleChoice && roleChoice !== 'By Role' ? roleChoice : 'Player';
    const result = window.NexusTeamWorkflow.sendInvite({
      compId: workflow.comp.id,
      teamId: workflow.team.id,
      toUsername: tag,
      roleOffered: roleOffered
    });

    if (!result.ok) {
      toast(result.error || 'Unable to send invitation right now.', 'err');
      return;
    }

    toast('Invitation sent to ' + tag + '!');
    renderPlayers();
    renderInvitations();
    return;
  }

  invited.add(tag);
  if (btn) {
    btn.textContent = 'Sent ✓';
    btn.classList.add('sent');
    btn.disabled = true;
  }
  toast('Invitation sent!');
}

/* ================================================================
   6. INVITATIONS SENT — render & revoke
   ================================================================ */
const INV_STATUSES = ['pending','accepted','declined','pending','pending','accepted'];

function renderInvitations() {
  const el    = document.getElementById('inv-list');
  const empty = document.getElementById('inv-empty');
  if (!el) return;

  const workflow = getWorkflowContext();
  if (workflow && window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.getInvites === 'function') {
    const invites = window.NexusTeamWorkflow.getInvites(workflow.comp.id, workflow.team.id);
    if (!invites.length) {
      el.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    el.innerHTML = invites.map((invite, index) => {
      const gi = index;
      const stat = invite.status || 'pending';
      const sc = { pending:'sp-pending', accepted:'sp-accepted', declined:'sp-declined' }[stat] || 'sp-pending';
      return `
      <div class="inv-row" id="inv-${invite.id}">
        <div class="inv-ava" style="background:${POOL_GRAD[gi % POOL_GRAD.length]}">${POOL_EMOJI[gi % POOL_EMOJI.length]}</div>
        <div class="inv-info">
          <div class="inv-name">${invite.toUsername}</div>
          <div class="inv-role">${invite.roleOffered || 'Player'}</div>
        </div>
        <span class="status-pill ${sc}">${stat}</span>
        <span class="inv-time">${formatTime(invite.sentAt)}</span>
        ${stat === 'pending'
          ? `<button class="btn-revoke" onclick="revokeInvite('${invite.id}')">Revoke</button>`
          : ''}
      </div>`;
    }).join('');
    return;
  }

  const list = PLAYERS_DATA.filter(p => invited.has(p.tag));

  if (!list.length) {
    el.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  el.innerHTML = list.map((p) => {
    const gi   = PLAYERS_DATA.indexOf(p);
    const stat = INV_STATUSES[gi % INV_STATUSES.length];
    const sc   = { pending:'sp-pending', accepted:'sp-accepted', declined:'sp-declined' }[stat];
    const time = ['2h ago','5h ago','1d ago','3h ago','30m ago','12h ago'][gi % 6];
    return `
    <div class="inv-row" id="inv-${p.tag.replace(/[^a-z0-9]/gi,'_')}">
      <div class="inv-ava" style="background:${POOL_GRAD[gi % POOL_GRAD.length]}">${POOL_EMOJI[gi % POOL_EMOJI.length]}</div>
      <div class="inv-info">
        <div class="inv-name">${p.tag}</div>
        <div class="inv-role">${p.role}</div>
      </div>
      <span class="status-pill ${sc}">${stat}</span>
      <span class="inv-time">${time}</span>
      ${stat === 'pending'
        ? `<button class="btn-revoke" onclick="revokeInvite('${p.tag}')">Revoke</button>`
        : ''}
    </div>`;
  }).join('');
}

function revokeInvite(inviteRef) {
  const workflow = getWorkflowContext();
  if (workflow && window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.revokeInvite === 'function') {
    const result = window.NexusTeamWorkflow.revokeInvite({
      compId: workflow.comp.id,
      teamId: workflow.team.id,
      inviteId: inviteRef
    });

    if (!result.ok) {
      toast(result.error || 'Unable to revoke invite.', 'err');
      return;
    }

    toast('Invitation revoked', 'err');
    renderInvitations();
    renderPlayers();
    return;
  }

  invited.delete(inviteRef);
  renderInvitations();
  renderPlayers();
  toast('Invitation revoked', 'err');
}

/* ================================================================
   7. JOIN REQUESTS — accept persists member to localStorage
   ================================================================ */
let jrCount = 2;

function renderJoinRequests() {
  const listEl = document.getElementById('jr-list');
  const emptyEl = document.getElementById('jr-empty');
  if (!listEl) return;

  const workflow = getWorkflowContext();
  if (
    workflow &&
    window.NexusTeamWorkflow &&
    typeof window.NexusTeamWorkflow.getJoinRequests === 'function'
  ) {
    const pending = window.NexusTeamWorkflow
      .getJoinRequests(workflow.comp.id, workflow.team.id)
      .filter(req => req.status === 'pending');

    updateJrBadge(pending.length, true);

    if (!pending.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    listEl.innerHTML = pending.map((req, index) => {
      const gi = index;
      const displayName = req.displayName || req.username;
      return `
      <div class="jr-card" id="${req.id}">
        <div class="jr-ava-wrap">
          <div class="jr-ava" style="background:${POOL_GRAD[gi % POOL_GRAD.length]}">${POOL_EMOJI[gi % POOL_EMOJI.length]}</div>
          <span class="jr-lvl">PENDING</span>
        </div>
        <div class="jr-body">
          <div class="jr-top">
            <span class="jr-name">${displayName}</span>
            <span class="jr-rank-pill">Join Request</span>
            <span class="jr-time">${formatTime(req.requestedAt)}</span>
          </div>
          <div class="jr-meta">
            <div class="jr-meta-item">Username: ${req.username}</div>
          </div>
          <div class="jr-quote">${req.message ? ('"' + req.message + '"') : 'No message provided.'}</div>
        </div>
        <div class="jr-actions">
          <button class="btn-decline" onclick="declineReq('${req.id}')">Decline</button>
          <button class="btn-accept" onclick="acceptReq('${req.id}')">Accept</button>
        </div>
      </div>`;
    }).join('');
    return;
  }

  const count = listEl.children.length;
  updateJrBadge(count, true);
  if (emptyEl) emptyEl.style.display = count ? 'none' : 'block';
}

function handleJoinRequestDecision(requestId, action) {
  const workflow = getWorkflowContext();
  if (
    !workflow ||
    !window.NexusTeamWorkflow ||
    typeof window.NexusTeamWorkflow.decideJoinRequest !== 'function'
  ) {
    return false;
  }

  const result = window.NexusTeamWorkflow.decideJoinRequest({
    compId: workflow.comp.id,
    teamId: workflow.team.id,
    requestId: requestId,
    action: action
  });

  if (!result.ok) {
    toast(result.error || 'Unable to update request.', 'err');
    return true;
  }

  if (action === 'accepted') {
    toast('Player accepted to team!');
  } else {
    toast('Request declined', 'err');
  }

  renderJoinRequests();
  renderRoster();
  renderPlayers();
  return true;
}

function declineReq(id) {
  if (handleJoinRequestDecision(id, 'declined')) return;
  animateRemove(id, () => { updateJrBadge(-1); toast('Request declined', 'err'); });
}

function acceptReq(id) {
  if (handleJoinRequestDecision(id, 'accepted')) return;

  const el = document.getElementById(id);
  if (!el) return;

  /* Read the displayed player name from the card */
  const nameEl   = el.querySelector('.jr-name');
  const username = nameEl ? nameEl.textContent.trim() : ('player_' + id);

  /* Persist accepted player into team.members[] in localStorage */
  try {
    const { compId, teamId } = getUrlParams();
    if (window.NexusData && compId && teamId) {
      const all  = window.NexusData.loadCompetitions();
      const comp = all.find(c => c.id === compId);
      if (comp) {
        const team = Array.isArray(comp.teams) && comp.teams.find(t => t.id === teamId);
        if (team) {
          if (!Array.isArray(team.members)) team.members = [];
          const alreadyIn = team.members.some(m => (m.username || '').toLowerCase() === username.toLowerCase());
          if (!alreadyIn) {
            team.members.push({
              username:    username,
              displayName: username,
              role:        'member',
              joinedAt:    new Date().toISOString()
            });
            team.players = team.members.length;
            window.NexusData.updateCompetition(comp);
          }
        }
      }
    }
  } catch (_) {}

  /* Animate card out, then refresh roster */
  el.style.transition  = 'all 0.3s';
  el.style.borderColor = '#c6ff33';
  el.style.background  = 'rgba(198,255,51,0.04)';
  setTimeout(() => animateRemove(id, () => {
    updateJrBadge(-1);
    toast('Player accepted to team!');
    renderRoster();
  }), 400);
}

function animateRemove(id, cb) {
  const el = document.getElementById(id);
  if (!el) return;
  const h = el.offsetHeight;
  el.style.transition   = 'all 0.3s';
  el.style.overflow     = 'hidden';
  el.style.opacity      = '0';
  el.style.height       = h + 'px';
  requestAnimationFrame(() => {
    el.style.height       = '0';
    el.style.padding      = '0';
    el.style.marginBottom = '0';
  });
  setTimeout(() => { el.remove(); cb(); }, 320);
}

function updateJrBadge(delta, absolute = false) {
  if (absolute) jrCount = Math.max(0, Number(delta) || 0);
  else jrCount = Math.max(0, jrCount + delta);
  const badge = document.getElementById('jr-badge');
  if (badge) { badge.textContent = jrCount; badge.style.display = jrCount ? 'inline-flex' : 'none'; }
  const list  = document.getElementById('jr-list');
  const empty = document.getElementById('jr-empty');
  if (empty) empty.style.display = (list && list.children.length === 0) ? 'block' : 'none';
}

/* ================================================================
   8. INVITE PLAYER MODAL
   ================================================================ */
function openInviteModal() {
  const modal = document.getElementById('invite-modal');
  if (modal) { modal.classList.add('open'); document.getElementById('modal-gamertag')?.focus(); }
}

function closeInviteModal() {
  const modal = document.getElementById('invite-modal');
  if (modal) modal.classList.remove('open');
  setVal('modal-gamertag', '');
  setVal('modal-role',     '');
  setVal('modal-message',  '');
}

function sendModalInvite() {
  const tag = document.getElementById('modal-gamertag')?.value.trim();
  if (!tag) { document.getElementById('modal-gamertag')?.focus(); return; }

  const modalRole = document.getElementById('modal-role')?.value || 'Player';
  const modalMessage = document.getElementById('modal-message')?.value.trim() || '';
  const workflow = getWorkflowContext();

  if (workflow && window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.sendInvite === 'function') {
    const result = window.NexusTeamWorkflow.sendInvite({
      compId: workflow.comp.id,
      teamId: workflow.team.id,
      toUsername: tag,
      roleOffered: modalRole || 'Player',
      message: modalMessage
    });

    if (!result.ok) {
      toast(result.error || 'Unable to send invitation.', 'err');
      return;
    }

    closeInviteModal();
    toast('Invitation sent to ' + tag + '!');
    renderPlayers();
    renderInvitations();
    return;
  }

  closeInviteModal();
  invited.add(tag);
  toast('Invitation sent to ' + tag + '!');
}

/* ================================================================
   9. COPY TEAM LINK
   ================================================================ */
function copyLink() {
  const { compId, teamId } = getCompTeamIds();
  const base = window.location.href.split('?')[0].replace('team-lead-dashboard.html', 'join-teams.html');
  const params = new URLSearchParams();
  if (compId) params.set('id', compId);
  if (teamId) params.set('teamId', teamId);
  const url = params.toString() ? base + '?' + params.toString() : base;
  navigator.clipboard?.writeText(url).catch(() => {});
  toast('Team link copied to clipboard!');
}

/* ================================================================
   10. SETTINGS
   ================================================================ */
function syncToggle(input) { /* CSS :checked handles visual */ }

function saveSettings() {
  const name = document.getElementById('set-team-name')?.value.trim();
  const game = document.getElementById('set-game')?.value;

  if (name) setTxt('hero-name', name.toUpperCase());
  if (game) setTxt('hero-game', game);

  const { compId, teamId } = getCompTeamIds();
  if (compId && window.NexusData) {
    const all  = window.NexusData.loadCompetitions();
    const comp = all.find(c => c.id === compId);
    if (comp && Array.isArray(comp.teams) && teamId) {
      const team = comp.teams.find(t => t.id === teamId);
      if (team) {
        if (name) team.name = name;
        team.rosterLimit = parseInt(document.getElementById('set-roster-size')?.value) || team.rosterLimit;
        window.NexusData.updateCompetition(comp);
      }
    }
  }

  toast('Settings saved!');
}

/* ================================================================
   11. FILTER WIRING — Add Players tab
   ================================================================ */
function wireFilters() {
  ['ap-search','flt-rank','flt-role','flt-region','flt-avail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', renderPlayers); el.addEventListener('change', renderPlayers); }
  });
}

/* ================================================================
   12. MODAL CLOSE ON OVERLAY CLICK / ESCAPE
   ================================================================ */
function wireModal() {
  const modal = document.getElementById('invite-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeInviteModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInviteModal(); });
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadTeamData();
  renderRoster();
  renderPlayers();
  renderJoinRequests();
  renderInvitations();
  wireFilters();
  wireModal();

  // Lock team-lead actions if competition has ended
  const activeComp = getActiveComp();
  if (activeComp && window.NexusData && window.NexusData.enforceNotEnded) {
    window.NexusData.enforceNotEnded(activeComp,
      '.btn-invite-sm,.btn-accept,.btn-decline,.btn-revoke,' +
      '#btn-open-invite,#btn-save-settings,.save-settings-btn,' +
      'button[onclick*="openInviteModal"],button[onclick*="sendModalInvite"]'
    );
  }
});

/* ── Expose to inline onclick handlers ── */
window.switchTab        = switchTab;
window.openInviteModal  = openInviteModal;
window.closeInviteModal = closeInviteModal;
window.sendModalInvite  = sendModalInvite;
window.copyLink         = copyLink;
window.doInvite         = doInvite;
window.revokeInvite     = revokeInvite;
window.declineReq       = declineReq;
window.acceptReq        = acceptReq;
window.updateJrBadge    = updateJrBadge;
window.syncToggle       = syncToggle;
window.saveSettings     = saveSettings;
window.toast            = toast;
