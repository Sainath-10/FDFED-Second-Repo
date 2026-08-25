/* ============================================================
   NEXUS ESPORTS — Dispute Review JS
   ============================================================ */

let comp = null;
let activeDisputeId = null;
let disFilter = 'all';
let disSearch = '';

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const preselect = params.get('dispute');

  comp = window.NexusData.getCompetitionById(id) || { id, name: 'Competition', game: '—', disputes: [], matches: [], type: 'league', status: 'ongoing', totalMatches: 0, matchesCompleted: 0, teams: [] };

  document.getElementById('btn-back-to-comp').href = `competition-detail.html?id=${id}`;
  renderStats();
  renderList();
  setupControls();

  if (preselect) openDispute(preselect);
});

function renderStats() {
  const total   = comp.disputes.length;
  const pending = comp.disputes.filter(d => d.status === 'awaiting' || d.status === 'open' || d.status === 'pending').length;
  const resolved = comp.disputes.filter(d => d.status === 'resolved').length;
  const escalated = comp.disputes.filter(d => d.status === 'escalated').length;
  const orgs = Array.isArray(comp.organizers) && comp.organizers.length > 0
    ? comp.organizers.join(', ')
    : (comp.createdBy || comp.organizerId || 'Organizer');

  document.getElementById('disputes-stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">LEAGUE / TOURNAMENT</div><div class="stat-val-text">${comp.name}</div></div>
    <div class="stat-card"><div class="stat-label">ORGANIZERS</div><div class="stat-val-text">👥 ${orgs}</div></div>
    <div class="stat-card"><div class="stat-label">TOTAL DISPUTES</div><div class="stat-big">${total}</div></div>
    <div class="stat-card stat-card-highlight"><div class="stat-label">PENDING REVIEW</div><div class="stat-big stat-accent">${pending}</div></div>
    <div class="stat-card"><div class="stat-label">RESOLVED</div><div class="stat-big" style="color:#60a5fa;">${resolved}</div></div>
  `;
}

function getFiltered() {
  return comp.disputes.filter(d => {
    const isPending = d.status === 'awaiting' || d.status === 'open' || d.status === 'pending';
    const statusMatch = disFilter === 'all'
      || (disFilter === 'awaiting' && isPending)
      || (disFilter === 'resolved' && d.status === 'resolved')
      || (disFilter === 'escalated' && d.status === 'escalated');
    const searchTarget = [d.title, d.submitter, d.reporter, d.id, d.desc, d.reason].filter(Boolean).join(' ').toLowerCase();
    const queryMatch = !disSearch || searchTarget.includes(disSearch);
    return statusMatch && queryMatch;
  });
}

function renderList() {
  const filtered = getFiltered();
  if (!filtered.length) {
    document.getElementById('disputes-list-panel').innerHTML = `<div class="empty-state">No disputes matching filter.</div>`;
    return;
  }
  document.getElementById('disputes-list-panel').innerHTML = filtered.map(d => {
    const isPending = d.status === 'awaiting' || d.status === 'open' || d.status === 'pending';
    let statusBadge = `<span class="sm-status-badge sm-awaiting">AWAITING ORGANIZER</span>`;
    if (d.status === 'resolved') {
      statusBadge = `<span class="sm-status-badge sm-completed">RESOLVED</span>`;
    } else if (d.status === 'escalated') {
      statusBadge = `<span class="sm-status-badge" style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid #ef4444;">ESCALATED</span>`;
    }
    const active = d.id === activeDisputeId ? 'dispute-row-active' : '';
    return `
      <div class="dispute-list-row ${active}" onclick="openDispute('${d.id}')">
        <div class="dispute-row-id">#${d.id}</div>
        <div class="dispute-row-info">
          <div class="dispute-row-title">${d.title}</div>
          <div class="dispute-row-meta">Submitter: ${d.submitter || d.reporter || 'Player'} • ${d.time || 'Recent'}</div>
          <div class="dispute-row-reason">${d.reason || d.desc || ''}</div>
        </div>
        ${statusBadge}
      </div>`;
  }).join('');
}

