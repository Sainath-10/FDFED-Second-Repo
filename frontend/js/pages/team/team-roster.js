initTeamSidebar('activity', 'roster', '../../');
initFooter('../../');

let pageContext = null;

function refreshHeader() {
  if (!pageContext || !pageContext.team) return;

  const title = document.querySelector('.page-title');
  const subtitle = document.querySelector('.page-subtitle');
  if (title) title.textContent = pageContext.team.name;
  if (subtitle) {
    const captain = pageContext.team.leader || pageContext.team.createdBy || 'Captain';
    subtitle.textContent = (pageContext.comp.game || 'Game') + ' - Captain: ' + captain;
  }
}

function renderRoster() {
  if (!pageContext || !window.NexusTeamWorkflow) return;

  const members = window.NexusTeamWorkflow.getTeamRoster(pageContext.comp.id, pageContext.team.id);
  const canManage = pageContext.session && (pageContext.session.username || '').toLowerCase() === (pageContext.team.createdBy || '').toLowerCase();
  const grid = document.querySelector('.roster-grid');
  const summary = document.querySelector('.roster-stats-summary');
  const addBtn = document.querySelector('.header-btn-primary');

  if (summary) {
    const maxPlayers = pageContext.comp.maxPlayersPerTeam || 5;
    summary.innerHTML = members.length + ' / ' + maxPlayers + ' players - <span class="summary-accent">' + Math.max(0, maxPlayers - members.length) + ' slot' + (Math.max(0, maxPlayers - members.length) !== 1 ? 's' : '') + ' open</span>';
  }

  const isEnded = !!(pageContext.comp && (pageContext.comp.ended || pageContext.comp.status === 'completed'));

  // Only captain sees the Add Players header button, and only if slots are open and comp is active
  if (addBtn) {
    const maxPlayers = pageContext.comp.maxPlayersPerTeam || 5;
    const hasRoom = members.length < maxPlayers;

    if (canManage && hasRoom && !isEnded) {
      addBtn.style.display = '';
      addBtn.href = 'add-players.html?compId=' + encodeURIComponent(pageContext.comp.id) + '&teamId=' + encodeURIComponent(pageContext.team.id);
    } else {
      addBtn.style.display = 'none';
    }
  }

  if (!grid) return;

  const cards = members.map(member => {
    const username = member.username || 'user';
    const initial = username.charAt(0).toUpperCase();
    const isCaptain = (member.role || '').toLowerCase() === 'captain' || (username.toLowerCase() === (pageContext.team.createdBy || '').toLowerCase());

    if (isCaptain) {
      return `
        <div class="player-card player-card-captain">
          <div class="player-avatar-placeholder">${initial}</div>
          <div class="p-name">${member.displayName || username}</div>
          <div class="p-role">Captain</div>
          <div class="p-stats">Username: ${username}</div>
          <div class="captain-pill-wrapper"><span class="captain-pill">Captain</span></div>
        </div>
      `;
    }

    return `
      <div class="player-card">
        <div class="player-avatar-placeholder">${initial}</div>
        <div class="p-name">${member.displayName || username}</div>
        <div class="p-role">Player</div>
        <div class="p-stats">Username: ${username}</div>
        <div class="captain-pill-wrapper">
          ${canManage && !isEnded ? `<button class="btn-table-danger btn-remove-alt" onclick="removePlayer('${username}')">Remove</button>` : ''}
        </div>
      </div>
    `;
  });

  // Only captain sees empty (add) slots — and only when comp is still active
  if (canManage && !isEnded) {
    const maxPlayers = pageContext.comp.maxPlayersPerTeam || 5;
    const openSlots = Math.max(0, maxPlayers - members.length);
    for (let i = 0; i < openSlots; i += 1) {
      cards.push(`
        <div class="player-card player-card-empty" onclick="location.href='add-players.html?compId=${encodeURIComponent(pageContext.comp.id)}&teamId=${encodeURIComponent(pageContext.team.id)}'">
          <div class="empty-slot-icon">+</div>
          <div class="p-name player-name-placeholder">Empty Slot</div>
          <div class="p-role player-role-placeholder">Click to add player</div>
          <div class="empty-slot-btn-wrapper"><a href="add-players.html?compId=${encodeURIComponent(pageContext.comp.id)}&teamId=${encodeURIComponent(pageContext.team.id)}" class="btn-table-secondary btn-invite-mini">Invite Player</a></div>
        </div>
      `);
    }
  }

  grid.innerHTML = cards.join('');
}

