/* ============================================================
   NEXUS ESPORTS — Organizer Dispute Review JS
   Handles open_organizer disputes. Organizer can:
     - Give Warning (team disputes ban after 3 organizer warnings)
     - Resolve with notes
     - Escalate to Admin (with optional ban request)
   ============================================================ */

let comp = null;
let allDisputes = [];
let activeDisputeId = null;
let disFilter = 'all';
let disSearch = '';

function isTeamDispute(d) {
  return d && (d.targetType === 'team' || d.targetType === 'opponent_team');
}

function loadOrganizerDisputes(compId) {
  const disputes = window.NexusData.loadDisputes();
  let changed = false;

  disputes.forEach(d => {
    if (d.competitionId === compId && isTeamDispute(d) && d.status === 'escalated_to_admin') {
      d.status = 'open_organizer';
      d.escalated = false;
      d.superAdminState = '';
      d.escalatedReason = '';
      d.escalationReason = '';
      changed = true;
    }
  });

  if (changed && typeof window.NexusData.saveDisputes === 'function') {
    window.NexusData.saveDisputes(disputes);
  }

  return disputes.filter(d =>
    d.competitionId === compId &&
    (d.status === 'open_organizer' || d.status === 'under_review' || d.status === 'resolved' || d.status === 'escalated_to_admin')
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const preselect = params.get('dispute');

  comp = window.NexusData.getCompetitionById(id) || { id, name: 'Competition', game: '—', disputes: [] };

  // Show only organizer-queue disputes
  allDisputes = loadOrganizerDisputes(id);

  const backBtn = document.getElementById('btn-back-to-comp');
  if (backBtn) backBtn.href = `competition-detail.html?id=${id}`;

  renderStats();
  renderList();
  setupControls();

  if (preselect) openDispute(preselect);
});

