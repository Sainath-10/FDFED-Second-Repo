initTeamSidebar('activity', 'invitations', '../../');
initFooter('../../');

let pageContext = null;

function refreshHeader() {
  if (!pageContext || !pageContext.team) return;
  const title = document.querySelector('.page-title');
  const subtitle = document.querySelector('.page-subtitle');
  if (title) title.textContent = pageContext.team.name;
  if (subtitle) subtitle.textContent = 'Track invitations sent to players.';
}

function formatSentTime(value) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString();
}

function renderInvitations() {
  if (!pageContext || !window.NexusTeamWorkflow) return;

  const container = document.querySelector('.invites-stack');
  if (!container) return;

  const invites = window.NexusTeamWorkflow.getInvites(pageContext.comp.id, pageContext.team.id);
  const rows = invites.map(invite => {
    const username = invite.toUsername || 'user';
    const initial = username.charAt(0).toUpperCase();
    const statusClass = invite.status === 'accepted' ? 'approved' : (invite.status === 'declined' ? 'rejected' : 'pending');
    const statusLabel = invite.status ? invite.status.toUpperCase() : 'PENDING';
    const revokeButton = invite.status === 'pending'
      ? `<button class="btn-table-danger btn-revoke-mini" onclick="revokeInvite('${invite.id}', '${username}')">Revoke</button>`
      : `<span class="status-text-${invite.status === 'accepted' ? 'green' : 'red'}">${invite.status === 'accepted' ? 'Joined team' : 'Invitation closed'}</span>`;

    return `
      <div class="invite-row" data-invite-id="${invite.id}">
        <div class="invite-avatar-sm">${initial}</div>
        <div class="invite-info-wrapper">
          <div class="invite-name">${username}</div>
          <div class="invite-meta">Invited for: ${invite.roleOffered || 'Player'} slot - Sent ${formatSentTime(invite.sentAt)}</div>
        </div>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
        ${revokeButton}
      </div>
    `;
  }).join('');

  container.innerHTML = rows + '<div class="invites-footer-actions"><a href="add-players.html" class="btn-primary invite-more-btn">+ Invite More Players</a></div>';

  window.NexusTeamWorkflow.appendContextToTeamTabs(pageContext.context);
  window.NexusTeamWorkflow.appendContextToTeamLinks(pageContext.context);
  refreshHeader();
  window.NexusTeamWorkflow.refreshTeamManagementUI(pageContext.comp.id, pageContext.team.id);
  
  const inviteMore = container.querySelector('.invite-more-btn');
  if (inviteMore) {
    inviteMore.href = 'add-players.html?compId=' + encodeURIComponent(pageContext.comp.id) + '&teamId=' + encodeURIComponent(pageContext.team.id);
  }
}

function revokeInvite(inviteId, username) {
  if (!pageContext || !window.NexusTeamWorkflow) return;
  if (!confirm('Revoke invitation to ' + username + '?')) return;

  const result = window.NexusTeamWorkflow.revokeInvite({
    compId: pageContext.comp.id,
    teamId: pageContext.team.id,
    inviteId: inviteId
  });

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Failed to revoke invite.', 'error');
    return;
  }

  if (typeof showToast === 'function') {
    showToast('Invitation to ' + username + ' revoked.', 'error');
  }

  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  renderInvitations();
}

document.addEventListener('DOMContentLoaded', function () {
  if (!window.NexusTeamWorkflow) return;
  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  if (!pageContext || !pageContext.comp || !pageContext.team) {
    if (typeof showToast === 'function') showToast('Team context not found.', 'error');
    return;
  }

  refreshHeader();
  renderInvitations();
});

window.revokeInvite = revokeInvite;