function renderCompetitionCard() {
  if (!pageContext) return;
  const list = document.querySelector('.comp-list-stack');
  if (!list) return;

  list.innerHTML = `
    <div class="comp-item-mini">
      <img src="../../assets/b890c61489a080992ad7e99adabb1145e6d59606.png" class="comp-img-mini" alt="Competition">
      <div class="comp-info-mini"><div class="comp-name-mini">${pageContext.comp.name}</div><div class="comp-meta-mini">${pageContext.comp.game}</div></div>
      <span class="status-pill ongoing">${(pageContext.comp.status || 'ongoing').toUpperCase()}</span>
    </div>
  `;
}

function removePlayer(username) {
  if (!pageContext || !window.NexusTeamWorkflow) return;
  if (!confirm('Remove ' + username + ' from the team?')) return;

  const result = window.NexusTeamWorkflow.removePlayer({
    compId: pageContext.comp.id,
    teamId: pageContext.team.id,
    username: username
  });

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Unable to remove player.', 'error');
    return;
  }

  if (typeof showToast === 'function') {
    showToast(username + ' removed from ' + pageContext.team.name + '.', 'error');
  }

  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  renderRoster();
}

document.addEventListener('DOMContentLoaded', function () {
  if (!window.NexusTeamWorkflow) return;

  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  if (!pageContext || !pageContext.comp || !pageContext.team) {
    if (typeof showToast === 'function') showToast('Team context not found.', 'error');
    return;
  }

  window.NexusTeamWorkflow.appendContextToTeamTabs(pageContext.context);
  window.NexusTeamWorkflow.appendContextToTeamLinks(pageContext.context);
  refreshHeader();
  applyPermissions();
  window.NexusTeamWorkflow.refreshTeamManagementUI(pageContext.comp.id, pageContext.team.id);
  renderRoster();
  renderCompetitionCard();

  // Lock everything if competition has ended
  const comp = pageContext.comp;
  const isEnded = !!(comp && (comp.ended || comp.status === 'completed'));
  if (isEnded) {
    lockEndedRosterUI();
  }
});

function applyPermissions() {
  if (!pageContext) return;
  const canManage = pageContext.session && (pageContext.session.username || '').toLowerCase() === (pageContext.team.createdBy || '').toLowerCase();

  if (!canManage) {
    // Hide administrative tabs
    const tabs = document.querySelectorAll('.team-tab');
    tabs.forEach(tab => {
      const text = tab.textContent.toLowerCase();
      if (!text.includes('roster')) {
        tab.style.display = 'none';
      }
    });

    // Hide sidebar action block
    const sidebarActions = document.querySelector('.sidebar-actions-stack');
    if (sidebarActions) {
      sidebarActions.style.display = 'none';
    }
  }
}

function lockEndedRosterUI() {
  // Hide +ADD NEW PLAYER button
  const addBtn = document.querySelector('.header-btn-primary');
  if (addBtn) addBtn.style.display = 'none';

  // Hide empty slot cards (click to add player)
  document.querySelectorAll('.player-card-empty').forEach(el => el.remove());

  // Disable / hide Remove buttons on roster cards
  document.querySelectorAll('.btn-remove-alt').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.35';
    el.style.pointerEvents = 'none';
    el.title = 'Competition has ended';
  });

  // Hide all tabs except Roster
  document.querySelectorAll('.team-tab').forEach(tab => {
    const text = (tab.textContent || '').trim().toLowerCase();
    if (!text.includes('roster')) {
      tab.style.display = 'none';
    }
  });

  // Show ended banner
  if (!document.getElementById('_ended_banner_roster_')) {
    const banner = document.createElement('div');
    banner.id = '_ended_banner_roster_';
    banner.style.cssText = 'background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.4);color:#fb923c;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;text-align:center;margin:12px 0 16px;letter-spacing:0.5px;';
    banner.textContent = '\uD83C\uDFC1 Competition has ended \u2014 team roster is now view-only.';
    const grid = document.querySelector('.roster-grid');
    if (grid && grid.parentNode) grid.parentNode.insertBefore(banner, grid);
  }
}

window.removePlayer = removePlayer;
window.lockEndedRosterUI = lockEndedRosterUI;