function renderStats() {
  const total = allDisputes.length;
  const pending = allDisputes.filter(d => d.status === 'open_organizer' || d.status === 'under_review').length;
  const resolved = allDisputes.filter(d => d.status === 'resolved').length;
  const escalated = allDisputes.filter(d => d.status === 'escalated_to_admin').length;
  const orgs = Array.isArray(comp.organizers) && comp.organizers.length > 0
    ? comp.organizers.join(', ')
    : (comp.createdBy || comp.organizerId || 'Organizer');

  document.getElementById('disputes-stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">COMPETITION</div><div class="stat-val-text">${comp.name}</div></div>
    <div class="stat-card"><div class="stat-label">ORGANIZERS</div><div class="stat-val-text">👥 ${orgs}</div></div>
    <div class="stat-card"><div class="stat-label">TOTAL</div><div class="stat-big">${total}</div></div>
    <div class="stat-card stat-card-highlight"><div class="stat-label">PENDING REVIEW</div><div class="stat-big stat-accent">${pending}</div></div>
    <div class="stat-card"><div class="stat-label">ESCALATED</div><div class="stat-big" style="color:#fb923c;">${escalated}</div></div>
    <div class="stat-card"><div class="stat-label">RESOLVED</div><div class="stat-big" style="color:#60a5fa;">${resolved}</div></div>
  `;
}

function getFiltered() {
  return allDisputes.filter(d => {
    const isPending = d.status === 'open_organizer' || d.status === 'under_review';
    const isEscalated = d.status === 'escalated_to_admin';
    const statusMatch = disFilter === 'all'
      || (disFilter === 'awaiting' && isPending)
      || (disFilter === 'resolved' && d.status === 'resolved')
      || (disFilter === 'escalated' && isEscalated);
    const searchTarget = [d.reason, d.reportedBy, d.targetUserOrTeam, d.id].filter(Boolean).join(' ').toLowerCase();
    const queryMatch = !disSearch || searchTarget.includes(disSearch);
    return statusMatch && queryMatch;
  });
}

function renderList() {
  const filtered = getFiltered();
  const panel = document.getElementById('disputes-list-panel');
  if (!filtered.length) {
    panel.innerHTML = `<div class="empty-state" style="padding:40px;text-align:center;color:#64748b;">No disputes in your queue.</div>`;
    return;
  }
  panel.innerHTML = filtered.map(d => {
    const isPending = d.status === 'open_organizer' || d.status === 'under_review';
    let statusBadge = `<span class="sm-status-badge sm-awaiting">AWAITING REVIEW</span>`;
    if (d.status === 'resolved') {
      statusBadge = `<span class="sm-status-badge sm-completed">RESOLVED</span>`;
    } else if (d.status === 'escalated_to_admin') {
      statusBadge = `<span class="sm-status-badge" style="background:rgba(251,146,60,0.2);color:#fb923c;border:1px solid #fb923c;">ESCALATED TO ADMIN</span>`;
    }
    const targetLabel = {
      team: '⚔ Team',
      player: '👤 Player',
      opponent_team: '⚔ Opponent/Team',
      match_rule: '📋 Match Rule',
      organizer: '⚠ Organizer'
    }[d.targetType] || d.targetType;

    const warnCount = d.organizerWarnings || 0;
    const warnBadge = warnCount > 0 ? ` <span style="color:#fb923c;font-size:11px;">⚠${warnCount}</span>` : '';

    const active = d.id === activeDisputeId ? 'dispute-row-active' : '';
    return `
      <div class="dispute-list-row ${active}" onclick="openDispute('${d.id}')">
        <div class="dispute-row-id">#${d.id.slice(-8)}</div>
        <div class="dispute-row-info">
          <div class="dispute-row-title">${targetLabel} — ${d.targetUserOrTeam || 'Unknown'}${warnBadge}</div>
          <div class="dispute-row-meta">Filed by: ${d.reportedBy || 'Player'} • ${new Date(d.createdAt).toLocaleDateString()}</div>
          <div class="dispute-row-reason">${(d.reason || '').slice(0, 80)}${(d.reason || '').length > 80 ? '…' : ''}</div>
        </div>
        ${statusBadge}
      </div>`;
  }).join('');
}

function openDispute(id) {
  activeDisputeId = id;
  renderList();
  const d = allDisputes.find(x => x.id === id);
  if (!d) return;

  const panel = document.getElementById('dispute-detail-panel');
  const isPending = d.status === 'open_organizer' || d.status === 'under_review';
  const isEscalated = d.status === 'escalated_to_admin';
  const isResolved = d.status === 'resolved';

  const targetLabel = {
    team: '⚔ Team Dispute',
    player: '👤 Player Dispute',
    opponent_team: '⚔ Opponent / Team Issue',
    match_rule: '📋 Match Rule Violation',
    organizer: '⚠ Organizer Misconduct'
  }[d.targetType] || d.targetType;

  const evidenceHtml = (d.evidenceUrls || []).length
    ? d.evidenceUrls.map(url => `<a href="${url}" target="_blank" style="color:#c6ff33;font-size:13px;display:block;word-break:break-all;">${url}</a>`).join('')
    : '<span style="color:#64748b;font-size:13px;">No evidence provided</span>';

  const warnCount = d.organizerWarnings || 0;
  const teamDispute = isTeamDispute(d);
  const maxWarnings = teamDispute ? 3 : 2;
  let warnLabel = warnCount > 0 ? `<div style="margin-top:8px;background:rgba(251,146,60,0.1);border:1px solid #fb923c44;border-radius:8px;padding:10px;">
    <span style="color:#fb923c;font-size:13px;font-weight:600;">⚠ Organizer Warnings Issued: ${warnCount}/2</span>
    ${warnCount >= 2 ? '<span style="color:#f87171;font-size:12px;margin-left:8px;">Auto-escalated to Admin!</span>' : ''}
  </div>` : '';
  if (warnCount > 0 && teamDispute) {
    const hint = warnCount >= 3 ? 'Team banned from this tournament.' : (warnCount === 2 ? 'Next warning bans this team from the tournament.' : 'Team dispute remains with the organizer.');
    warnLabel = `<div style="margin-top:8px;background:rgba(251,146,60,0.1);border:1px solid #fb923c44;border-radius:8px;padding:10px;">
      <span style="color:#fb923c;font-size:13px;font-weight:600;">Organizer Warnings Issued: ${warnCount}/3</span>
      <span style="color:#f87171;font-size:12px;margin-left:8px;">${hint}</span>
    </div>`;
  }

  const actionsHtml = isPending ? `
    <div style="margin-top:28px;">
      ${warnLabel}
      <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;margin-top:16px;">Organizer Notes / Resolution</div>
      <textarea id="org-notes" rows="3" placeholder="Write your review notes here..."
        style="width:100%;background:#1e293b;border:1px solid #334155;color:#f1f5f9;padding:10px 12px;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>

      <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">
        <button onclick="issueWarning('${d.id}')"
          style="flex:1;min-width:140px;padding:12px;background:#fb923c;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
          ⚠️ Give Warning (${warnCount}/2)
        </button>
        <button onclick="resolveDispute('${d.id}')"
          style="flex:1;min-width:140px;padding:12px;background:#22c55e;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
          ✔ Resolve Dispute
        </button>
        <button onclick="showEscalatePanel('${d.id}')"
          style="${teamDispute ? 'display:none;' : ''}flex:1;min-width:160px;padding:12px;background:none;border:1px solid #fb923c;color:#fb923c;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
          🔺 Escalate to Admin
        </button>
      </div>

      <!-- Escalate sub-panel (hidden by default) -->
      <div id="escalate-panel-${d.id}" style="display:none;${teamDispute ? 'visibility:hidden;' : ''}margin-top:16px;background:#1e293b;border:1px solid #fb923c33;border-radius:10px;padding:16px;">
        <p style="margin:0 0 12px;color:#fb923c;font-size:13px;font-weight:600;">Escalation to Platform Admin</p>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:14px;">
          <input type="checkbox" id="ban-request-${d.id}" style="width:16px;height:16px;accent-color:#f87171;">
          <span style="color:#f87171;font-size:13px;">Request platform ban for offending player</span>
        </label>
        <button onclick="escalateDispute('${d.id}')"
          style="width:100%;padding:12px;background:#fb923c;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
          Confirm Escalation
        </button>
      </div>
    </div>` : (isEscalated ? `
    <div style="margin-top:20px;background:rgba(251,146,60,0.1);border:1px solid #fb923c44;border-radius:8px;padding:16px;">
      <p style="margin:0 0 6px;color:#fb923c;font-size:13px;font-weight:600;">🔺 Escalated to Platform Admin</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;">Organizer Notes: ${d.organizerNotes || '—'}</p>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Ban Requested: <strong style="color:${d.banRequested ? '#f87171' : '#94a3b8'}">${d.banRequested ? 'Yes' : 'No'}</strong></p>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Warnings Issued: <strong>${d.organizerWarnings || 0}</strong></p>
    </div>` : `
    <div style="margin-top:20px;background:rgba(34,197,94,0.1);border:1px solid #22c55e44;border-radius:8px;padding:16px;">
      <p style="margin:0 0 6px;color:#22c55e;font-size:13px;font-weight:600;">✔ Resolved</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;">Notes: ${d.organizerNotes || d.adminNotes || '—'}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:12px;">Resolved by: ${d.resolvedBy || 'Organizer'}</p>
    </div>`);

  panel.innerHTML = `
    <div style="padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">DISPUTE ID</div>
          <div style="color:#f1f5f9;font-size:16px;font-weight:700;">#${d.id.slice(-12)}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">CATEGORY</div>
          <div style="color:#c6ff33;font-size:14px;font-weight:600;">${targetLabel}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div style="background:#1e293b;border-radius:8px;padding:12px;">
          <div style="color:#64748b;font-size:11px;margin-bottom:4px;">FILED BY</div>
          <div style="color:#f1f5f9;font-size:14px;">${d.reportedBy || 'Player'}</div>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:12px;">
          <div style="color:#64748b;font-size:11px;margin-bottom:4px;">AGAINST</div>
          <div style="color:#f1f5f9;font-size:14px;">${d.targetUserOrTeam || '—'}</div>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:12px;grid-column:span 2;">
          <div style="color:#64748b;font-size:11px;margin-bottom:4px;">FILED ON</div>
          <div style="color:#f1f5f9;font-size:14px;">${new Date(d.createdAt).toLocaleString()}</div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="color:#94a3b8;font-size:13px;margin-bottom:8px;">Reason</div>
        <div style="background:#1e293b;border-radius:8px;padding:14px;color:#cbd5e1;font-size:14px;line-height:1.6;">${d.reason}</div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="color:#94a3b8;font-size:13px;margin-bottom:8px;">Evidence</div>
        <div style="background:#1e293b;border-radius:8px;padding:14px;">${evidenceHtml}</div>
      </div>

      ${actionsHtml}
    </div>`;

  if (teamDispute) {
    const warningButton = panel.querySelector(`button[onclick="issueWarning('${d.id}')"]`);
    if (warningButton) warningButton.textContent = `Give Warning (${warnCount}/3)`;
  }
}

function issueWarning(id) {
  const notes = (document.getElementById('org-notes') || {}).value || '';
  if (!notes.trim() || notes.trim().length < 5) {
    if (typeof showToast === 'function') showToast('Please enter a reason for the warning (min. 5 characters).', 'error');
    return;
  }

  const result = window.NexusData.issueOrganizerWarning(id, notes.trim());
  if (!result) {
    if (typeof showToast === 'function') showToast('Failed to issue warning.', 'error');
    return;
  }

  if (result.autoBanned) {
    if (typeof showToast === 'function') showToast(`Team "${result.dispute.targetUserOrTeam}" has been banned from this tournament after 3 warnings.`, 'error');
  } else if (result.autoEscalated) {
    if (typeof showToast === 'function') showToast(`⚠ Warning #${result.warningCount} issued. Dispute auto-escalated to Platform Admin with ban request!`, 'warning');
  } else if (isTeamDispute(result.dispute)) {
    const nextText = result.warningCount >= 2 ? 'Next warning will ban this team from the tournament.' : 'Team dispute remains with the organizer.';
    if (typeof showToast === 'function') showToast(`Warning #${result.warningCount}/3 issued to "${result.dispute.targetUserOrTeam}". ${nextText}`);
  } else {
    if (typeof showToast === 'function') showToast(`⚠ Warning #${result.warningCount}/2 issued to "${result.dispute.targetUserOrTeam}". One more warning will auto-escalate to Admin.`);
  }

  // Refresh data
  const params = new URLSearchParams(window.location.search);
  const compId = params.get('id');
  allDisputes = loadOrganizerDisputes(compId);
  renderStats();
  openDispute(id);
}

