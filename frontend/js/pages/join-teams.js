let currentComp = null;

initSidebar('competitions', '../');
initFooter('../');

function readSession() {
  try {
    const raw = localStorage.getItem('nexus.auth.session');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function getCompId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || params.get('compId') || null;
}

function getPreferredTeamId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('teamId');
}

function initDynamicHeader(comp) {
  const titleEl = document.getElementById('comp-context-name');
  if (titleEl) {
    titleEl.textContent = comp.name + ' - ' + comp.game;
  }

  const backBtn = document.querySelector('.back-btn');
  if (backBtn && comp.id) {
    backBtn.href = 'comp-info.html?id=' + encodeURIComponent(comp.id);
  }
}

function initRegistrationLogic(comp) {
  const createBtn = document.querySelector('.create-team-cta');
  const session = readSession();

  if (!createBtn) return;

  if (!session) {
    createBtn.href = 'login.html';
    return;
  }

  const myTeam = (window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.findUserTeamInCompetition === 'function')
    ? window.NexusTeamWorkflow.findUserTeamInCompetition(comp.id, session.username)
    : null;

  if (myTeam && myTeam.context) {
    createBtn.href = 'team/team-roster.html?compId=' + encodeURIComponent(myTeam.context.compId) + '&teamId=' + encodeURIComponent(myTeam.context.teamId);
    createBtn.innerHTML = 'View My Team';
    return;
  }

  createBtn.href = 'create-team.html?id=' + encodeURIComponent(comp.id);
}

