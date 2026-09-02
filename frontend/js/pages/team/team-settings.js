initTeamSidebar('activity', 'settings', '../../');
initFooter('../../');

let pageContext = null;

// Logo Selection Logic
const logoOptions = document.querySelectorAll('.logo-option:not(.upload-btn)');
logoOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    logoOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });
});

// Join Policy Selection
function setJoinPolicy(policy) {
  const optOpen = document.getElementById('policy-open');
  const optInvite = document.getElementById('policy-invite');
  
  if (optOpen && optInvite) {
    optOpen.classList.toggle('active', policy === 'open');
    optInvite.classList.toggle('active', policy === 'invite');
    
    if (typeof showToast === 'function') {
      const label = policy === 'open' ? 'Open (Anyone can request)' : 'Invite Only';
      showToast(`Join policy set to: ${label}`);
    }
  }
}

// Save Changes Action
function saveChanges() {
  const nameInput = document.getElementById('team-name');
  const tagInput = document.getElementById('team-tag');
  
  const name = nameInput ? nameInput.value.trim() : '';
  const tag = tagInput ? tagInput.value.trim() : '';

  if (!name || !tag) {
    if (typeof showToast === 'function') {
      showToast('Please fill in both Team Name and Team Tag!', 'error');
    }
    return;
  }

  if (typeof showToast === 'function') {
    showToast(`Team settings for "${name}" updated successfully!`);
  }
}

// Disband Team
function disbandTeam() {
  if (!pageContext || !pageContext.team || !pageContext.comp) return;
  if (!confirm('Are you sure you want to disband "' + (pageContext.team.name || 'this team') + '"? This cannot be undone.')) return;

  const teamId = pageContext.team.id;
  const compId = pageContext.comp.id;

  // Remove team from competition via NexusData
  if (window.NexusData && typeof window.NexusData.loadCompetitions === 'function') {
    const comps = window.NexusData.loadCompetitions() || [];
    const comp = comps.find(c => String(c.id) === String(compId));
    if (comp && Array.isArray(comp.teams)) {
      comp.teams = comp.teams.filter(t => String(t.id) !== String(teamId));
      if (typeof window.NexusData.updateCompetition === 'function') {
        window.NexusData.updateCompetition(comp);
      }
    }
  }

  // Clear team context from localStorage
  try { localStorage.removeItem('nexus.team.context'); } catch (e) {}

  if (typeof showToast === 'function') {
    showToast('Team disbanded successfully.', 'error');
  }

  setTimeout(() => {
    window.location.href = '../../pages/competitions.html';
  }, 1200);
}

// Global exposure
window.setJoinPolicy = setJoinPolicy;
window.saveChanges = saveChanges;
window.disbandTeam = disbandTeam;

document.addEventListener('DOMContentLoaded', function () {
  if (!window.NexusTeamWorkflow || typeof window.NexusTeamWorkflow.resolveTeamContext !== 'function') return;

  pageContext = window.NexusTeamWorkflow.resolveTeamContext();
  if (!pageContext || !pageContext.team) return;

  if (pageContext.context) {
    window.NexusTeamWorkflow.appendContextToTeamTabs(pageContext.context);
    window.NexusTeamWorkflow.appendContextToTeamLinks(pageContext.context);
    window.NexusTeamWorkflow.refreshTeamManagementUI(pageContext.comp.id, pageContext.team.id);
  }

  const title = document.querySelector('.page-title');
  const subtitle = document.querySelector('.page-subtitle');
  const nameInput = document.getElementById('team-name');
  const tagInput = document.getElementById('team-tag');

  if (title) title.textContent = pageContext.team.name || 'Team Settings';
  if (subtitle) subtitle.textContent = 'Team settings and management options';
  if (nameInput) nameInput.value = pageContext.team.name || '';
  if (tagInput) tagInput.value = pageContext.team.tag || '';
});
