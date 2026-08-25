initTeamSidebar('activity', 'add-players', '../../');
initFooter('../../');

let pageContext = null;

const inviteForm = document.getElementById('invite-form');
if (inviteForm) {
  inviteForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('invite-username');
    if (!input) return;
    
    const username = input.value.trim();
    if (!username) {
      if (typeof showToast === 'function') {
        showToast('Please enter a username!', 'error');
      }
      return;
    }
    
    if (!pageContext || !window.NexusTeamWorkflow) {
      if (typeof showToast === 'function') showToast('Team context not found.', 'error');
      return;
    }

    const roleSelect = inviteForm.querySelector('select');
    const roleValue = roleSelect ? roleSelect.value : '';
    const messageInput = inviteForm.querySelector('textarea');
    const message = messageInput ? messageInput.value.trim() : '';

    const result = window.NexusTeamWorkflow.sendInvite({
      compId: pageContext.comp.id,
      teamId: pageContext.team.id,
      toUsername: username,
      roleOffered: roleValue || 'Player',
      message: message
    });

    if (!result.ok) {
      if (typeof showToast === 'function') showToast(result.error || 'Failed to send invite.', 'error');
      return;
    }

    if (typeof showToast === 'function') showToast('Invitation sent to ' + username + ' successfully!');
    
    setTimeout(() => {
      location.href = 'team-roster.html?compId=' + encodeURIComponent(pageContext.comp.id) + '&teamId=' + encodeURIComponent(pageContext.team.id);
    }, 1400);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  if (!window.NexusTeamWorkflow) return;
  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  if (pageContext && pageContext.context) {
    window.NexusTeamWorkflow.appendContextToTeamTabs(pageContext.context);
    window.NexusTeamWorkflow.appendContextToTeamLinks(pageContext.context);
    const backBtn = document.querySelector('.back-btn-alt');
    if (backBtn) {
      backBtn.href = 'add-players.html?compId=' + encodeURIComponent(pageContext.comp.id) + '&teamId=' + encodeURIComponent(pageContext.team.id);
    }
  }
});