function resolveDispute(id) {
  const notes = (document.getElementById('org-notes') || {}).value || '';
  if (!notes.trim() || notes.trim().length < 5) {
    if (typeof showToast === 'function') showToast('Please enter resolution notes (min. 5 characters).', 'error');
    return;
  }
  const sessionRaw = localStorage.getItem('nexus.auth.session');
  let username = 'organizer';
  try { const s = JSON.parse(sessionRaw); username = s?.username || s?.displayName || 'organizer'; } catch(e) {}

  window.NexusData.updateDisputeStatus(id, {
    status: 'resolved',
    organizerNotes: notes,
    resolvedBy: username,
  });
  // Refresh
  location.reload();
  if (typeof showToast === 'function') showToast('Dispute resolved successfully!');
}

function showEscalatePanel(id) {
  const panel = document.getElementById(`escalate-panel-${id}`);
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function escalateDispute(id) {
  const notes = (document.getElementById('org-notes') || {}).value || '';
  const banRequested = document.getElementById(`ban-request-${id}`)?.checked || false;

  window.NexusData.updateDisputeStatus(id, {
    status: 'escalated_to_admin',
    organizerNotes: notes,
    banRequested,
  });
  location.reload();
  if (typeof showToast === 'function') showToast(banRequested ? 'Escalated with ban request!' : 'Escalated to Platform Admin.');
}

function setupControls() {
  const statusFilter = document.getElementById('disputes-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => { disFilter = statusFilter.value; renderList(); });
  }
  const search = document.getElementById('disputes-search');
  if (search) {
    search.addEventListener('input', () => { disSearch = search.value.toLowerCase(); renderList(); });
  }
}

// Expose for inline onclick
window.openDispute = openDispute;
window.resolveDispute = resolveDispute;
window.showEscalatePanel = showEscalatePanel;
window.escalateDispute = escalateDispute;
window.issueWarning = issueWarning;
