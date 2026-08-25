initAdminSidebar('disputes');
initFooter('../../');

const DISPUTE_STORE_KEY = 'nexus_admin_disputes';

function safeParse(json, fallback) {
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch (err) {
    return fallback;
  }
}

function saveDisputes(disputes) {
  localStorage.setItem(DISPUTE_STORE_KEY, JSON.stringify(disputes));
}

function extractMetaValue(items, label) {
  const target = items.find(text => text.toLowerCase().startsWith(label.toLowerCase()));
  if (!target) return '';
  const idx = target.indexOf(':');
  return idx === -1 ? '' : target.slice(idx + 1).trim();
}

function seedDisputesFromDOM() {
  const cards = Array.from(document.querySelectorAll('.dispute-full-card'));

  return cards.map((card, index) => {
    const metaTexts = Array.from(card.querySelectorAll('.dfc-meta-row span')).map(el => el.textContent.trim());
    const disputeIdText = card.querySelector('.dispute-id')?.textContent.trim() || `#DISP-${index + 1}`;

    return {
      cardId: card.id,
      disputeId: disputeIdText,
      competition: card.querySelector('.dfc-competition')?.textContent.trim() || 'Unknown Competition',
      title: card.querySelector('.dfc-title')?.textContent.trim() || 'Untitled Dispute',
      description: card.querySelector('.dfc-desc')?.textContent.trim() || '',
      filedBy: extractMetaValue(metaTexts, 'Filed by'),
      against: extractMetaValue(metaTexts, 'Against'),
      filedAt: extractMetaValue(metaTexts, 'Filed') || extractMetaValue(metaTexts, 'Escalated'),
      status: (card.dataset.status || 'open').toLowerCase(),
      escalated: card.classList.contains('dispute-card-escalated') || (card.dataset.status || '').toLowerCase() === 'escalated',
      superAdminState: card.classList.contains('dispute-card-escalated') ? 'pending' : '',
      superAdminDecision: '',
      updatedAt: new Date().toISOString()
    };
  });
}

