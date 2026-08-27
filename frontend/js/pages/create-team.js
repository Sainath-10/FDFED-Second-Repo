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

  const comp = window.NexusData ? window.NexusData.getCompetitionById(compId) : null;
  const entryFeeAmount = comp ? (comp.entryFeeAmount || 0) : 0;
  const feeType = comp ? (comp.feeType || 'free') : 'free';

  if (comp && feeType === 'per_team' && entryFeeAmount > 0) {
    showTeamCheckoutModal(comp, name, entryFeeAmount, () => {
      proceedCreateTeam(compId, name, tag, logoSvg);
    });
  } else {
    proceedCreateTeam(compId, name, tag, logoSvg);
  }
}

function proceedCreateTeam(compId, name, tag, logoSvg) {
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
    showToast('Team "' + name + '" registered successfully!');
  }

  const inviteInput = document.getElementById('invite-link');
  if (inviteInput && result.team && result.team.id) {
    inviteInput.value = buildInviteLink(compId, result.team.id);
  }
  
  // Redirect to activity page
  setTimeout(() => {
    window.location.href = 'my-activity.html';
  }, 1500);
}

function showTeamCheckoutModal(comp, teamName, feeAmount, onConfirm) {
  const existing = document.getElementById('team-checkout-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'team-checkout-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#0f172a;border:1px solid #c6ff33;border-radius:16px;width:min(90vw,460px);padding:32px;box-shadow:0 20px 60px #000a;color:#f1f5f9;">
      <h3 style="margin:0 0 4px;font-size:20px;color:#f1f5f9;">🛡️ Team Registration Payment</h3>
      <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">Team Registration Fee for "${comp.name}".</p>

      <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:20px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#cbd5e1;">
          <span>Team Name:</span>
          <strong>${teamName}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#cbd5e1;">
          <span>Participation Fee Model:</span>
          <span style="color:#c6ff33;font-weight:600;">Per Team (Team Lead Pays)</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:16px;color:#f1f5f9;border-top:1px dashed rgba(198,255,51,0.3);padding-top:10px;margin-top:2px;">
          <strong>Total Registration Fee:</strong>
          <strong style="color:#c6ff33;font-size:20px;">₹${feeAmount.toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div style="display:flex;gap:12px;">
        <button id="cancel-team-checkout-btn" style="flex:1;padding:12px;background:none;border:1px solid #334155;color:#94a3b8;border-radius:8px;cursor:pointer;font-size:14px;">
          Cancel
        </button>
        <button id="confirm-team-checkout-btn" style="flex:2;padding:12px;background:#c6ff33;border:none;color:#000;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;">
          ✔ Pay ₹${feeAmount.toLocaleString('en-IN')} &amp; Register Team
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById('cancel-team-checkout-btn').addEventListener('click', () => modal.remove());
  document.getElementById('confirm-team-checkout-btn').addEventListener('click', () => {
    modal.remove();
    if (typeof onConfirm === 'function') onConfirm();
  });
}

// Global exposure
window.copyInviteLink = copyInviteLink;
window.createTeam = createTeam;