window.openDispute = function(disputeId) {
  activeDisputeId = disputeId;
  renderList();
  const d = comp.disputes.find(x => x.id === disputeId);
  if (!d) return;

  const isPending = d.status === 'awaiting' || d.status === 'open' || d.status === 'pending';
  const panel = document.getElementById('dispute-detail-panel');
  panel.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-id">DISPUTE #${d.id}</div>
        <div class="detail-session">ORGANIZER REVIEW DESK</div>
      </div>
      <span style="font-size:12px;color:var(--accent);font-weight:700;">Routed to Event Organizers</span>
    </div>

    <div class="detail-section">
      <div class="detail-section-label">REPORTED DETAILS</div>
      <div class="detail-reason-box">
        <div class="detail-reason-title">"${d.title}"</div>
        <p class="detail-reason-body">${d.detail || d.desc || d.reason || 'No additional details.'}</p>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
          <span>Submitter: <strong>${d.submitter || d.reporter || 'Player'}</strong></span> &bull; 
          <span>Match: <strong>${d.matchName || comp.name}</strong></span>
        </div>
      </div>
    </div>

    ${d.resolutionNotes ? `
    <div class="detail-section">
      <div class="detail-section-label">ORGANIZER RESOLUTION VERDICT</div>
      <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.25);border-radius:8px;padding:12px;color:#93c5fd;font-size:13px;">
        ${d.resolutionNotes}
        ${d.resolvedBy ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Resolved by: @${d.resolvedBy}</div>` : ''}
      </div>
    </div>` : ''}

    ${isPending ? `
    <div class="detail-section">
      <div class="detail-section-label">ORGANIZER RESOLUTION NOTES</div>
      <textarea id="organizer-verdict-notes" class="edit-textarea" style="width:100%;height:70px;font-size:13px;border-radius:8px;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;" placeholder="Enter verdict or resolution rationale for participants..."></textarea>
    </div>

    <div class="detail-actions" style="margin-top:16px;">
      <button class="detail-btn detail-btn-approve" onclick="resolveAction('${comp.id}','${d.id}','approve')">APPROVE DISPUTE</button>
      <button class="detail-btn detail-btn-reject"  onclick="resolveAction('${comp.id}','${d.id}','reject')">DISMISS DISPUTE</button>
    </div>
    <button class="detail-btn-outline" style="margin-top:10px;width:100%;border-color:#f87171;color:#f87171;" onclick="escalateAction('${comp.id}','${d.id}')">
      ⚠️ ESCALATE TO SUPER ADMIN
    </button>` : `
    <div class="detail-resolved-notice" style="margin-top:20px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c6ff33" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      Status: ${d.status ? d.status.toUpperCase() : 'RESOLVED'}
    </div>`}
  `;
};

window.resolveAction = function(compId, disputeId, action) {
  const notes = document.getElementById('organizer-verdict-notes')?.value.trim()
    || (action === 'approve' ? 'Dispute validated and approved by event organizer.' : 'Dispute reviewed and dismissed by event organizer.');

  let sessionUser = 'organizer';
  try {
    const s = JSON.parse(localStorage.getItem('nexus.auth.session') || '{}');
    if (s.username) sessionUser = s.username;
  } catch(e) {}

  const c = window.NexusData.getCompetitionById(compId);
  if (c && Array.isArray(c.disputes)) {
    const d = c.disputes.find(x => x.id === disputeId);
    if (d) {
      d.status = 'resolved';
      d.resolutionNotes = notes;
      d.resolvedBy = sessionUser;
      window.NexusData.updateCompetition(c);
      comp = c;
    }
  }

  // Also update in nexus_admin_disputes store
  try {
    const all = JSON.parse(localStorage.getItem('nexus_admin_disputes') || '[]');
    const item = all.find(x => x.id === disputeId);
    if (item) {
      item.status = 'resolved';
      item.resolutionNotes = notes;
      item.resolvedBy = sessionUser;
      localStorage.setItem('nexus_admin_disputes', JSON.stringify(all));
    }
  } catch(e) {}

  // Update backend API in background
  try {
    fetch(`http://localhost:3000/disputes/${disputeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'team_lead'
      },
      body: JSON.stringify({
        status: 'resolved',
        resolutionNotes: notes
      })
    }).catch(() => {});
  } catch(e) {}

  renderStats();
  renderList();
  openDispute(disputeId);
  if (typeof showToast === 'function') {
    showToast(`Dispute #${disputeId} marked as ${action === 'approve' ? 'Approved' : 'Dismissed'}!`);
  }
};

window.escalateAction = function(compId, disputeId) {
  const c = window.NexusData.getCompetitionById(compId);
  if (c && Array.isArray(c.disputes)) {
    const d = c.disputes.find(x => x.id === disputeId);
    if (d) {
      d.status = 'escalated';
      d.resolutionNotes = 'Escalated by event organizer to Super Admin review.';
      window.NexusData.updateCompetition(c);
      comp = c;
    }
  }

  // Update backend API in background
  try {
    fetch(`http://localhost:3000/disputes/${disputeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'team_lead'
      },
      body: JSON.stringify({
        status: 'escalated',
        resolutionNotes: 'Escalated by event organizer to Super Admin review.'
      })
    }).catch(() => {});
  } catch(e) {}

  renderStats();
  renderList();
  openDispute(disputeId);
  if (typeof showToast === 'function') {
    showToast(`Dispute #${disputeId} escalated to Super Admin.`);
  }
};

function setupControls() {
  document.getElementById('disputes-search').addEventListener('input', e => { disSearch = e.target.value.toLowerCase().trim(); renderList(); });
  document.getElementById('disputes-status-filter').addEventListener('change', e => { disFilter = e.target.value; renderList(); });
}
