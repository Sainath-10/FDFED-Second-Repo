initTeamSidebar('activity', 'join-requests', '../../');
initFooter('../../');

let pageContext = null;

function refreshHeader() {
  if (!pageContext || !pageContext.team) return;
  const title = document.querySelector('.page-title');
  const subtitle = document.querySelector('.page-subtitle');
  if (title) title.textContent = pageContext.team.name;
  if (subtitle) subtitle.textContent = 'Players who have requested to join your team';
}

function renderRequests() {
  if (!pageContext || !window.NexusTeamWorkflow) return;

  const list = document.getElementById('requests-list');
  if (!list) return;

  const pending = window.NexusTeamWorkflow
    .getJoinRequests(pageContext.comp.id, pageContext.team.id)
    .filter(req => req.status === 'pending');

  const badge = document.querySelector('.team-tab.active .notif-badge-sm');
  if (badge) badge.textContent = String(pending.length);

  if (pending.length === 0) {
    list.innerHTML = `
      <div id="no-requests" class="empty-state-card" style="display:block;">
        <div class="empty-emoji">OK</div>
        <div class="empty-title">All caught up!</div>
        <div class="empty-subtitle">No pending join requests.</div>
      </div>
    `;
    window.NexusTeamWorkflow.appendContextToTeamTabs(pageContext.context);
    window.NexusTeamWorkflow.appendContextToTeamLinks(pageContext.context);
    return;
  }

  list.innerHTML = pending.map(req => {
    const initial = (req.displayName || req.username || 'U').charAt(0).toUpperCase();
    const when = req.requestedAt ? new Date(req.requestedAt).toLocaleString() : 'just now';
    return `
      <div class="request-card request-card-alt" id="${req.id}">
        <div class="request-avatar-md">${initial}</div>
        <div class="request-info-wrapper">
          <div class="request-name">${req.displayName || req.username}</div>
          <div class="request-meta">Username: ${req.username}</div>
          <div class="request-time">Requested: ${when}</div>
        </div>
        <div class="request-slot-info">${req.message ? ('Message: "' + req.message + '"') : 'No message provided'}</div>
        <div class="request-actions-row">
          <button class="btn-notif-accept" onclick="handleRequest('${req.id}','${req.username}','accepted')">Accept</button>
          <button class="btn-notif-reject" onclick="handleRequest('${req.id}','${req.username}','declined')">Decline</button>
        </div>
      </div>
    `;
  }).join('');

  window.NexusTeamWorkflow.appendContextToTeamTabs(pageContext.context);
  window.NexusTeamWorkflow.appendContextToTeamLinks(pageContext.context);
  window.NexusTeamWorkflow.refreshTeamManagementUI(pageContext.comp.id, pageContext.team.id);
}

function handleRequest(requestId, username, action) {
  if (!pageContext || !window.NexusTeamWorkflow) return;

  const result = window.NexusTeamWorkflow.decideJoinRequest({
    compId: pageContext.comp.id,
    teamId: pageContext.team.id,
    requestId: requestId,
    action: action
  });

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Failed to update request.', 'error');
    return;
  }

  if (typeof showToast === 'function') {
    if (action === 'accepted') {
      showToast(username + ' accepted to ' + pageContext.team.name + '!');
    } else {
      showToast(username + '\'s request declined.', 'error');
    }
  }

  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  renderRequests();
}

document.addEventListener('DOMContentLoaded', function () {
  if (!window.NexusTeamWorkflow) return;
  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  if (!pageContext || !pageContext.comp || !pageContext.team) {
    if (typeof showToast === 'function') showToast('Team context not found.', 'error');
    return;
  }

  refreshHeader();
  renderRequests();
});

window.handleRequest = handleRequest;
