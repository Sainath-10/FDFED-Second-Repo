initTeamSidebar('activity', 'add-players', '../../');
initFooter('../../');

let pageContext = null;

function refreshHeader() {
  if (!pageContext || !pageContext.team) return;
  const title = document.querySelector('.page-title');
  const subtitle = document.querySelector('.page-subtitle');
  if (title) title.textContent = pageContext.team.name;
  if (subtitle) subtitle.textContent = 'Invite players to join your roster.';
}

function refreshSidebarCounts() {
  if (!pageContext || !window.NexusTeamWorkflow) return;
  window.NexusTeamWorkflow.refreshTeamManagementUI(pageContext.comp.id, pageContext.team.id);
}

function renderPlayerResults() {
  if (!pageContext || !window.NexusTeamWorkflow) return;

  const wrap = document.getElementById('player-results');
  if (!wrap) return;

  const players = window.NexusTeamWorkflow.getAvailablePlayers(pageContext.comp.id, pageContext.team.id);
  if (players.length === 0) {
    wrap.innerHTML = '<div class="role-user-item"><div class="role-user-info"><div class="role-user-name">No available players found.</div></div></div>';
    return;
  }

  wrap.innerHTML = players.map(player => {
    const initial = (player.username || 'U').charAt(0).toUpperCase();
    return `
      <div class="role-user-item" data-name="${player.username}">
        <div class="player-avatar-sm">${initial}</div>
        <div class="role-user-info">
          <div class="role-user-name">${player.username}</div>
          <div class="player-meta-info">Registered user</div>
        </div>
        <span class="status-pill approved status-pill-sm">Available</span>
        <button class="btn-table-primary" onclick="sendInvite('${player.username}')">Send Invite</button>
      </div>
    `;
  }).join('');
}

function filterPlayers(q) {
  const items = document.querySelectorAll('#player-results .role-user-item');
  items.forEach(item => {
    const name = (item.dataset.name || '').toLowerCase();
    item.style.display = name.includes((q || '').toLowerCase()) ? '' : 'none';
  });
}

function sendInvite(name) {
  if (!pageContext || !window.NexusTeamWorkflow) return;

  const roleOffered = 'Player';

  const result = window.NexusTeamWorkflow.sendInvite({
    compId: pageContext.comp.id,
    teamId: pageContext.team.id,
    toUsername: name,
    roleOffered: roleOffered
  });

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Failed to send invite.', 'error');
    return;
  }

  if (typeof showToast === 'function') {
    showToast('Invitation sent to ' + name + '.');
  }

  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  renderPlayerResults();
  refreshSidebarCounts();
}

function directInvite() {
  const input = document.getElementById('direct-username');
  if (!input) return;

  const username = input.value.trim();
  if (!username) {
    if (typeof showToast === 'function') showToast('Please enter a username.', 'error');
    return;
  }

  sendInvite(username);
  input.value = '';
}

document.addEventListener('DOMContentLoaded', function () {
  if (!window.NexusTeamWorkflow || typeof window.NexusTeamWorkflow.resolveTeamContext !== 'function') {
    return;
  }

  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  if (!pageContext || !pageContext.comp || !pageContext.team) {
    if (typeof showToast === 'function') showToast('Team context not found.', 'error');
    return;
  }

  window.NexusTeamWorkflow.appendContextToTeamTabs(pageContext.context);
  window.NexusTeamWorkflow.appendContextToTeamLinks(pageContext.context);
  refreshHeader();

  // If competition has ended, block this page entirely
  const comp = pageContext.comp;
  const isEnded = !!(comp && (comp.ended || comp.status === 'completed'));
  if (isEnded) {
    const main = document.querySelector('.add-players-main') || document.querySelector('main') || document.body;
    // Show ended banner at top
    const banner = document.createElement('div');
    banner.style.cssText = 'background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.4);color:#fb923c;padding:14px 20px;border-radius:10px;font-size:14px;font-weight:700;text-align:center;margin:24px 0;letter-spacing:0.5px;';
    banner.textContent = '\uD83C\uDFC1 Competition has ended \u2014 inviting new players is no longer possible.';
    const firstSection = document.querySelector('.search-section') || document.querySelector('.panel-card');
    if (firstSection && firstSection.parentNode) firstSection.parentNode.insertBefore(banner, firstSection);
    // Disable all invite buttons and inputs
    document.querySelectorAll('button,input').forEach(el => {
      el.disabled = true; el.style.opacity = '0.4'; el.style.pointerEvents = 'none';
    });
    renderPlayerResults(); // still render list so they can see who was invited
    refreshSidebarCounts();
    return;
  }

  renderPlayerResults();
  refreshSidebarCounts();
});

window.filterPlayers = filterPlayers;
window.sendInvite = sendInvite;
window.directInvite = directInvite;
