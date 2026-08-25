initAdminSidebar('disputes');
initFooter('../../');

const DISPUTE_STORE_KEY = 'nexus_admin_disputes';

function safeParse(json, fallback) {
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch { return fallback; }
}

function readDisputes() {
  const parsed = safeParse(localStorage.getItem(DISPUTE_STORE_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveDisputes(disputes) {
  localStorage.setItem(DISPUTE_STORE_KEY, JSON.stringify(disputes));
}

// ── Read cardId from URL ───────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const cardId = params.get('cardId');

let currentDispute = null;

function prefillDisputeDetails() {
  if (!cardId) return;

  const disputes = readDisputes();
  currentDispute = disputes.find(d => d.cardId === cardId);

  if (!currentDispute) {
    console.warn('Dispute not found in store for cardId:', cardId);
    return;
  }

  // Dispute ID
  const idEl = document.getElementById('esc-id');
  if (idEl) idEl.textContent = currentDispute.disputeId || cardId;

  // Competition
  const compEl = document.getElementById('esc-competition');
  if (compEl) compEl.textContent = currentDispute.competition || '—';

  // Title used as "Match"
  const matchEl = document.getElementById('esc-match');
  if (matchEl) matchEl.textContent = currentDispute.title || '—';

  // Filed By
  const filedEl = document.getElementById('esc-filed-by');
  if (filedEl) filedEl.textContent = currentDispute.filedBy || '—';

  // Against
  const againstEl = document.getElementById('esc-against');
  if (againstEl) againstEl.textContent = currentDispute.against || '—';

  // Filed On
  const filedOnEl = document.getElementById('esc-filed-on');
  if (filedOnEl) filedOnEl.textContent = currentDispute.filedAt || '—';

  // Description
  const descEl = document.getElementById('esc-description');
  if (descEl) descEl.textContent = currentDispute.description || '—';

  // Current Status pill
  const statusEl = document.getElementById('esc-status');
  if (statusEl) {
    const s = (currentDispute.status || 'open');
    const label = s === 'review' ? 'Under Review' : s.charAt(0).toUpperCase() + s.slice(1);
    statusEl.textContent = label;
    statusEl.className = 'status-pill ' + (s === 'escalated' ? 'status-pill-escalated' : 'pending');
  }
}

// ── File upload handler ────────────────────────────────────────────────────
function handleFiles(e) {
  const fileList = document.getElementById('file-list');
  if (!fileList) return;
  Array.from(e.target.files).forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span>📎 ${file.name}</span><span>${(file.size / 1024).toFixed(1)} KB</span>`;
    fileList.appendChild(item);
  });
}

// ── Submit escalation ──────────────────────────────────────────────────────
function submitEscalation() {
  const reason = document.getElementById('esc-reason')?.value;
  const summary = document.getElementById('esc-summary')?.value.trim();

  if (!reason) { showToast('Please select a reason for escalation.', 'error'); return; }
  if (!summary) { showToast('Please provide an admin summary.', 'error'); return; }

  if (!cardId) { showToast('No dispute selected.', 'error'); return; }

  // Commit the escalation to localStorage
  const disputes = readDisputes();
  const dispute = disputes.find(d => d.cardId === cardId);

  if (!dispute) { showToast('Dispute not found. Cannot escalate.', 'error'); return; }

  const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
  const recommendation = document.getElementById('esc-recommendation')?.value.trim() || '';

  dispute.status = 'escalated';
  dispute.escalated = true;
  dispute.superAdminState = 'pending';
  dispute.superAdminDecision = '';
  dispute.escalationReason = reason;
  dispute.escalationSummary = summary;
  dispute.escalationPriority = priority;
  dispute.escalationRecommendation = recommendation;
  dispute.updatedAt = new Date().toISOString();

  saveDisputes(disputes);

  showToast('Dispute escalated to Super Admin successfully.');
  setTimeout(() => { location.href = 'disputes.html'; }, 1500);
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', prefillDisputeDetails);
// Also run immediately in case DOMContentLoaded already fired
prefillDisputeDetails();

window.handleFiles = handleFiles;
window.submitEscalation = submitEscalation;