function loadDisputes() {
  const stored = safeParse(localStorage.getItem(DISPUTE_STORE_KEY), null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  // If empty, seed from DOM once then save
  const seeded = seedDisputesFromDOM();
  if (seeded.length > 0) {
    saveDisputes(seeded);
  }
  return seeded;
}

let disputes = loadDisputes();

function renderDisputes() {
  const container = document.getElementById('disputes-list');
  if (!container) return;

  if (disputes.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">No disputes found.</div>';
    return;
  }

  container.innerHTML = disputes.map(d => {
    const status = (d.status || 'open').toLowerCase();
    const isEscalated = status === 'escalated';
    const isResolved = status === 'resolved';
    
    let actionsHtml = '';
    if (!isEscalated && !isResolved) {
      actionsHtml = `
        <div class="dfc-actions">
          <button class="btn-table-primary" onclick="resolveDispute('${d.cardId}','approved')">Approve Dispute</button>
          <button class="btn-table-danger"  onclick="resolveDispute('${d.cardId}','rejected')">Reject Dispute</button>
          <button class="btn-table-secondary" onclick="showToast('Request sent to both teams.')">Request More Info</button>
          <button class="btn-escalate" onclick="escalateDispute('${d.cardId}')">🔺 Escalate to Super Admin</button>
        </div>`;
    }

    let notesHtml = '';
    if (!isEscalated && !isResolved) {
      notesHtml = `
        <div class="admin-notes-section">
          <div class="notes-label-sm">Admin Notes</div>
          <textarea class="form-input notes-textarea-sm" placeholder="Add your review notes here…">${d.adminNotes || ''}</textarea>
        </div>`;
    }

    let decisionHtml = '';
    if (isEscalated) {
        const waitingText = d.superAdminState === 'dismissed'
          ? 'Super Admin decision: Dismissed'
          : d.superAdminState === 'resolved'
            ? 'Super Admin decision: Role revoked, dispute resolved'
            : 'Awaiting Super Admin decision';
        decisionHtml = `<div class="dfc-escalated-note"><span>🔺 ${waitingText}</span></div>`;
    } else if (isResolved && d.superAdminDecision) {
        decisionHtml = `<div class="dfc-escalated-note"><span>🔺 Super Admin decision: ${d.superAdminDecision}</span></div>`;
    }

    return `
      <div class="dispute-full-card ${isEscalated ? 'dispute-card-escalated' : ''} ${isResolved ? 'dispute-card-resolved' : ''}" 
           data-status="${status}" id="${d.cardId}">
        <div class="dfc-header">
          <div class="dfc-header-left">
            <span class="dispute-id">${d.disputeId}</span>
            <span class="dfc-competition">${d.competition || 'Unknown Competition'}</span>
          </div>
          <span class="status-pill ${status === 'escalated' ? 'status-pill-escalated' : (status === 'resolved' ? 'approved' : 'pending')}">
            ${status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        <div class="dfc-title">${d.title}</div>
        <div class="dfc-desc">${d.description}</div>
        <div class="dfc-meta-row">
          <span>Filed by: <strong>${d.filedBy}</strong></span>
          <span>Against: <strong>${d.against}</strong></span>
          <span>Filed: ${d.filedAt}</span>
        </div>
        ${notesHtml}
        ${actionsHtml}
        ${decisionHtml}
      </div>`;
  }).join('');

  updateStatCounters();
}

function updateStatCounters() {
  const counts = { open: 0, escalated: 0, resolved: 0 };
  disputes.forEach(d => {
    const s = (d.status || 'open').toLowerCase();
    if (s === 'escalated') counts.escalated++;
    else if (s === 'resolved') counts.resolved++;
    else counts.open++;
  });
  const openEl      = document.getElementById('stat-open');
  const escalatedEl = document.getElementById('stat-escalated');
  const resolvedEl  = document.getElementById('stat-resolved');
  if (openEl)      openEl.textContent      = counts.open;
  if (escalatedEl) escalatedEl.textContent = counts.escalated;
  if (resolvedEl)  resolvedEl.textContent  = counts.resolved;
}

function applyFilter(filter) {
  document.querySelectorAll('.dispute-full-card').forEach(card => {
    card.style.display = filter === 'all' || card.dataset.status === filter ? '' : 'none';
  });
}

const filterTabs = document.querySelectorAll('.filter-tab');
filterTabs.forEach(btn => {
  btn.addEventListener('click', () => {
    filterTabs.forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');
    applyFilter(btn.dataset.filter || 'all');
  });
});

function resolveDispute(cardId, decision) {
  const dispute = disputes.find(item => item.cardId === cardId);
  if (!dispute) return;

  dispute.status = 'resolved';
  dispute.escalated = false;
  dispute.superAdminState = '';
  dispute.superAdminDecision = decision === 'approved'
    ? 'Approved by admin'
    : 'Rejected by admin';
  dispute.updatedAt = new Date().toISOString();

  saveDisputes(disputes);
  renderDisputes();
  applyFilter(document.querySelector('.filter-tab.active')?.dataset.filter || 'all');

  if (decision === 'approved') {
    showToast('Dispute approved. Match result updated.');
  } else {
    showToast('Dispute rejected. Original result stands.', 'error');
  }
}

function escalateDispute(cardId) {
  window.location.href = `escalate-super-admin.html?cardId=${encodeURIComponent(cardId)}`;
}

window.addEventListener('storage', event => {
  if (event.key !== DISPUTE_STORE_KEY) return;
  disputes = loadDisputes();
  renderDisputes();
  applyFilter(document.querySelector('.filter-tab.active')?.dataset.filter || 'all');
});

// Initial Render
renderDisputes();
applyFilter(document.querySelector('.filter-tab.active')?.dataset.filter || 'all');

window.resolveDispute = resolveDispute;
window.escalateDispute = escalateDispute;