initSidebar('competitions', '../');
initFooter('../');

function getCompIdFromPage() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('id') || params.get('compId');
  if (fromQuery) return fromQuery;

  if (window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.getActiveTeamContext === 'function') {
    const context = window.NexusTeamWorkflow.getActiveTeamContext();
    if (context && context.compId) return context.compId;
  }

  return null;
}

function syncInviteLink() {
  const compId = getCompIdFromPage();
  const inviteInput = document.getElementById('invite-link');
  if (!inviteInput) return;

  const context = window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.getActiveTeamContext === 'function'
    ? window.NexusTeamWorkflow.getActiveTeamContext()
    : null;
  const teamId = context && context.teamId ? context.teamId : '';

  inviteInput.value = buildInviteLink(compId, teamId);
}

syncInviteLink();

// Logo Selection Logic
const logoOptions = document.querySelectorAll('.logo-option:not(.upload-btn)');
logoOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    logoOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });
});

// Copy Invite Link
function copyInviteLink() {
  const linkInput = document.getElementById('invite-link');
  if (linkInput) {
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(linkInput.value).then(() => {
      if (typeof showToast === 'function') {
        showToast('Invite link copied to clipboard!');
      }
    });
  }
}

function buildInviteLink(compId, teamId) {
  const base = window.location.href.split('?')[0].replace('create-team.html', 'join-teams.html');
  const params = new URLSearchParams();
  if (compId) params.set('id', compId);
  if (teamId) params.set('teamId', teamId);
  const query = params.toString();
  return query ? base + '?' + query : base;
}

// Create Team Action
function createTeam() {
  const compId = getCompIdFromPage();
  if (!compId) {
    if (typeof showToast === 'function') showToast('Tournament context missing. Open this from a competition page.', 'error');
    return;
  }

  const nameInput = document.getElementById('team-name');
  const tagInput = document.getElementById('team-tag');
  const name = nameInput ? nameInput.value.trim() : '';
  const tag = tagInput ? tagInput.value.trim() : '';

  if (!name || !tag) {
    if (typeof showToast === 'function') showToast('Please fill in both Team Name and Team Tag!', 'error');
    return;
  }

  // Get selected logo
  const activeLogo = document.querySelector('.logo-option.active');
  const logoSvg = activeLogo ? activeLogo.innerHTML : '🛡️';

  if (!window.NexusTeamWorkflow || typeof window.NexusTeamWorkflow.createTeam !== 'function') {
    if (typeof showToast === 'function') showToast('Team service is unavailable.', 'error');
    return;
  }

  const result = window.NexusTeamWorkflow.createTeam({
    compId: compId,
    name: name,
    tag: tag,
    avatar: logoSvg
  });

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Failed to create team.', 'error');
    return;
  }

  if (typeof showToast === 'function') {
    showToast('Team "' + name + '" created successfully!');
  }

  const inviteInput = document.getElementById('invite-link');
  if (inviteInput && result.team && result.team.id) {
    inviteInput.value = buildInviteLink(compId, result.team.id);
  }

  // ── Wire to Backend API ──────────────────────────────────────
  (async () => {
    if (window.NexusAPI && window.NexusAPI.Teams) {
      try {
        // Get session user info
        let session = null;
        try { session = JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch(e) {}

        const apiRes = await window.NexusAPI.Teams.create(
          name,
          compId,
          session ? [session.username] : []
        );
        if (apiRes.ok && apiRes.data && apiRes.data.id) {
          console.log('[NexusAPI] Team created in backend:', apiRes.data.id);
          // Update local team object with backend ID for future reference
          if (result.team) result.team._backendId = apiRes.data.id;
        } else {
          console.warn('[NexusAPI] Backend team create failed:', apiRes.error);
        }
      } catch (err) {
        console.warn('[NexusAPI] Backend unreachable for team create:', err.message);
      }
    }
  })();

  // Redirect to activity page
  setTimeout(() => {
    window.location.href = 'my-activity.html';
  }, 1500);
}

// Global exposure
window.copyInviteLink = copyInviteLink;
window.createTeam = createTeam;
