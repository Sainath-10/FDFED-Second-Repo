initSidebar('competitions', '../');
initFooter('../');

const DISPUTE_STORE_KEY = 'nexus_admin_disputes';

function mapApiDispute(d) {
  return {
    id: d.id,
    title: d.reason || 'Dispute',
    desc: d.reason || '',
    description: d.reason || '',
    status: d.status || 'pending',
    time: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
    matchName: d.competitionId || 'N/A',
    reporter: d.reportedBy || 'Player',
    submitter: d.reportedBy || 'Player',
    organizers: Array.isArray(d.organizers) ? d.organizers : [],
    targetUserOrTeam: d.targetUserOrTeam,
  };
}

async function loadDisputesForPage() {
  if (window.NexusAPI && window.NexusAPI.Disputes) {
    try {
      const result = await window.NexusAPI.Disputes.getAll();
      if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
        return result.data.map(mapApiDispute);
      }
    } catch (e) {}
  }

  try {
    return JSON.parse(localStorage.getItem(DISPUTE_STORE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function getStatusUi(status) {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'resolved') return { className: 'approved', label: 'Resolved', filter: 'resolved' };
  if (value === 'under_review' || value === 'investigating') return { className: 'pending', label: 'Investigating', filter: 'investigating' };
  if (value === 'escalated' || value === 'escalated_to_admin' || value === 'open_admin') return { className: 'pending', label: 'Escalated', filter: 'escalated' };
  return { className: 'pending', label: 'Pending Review', filter: value };
}

async function renderDisputes() {
  const container = document.getElementById('disputes-list');
  if (!container) return;

  const disputes = await loadDisputesForPage();

  if (disputes.length === 0) {
    // Keep the static ones or show a message?
    // User said "THIS exact report should appear", suggesting they want to see their reports.
    // I'll prepend the dynamic ones to the list or replace it.
    // Let's replace it to ensure "exact report" is clear.
    // container.innerHTML = '<p style="color:var(--text-muted);padding:20px;">No custom disputes found.</p>';
  }

  const dynamicHtml = disputes.map(d => {
    const statusUi = getStatusUi(d.status);
    
    return `
      <div class="dispute-card" data-status="${statusUi.filter}">
        <div class="dispute-header">
          <span class="dispute-id">#${d.id}</span>
          <span class="status-pill ${statusUi.className}">${statusUi.label}</span>
        </div>
        <div class="dispute-title">${d.title}</div>
        <div class="dispute-desc">${d.desc || d.description || ''}</div>
        <div class="dispute-meta">
          <span>📅 Filed: ${d.time || 'Recent'}</span>
          <span>🏆 Competition: ${d.matchName || 'N/A'}</span>
          <span>👥 Reporter: ${d.reporter || d.submitter || 'Player'}</span>
          <span>🛡️ Routed to: ${Array.isArray(d.organizers) && d.organizers.length > 0 ? d.organizers.join(', ') : 'Event Organizers'}</span>
        </div>
        <div class="dispute-actions">
          <button class="btn-table-secondary" onclick="showEvidence('${d.id}')">View Details</button>
          ${d.status !== 'resolved' && d.status !== 'escalated' && d.status !== 'escalated_to_admin' ? `
          <button class="btn-table-danger" onclick="location.href='dispute-escalation.html?id=${d.id}'">Escalate</button>
          ` : ''}
          ${d.status === 'escalated' || d.status === 'escalated_to_admin' ? '<span style="color:var(--accent);font-size:12px;">Escalated to Super Admin</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  // Prepend dynamic ones to existing static ones for now, or just show dynamic?
  // Let's keep static for demo but prepend dynamic.
  const staticHtml = container.innerHTML;
  container.innerHTML = dynamicHtml + staticHtml;
}

renderDisputes();

const filterTabs = document.querySelectorAll('.filter-tab');
if (filterTabs.length > 0) {
  filterTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      filterTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      const cards = document.querySelectorAll('.dispute-card');
      cards.forEach(card => {
        const status = card.dataset.status;
        card.style.display = (filter === 'all' || status === filter) ? '' : 'none';
      });
    });
  });
}

/* ── Evidence viewer modal ─────────────────── */
function showEvidence(disputeId) {
  // Collect all evidence entries from localStorage
  let allEvidence = {};
  try { allEvidence = JSON.parse(localStorage.getItem('nexus.disputes.evidence') || '{}'); } catch (e) {}

  // If disputeId given and found, use it. Otherwise show all.
  const entries = disputeId && allEvidence[disputeId]
    ? [allEvidence[disputeId]]
    : Object.values(allEvidence);

  if (!entries.length || !entries.some(e => e.files && e.files.length)) {
    if (typeof showToast === 'function') showToast('No evidence files attached to this dispute.', 'error');
    return;
  }

  // Build modal HTML
  const filesHtml = entries.flatMap(entry => entry.files || []).map(f => {
    if (f.isImage && f.dataUrl) {
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <img src="${f.dataUrl}" alt="${f.name}" style="width:64px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;">
        <div><div style="font-size:13px;color:var(--text-white);">${f.name}</div><div style="font-size:11px;color:var(--text-muted);">${(f.size/1024).toFixed(0)} KB · Image</div></div>
      </div>`;
    }
    const ext = (f.name || '').split('.').pop().toUpperCase();
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="width:64px;height:48px;background:rgba(198,255,51,0.08);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--accent);font-weight:700;flex-shrink:0;">${ext}</div>
      <div><div style="font-size:13px;color:var(--text-white);">${f.name}</div><div style="font-size:11px;color:var(--text-muted);">${(f.size/1024).toFixed(0)} KB</div></div>
    </div>`;
  }).join('');

  // Inject or reuse modal
  let modal = document.getElementById('evidence-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'evidence-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--bg-card,#1a1a1a);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="color:var(--text-white);margin:0;font-size:16px;">Evidence Files</h3>
        <button onclick="document.getElementById('evidence-modal').remove()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;line-height:1;">×</button>
      </div>
      ${filesHtml || '<p style="color:var(--text-muted);font-size:14px;">No files found.</p>'}
    </div>`;

  modal.style.display = 'flex';
}

// Update View Details buttons to show evidence
document.querySelectorAll('.dispute-card').forEach(card => {
  const viewBtn = card.querySelector('.btn-table-secondary');
  if (viewBtn && viewBtn.textContent.trim() === 'View Details') {
    const disputeId = card.querySelector('.dispute-id')?.textContent?.replace('#', '').trim();
    viewBtn.onclick = () => showEvidence(disputeId || null);
  }
});

window.showEvidence = showEvidence;