function renderPendingRequests(comp) {
  const section = document.querySelector('.pending-requests-section');
  const list = section ? section.querySelector('.pending-list') : null;
  const badge = section ? section.querySelector('.pending-badge') : null;
  const session = readSession();

  if (!section || !list || !badge || !session) {
    if (section) section.style.display = 'none';
    return;
  }

  const mine = [];
  (comp.teams || []).forEach(team => {
    (team.joinRequests || []).forEach(req => {
      if ((req.username || '').toLowerCase() === (session.username || '').toLowerCase() && req.status === 'pending') {
        mine.push({ teamName: team.name, teamAvatar: team.avatar, request: req });
      }
    });
  });

  badge.textContent = String(mine.length);
  if (mine.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  list.innerHTML = mine.map(entry => {
    const when = entry.request.requestedAt ? new Date(entry.request.requestedAt).toLocaleString() : 'just now';
    return `
      <div class="pending-card">
        <div class="pending-content">
          <div class="team-icon">${entry.teamAvatar || 'TEAM'}</div>
          <div class="pending-info">
            <div class="pending-team-name">${entry.teamName}</div>
            <div class="pending-time">Sent ${when}</div>
          </div>
        </div>
        <button class="btn-cancel-request" disabled>Pending</button>
      </div>
    `;
  }).join('');
}

function initDynamicTeams(comp) {
  const list = document.getElementById('team-list');
  if (!list) return;

  const teamsToShow = (comp.teams || []).filter(team => team.status === 'approved');
  if (teamsToShow.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding: 60px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        <p style="color: #94A3B8; font-size: 16px;">No teams are currently registered in this tournament.</p>
        <p style="color: #64748B; font-size: 14px; margin-top: 8px;">Be the first to create one.</p>
      </div>`;
    return;
  }

  const session = readSession();
  const myKey = session ? (session.username || '').toLowerCase() : '';
  const myTeam = (window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.findUserTeamInCompetition === 'function' && session)
    ? window.NexusTeamWorkflow.findUserTeamInCompetition(comp.id, session.username)
    : null;
  const myTeamId = myTeam && myTeam.team ? myTeam.team.id : null;
  const maxPerTeam = comp.maxPlayersPerTeam || 5;

  list.innerHTML = teamsToShow.map(team => {
    const members = Array.isArray(team.members) ? team.members.length : (team.players || 0);
    const openSlots = Math.max(0, maxPerTeam - members);
    const isFull = members >= maxPerTeam;
    const isCaptain = myKey && (team.createdBy || '').toLowerCase() === myKey;
    const hasPending = myKey && (team.joinRequests || []).some(req => (req.username || '').toLowerCase() === myKey && req.status === 'pending');
    const userInAnotherTeam = !!myTeamId && team.id !== myTeamId;

    let joinBtn;
    if (isCaptain) {
      joinBtn = '<button class="btn-join" disabled>Your Team</button>';
    } else if (isFull) {
      joinBtn = '<button class="btn-join team-full-btn" disabled>Team Full</button>';
    } else if (userInAnotherTeam) {
      joinBtn = '<button class="btn-join" disabled>In Another Team</button>';
    } else if (hasPending) {
      joinBtn = '<button class="btn-join" disabled>Requested</button>';
    } else {
      joinBtn = `<button class="btn-join" onclick="handleJoin('${team.id}')">Request to Join</button>`;
    }

    const slotsLabel = isFull
      ? '<span class="slots-full">0 slots open</span>'
      : `<span>${openSlots} slot${openSlots !== 1 ? 's' : ''} open</span>`;

    return `
      <div class="request-card" data-name="${team.name}" data-team-id="${team.id}">
        <div class="request-card-left">
          <div class="team-icon">${team.avatar || 'TEAM'}</div>
          <div>
            <div class="team-name">${team.name}</div>
            <div class="team-info">
              ${members}/${maxPerTeam} Players filled
              ${slotsLabel}
            </div>
            <div class="wanted-roles">
              <span>Team Tag:</span>
              <span class="role-badge">${team.tag || 'N/A'}</span>
            </div>
          </div>
        </div>
        <div class="request-card-actions">
          <button class="btn-view-team" onclick="window.location.href='team/team-roster.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}'">View Team</button>
          ${joinBtn}
        </div>
      </div>`;
  }).join('');

  const preferredTeamId = getPreferredTeamId();
  if (preferredTeamId) {
    const card = document.querySelector(`.request-card[data-team-id="${preferredTeamId}"]`);

    if (card) {
      card.classList.add('request-card-highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function attemptDirectJoin(compId, teamId) {
  const session = readSession();
  if (!session || !teamId) return;
  if (!window.NexusTeamWorkflow || typeof window.NexusTeamWorkflow.directJoinTeam !== 'function') return;

  const result = window.NexusTeamWorkflow.directJoinTeam({
    compId: compId,
    teamId: teamId
  });

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Unable to join team.', 'error');
    return;
  }

  if (typeof showToast === 'function') {
    showToast('You have joined ' + (result.team && result.team.name ? result.team.name : 'the team') + '.');
  }

  const compKey = (result.competition && result.competition.id) || compId;
  const teamKey = (result.team && result.team.id) || teamId;
  const isCaptain = result.team && result.team.createdBy && result.team.createdBy.toLowerCase() === session.username.toLowerCase();
  const redirect = isCaptain
    ? 'team/team-roster.html?compId=' + encodeURIComponent(compKey) + '&teamId=' + encodeURIComponent(teamKey)
    : 'comp-participant.html?id=' + encodeURIComponent(compKey);

  window.location.href = redirect;
}

function filterTeams() {
  const input = document.getElementById('team-search');
  const query = input ? input.value.toLowerCase() : '';
  const cards = document.querySelectorAll('.request-card');

  cards.forEach(card => {
    const name = (card.dataset.name || '').toLowerCase();
    card.style.display = name.includes(query) ? 'flex' : 'none';
  });
}

function handleJoin(teamId) {
  const session = readSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  if (!currentComp || !window.NexusTeamWorkflow || typeof window.NexusTeamWorkflow.submitJoinRequest !== 'function') {
    if (typeof showToast === 'function') showToast('Unable to send request right now.', 'error');
    return;
  }

  const result = window.NexusTeamWorkflow.submitJoinRequest({
    compId: currentComp.id,
    teamId: teamId
  });

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Request failed.', 'error');
    return;
  }

  if (typeof showToast === 'function') {
    showToast('Join request sent successfully.');
  }

  currentComp = window.NexusData.getCompetitionById(currentComp.id);
  initDynamicTeams(currentComp);
  renderPendingRequests(currentComp);
  filterTeams();
}

document.addEventListener('DOMContentLoaded', () => {
  const id = getCompId();
  const teamId = getPreferredTeamId();
  if (id && window.NexusData) {
    currentComp = window.NexusData.getCompetitionById(id);
  }

  if (!currentComp) {
    filterTeams();
    if (typeof showToast === 'function') showToast('Competition context missing.', 'error');
    return;
  }

  const approvalStatus = (window.NexusData && typeof window.NexusData.getApprovalStatus === 'function')
    ? window.NexusData.getApprovalStatus(currentComp)
    : String(currentComp.approvalStatus || 'approved').toLowerCase();
  if (approvalStatus !== 'approved') {
    if (typeof showToast === 'function') showToast('Team registration is not open until competition approval.', 'error');
    window.location.href = 'competitions.html';
    return;
  }

  initDynamicHeader(currentComp);
  initRegistrationLogic(currentComp);
  initDynamicTeams(currentComp);
  renderPendingRequests(currentComp);
  filterTeams();

  // Lock join requests if competition has ended
  if (window.NexusData && window.NexusData.enforceNotEnded) {
    window.NexusData.enforceNotEnded(currentComp,
      '.btn-join,.create-team-cta,button[onclick*="handleJoin"],.btn-request'
    );
  }

  if (teamId) {
    attemptDirectJoin(currentComp.id, teamId);
  }
});

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    filterTeams();
  });
});

window.handleJoin = handleJoin;
window.filterTeams = filterTeams;
