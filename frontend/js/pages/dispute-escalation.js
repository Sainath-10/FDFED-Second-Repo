initSidebar('competitions', '../');
initFooter('../');

const DISPUTE_STORE_KEY = 'nexus_admin_disputes';
const params = new URLSearchParams(window.location.search);
const disputeId = params.get('id');

// Block disputes on ended competitions
(function checkCompEnded() {
  const compId = params.get('compId') || params.get('id');
  if (!compId || !window.NexusData) return;
  const comp = window.NexusData.getCompetitionById(compId);
  if (comp && window.NexusData.isCompEnded && window.NexusData.isCompEnded(comp)) {
    window.NexusData.enforceNotEnded(comp, '#escalation-form button[type="submit"],.btn-primary,.btn-submit');
    document.querySelectorAll('.form-select,.form-textarea,input').forEach(el => {
      el.disabled = true; el.style.opacity = '0.4';
    });
  }
})();

// Prefill dropdown
const refSelect = document.querySelector('.form-select');
if (refSelect && disputeId) {
    // If we have an ID, we could dynamically add it to the options if it's not there
    let disputes = [];
    try { disputes = JSON.parse(localStorage.getItem(DISPUTE_STORE_KEY) || '[]'); } catch(e) {}
    const d = disputes.find(item => item.id === disputeId);
    if (d) {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `#${d.id} — ${d.title}`;
        opt.selected = true;
        refSelect.appendChild(opt);
    }
}

const escalationForm = document.getElementById('escalation-form');
if (escalationForm) {
  escalationForm.addEventListener('submit', e => {
    e.preventDefault();
    
    const selectedId = refSelect.value || disputeId;
    const reason = document.querySelectorAll('.form-select')[1]?.value;
    const summary = document.querySelector('.form-textarea')?.value;

    if (!selectedId || !reason || !summary) {
        if (typeof showToast === 'function') showToast('Please fill in all escalation details.', 'error');
        return;
    }

    // Update dispute status
    try {
        let disputes = JSON.parse(localStorage.getItem(DISPUTE_STORE_KEY) || '[]');
        const idx = disputes.findIndex(item => item.id === selectedId);
        if (idx >= 0) {
            disputes[idx].status = 'escalated';
            disputes[idx].escalated = true;
            disputes[idx].escalationReason = reason;
            disputes[idx].escalationSummary = summary;
            disputes[idx].escalatedAt = new Date().toISOString();
            localStorage.setItem(DISPUTE_STORE_KEY, JSON.stringify(disputes));
        }
    } catch(e) {
        console.error('Failed to update dispute status:', e);
    }

    if (typeof showToast === 'function') {
      showToast('Dispute escalated to Super Admin successfully!');
    }
    setTimeout(() => {
      window.location.href = 'disputes.html';
    }, 1400);
  });
}
