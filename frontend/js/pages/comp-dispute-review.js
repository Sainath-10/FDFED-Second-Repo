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
  const pending = comp.disputes.filter(d => d.status === 'awaiting').length;
  const resolved = comp.disputes.filter(d => d.status === 'resolved').length;
  document.getElementById('disputes-stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">LEAGUE</div><div class="stat-val-text">${comp.name}</div></div>
    <div class="stat-card"><div class="stat-label">TITLE</div><div class="stat-val-text">🎮 ${comp.game}</div></div>
    <div class="stat-card"><div class="stat-label">MATCHES</div><div class="stat-big">${comp.totalMatches}</div></div>
    <div class="stat-card"><div class="stat-label">TOTAL DISPUTES</div><div class="stat-big">${total}</div></div>
    <div class="stat-card stat-card-highlight"><div class="stat-label">PENDING</div><div class="stat-big stat-accent">${pending}</div></div>
  `;
}

function getFiltered() {
  return comp.disputes.filter(d => {
    const ms = disFilter === 'all' || d.status === disFilter;
    const mq = !disSearch || d.title.toLowerCase().includes(disSearch) || d.submitter.toLowerCase().includes(disSearch) || d.id.toLowerCase().includes(disSearch);
    return ms && mq;
  });
}

function renderList() {
  const filtered = getFiltered();
  if (!filtered.length) {
    document.getElementById('disputes-list-panel').innerHTML = `<div class="empty-state">No disputes found.</div>`;
    return;
  }
  document.getElementById('disputes-list-panel').innerHTML = filtered.map(d => {
    const isActive = d.status !== 'resolved';
    const statusBadge = isActive
      ? `<span class="sm-status-badge sm-awaiting">AWAITING REVIEW</span>`
      : `<span class="sm-status-badge sm-completed">RESOLVED</span>`;
    const active = d.id === activeDisputeId ? 'dispute-row-active' : '';
    return `
      <div class="dispute-list-row ${active}" onclick="openDispute('${d.id}')">
        <div class="dispute-row-id">#${d.id}</div>
        <div class="dispute-row-info">
          <div class="dispute-row-title">${d.title}</div>
          <div class="dispute-row-meta">Submitter: ${d.submitter} • ${d.time}</div>
          <div class="dispute-row-reason">${d.reason}</div>
        </div>
        ${statusBadge}
      </div>`;
  }).join('');
}

window.openDispute = function(disputeId) {
  activeDisputeId = disputeId;
  renderList(); // re-highlight active
  const d = comp.disputes.find(x => x.id === disputeId);
  if (!d) return;

  const isActive = d.status !== 'resolved';
  const panel = document.getElementById('dispute-detail-panel');
  panel.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-id">DISPUTE #${d.id}</div>
        <div class="detail-session">ACTIVE REVIEW SESSION</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c6ff33" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    </div>

    ${d.round ? `
    <div class="detail-section">
      <div class="detail-section-label">MATCH CONTEXT</div>
      <div class="detail-match-context">
        <div class="context-top">
          <span>${d.round}</span>
          <span class="context-date">${d.roundDate}</span>
        </div>
        <div class="context-score">
          <div class="context-team">
            <span>${d.team1}</span>
            <span class="context-score-val">${d.score1}</span>
          </div>
          <span class="context-vs">vs</span>
          <div class="context-team">
            <span>${d.team2}</span>
            <span class="context-score-val">${d.score2}</span>
          </div>
        </div>
      </div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-section-label">DISPUTE REASON</div>
      <div class="detail-reason-box">
        <div class="detail-reason-title">"${d.title}"</div>
        <p class="detail-reason-body">${d.detail || d.reason}</p>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-label">EVIDENCE ATTACHED (${d.evidence || 3})</div>
      <div class="evidence-thumbs">
        <div class="evidence-thumb evidence-img">IMG</div>
        <div class="evidence-thumb evidence-img">IMG</div>
        <div class="evidence-thumb evidence-doc">DOC</div>
      </div>
    </div>

    ${isActive ? `
    <div class="detail-actions">
      <button class="detail-btn detail-btn-approve" onclick="resolveAction('${comp.id}','${d.id}','approve')">APPROVE DISPUTE</button>
      <button class="detail-btn detail-btn-reject"  onclick="resolveAction('${comp.id}','${d.id}','reject')">REJECT DISPUTE</button>
    </div>
    <button class="detail-btn-full detail-btn-update" onclick="alert('Update match result')">UPDATE MATCH RESULT</button>
    <button class="detail-btn-outline" onclick="alert('Request more info')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      REQUEST MORE INFO
    </button>` : `
    <div class="detail-resolved-notice">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c6ff33" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      This dispute has been resolved.
    </div>`}
  `;
};

window.resolveAction = function(compId, disputeId, action) {
  const c = window.NexusData.getCompetitionById(compId);
  if (!c) return;
  const d = c.disputes.find(x => x.id === disputeId);
  if (d) {
    d.status = 'resolved';
    window.NexusData.updateCompetition(c);
    comp = c;
    renderStats(); renderList();
    openDispute(disputeId);
    alert(`Dispute #${disputeId} has been ${action === 'approve' ? 'approved' : 'rejected'} and marked as resolved.`);
  }
};

function setupControls() {
  document.getElementById('disputes-search').addEventListener('input', e => { disSearch = e.target.value.toLowerCase().trim(); renderList(); });
  document.getElementById('disputes-status-filter').addEventListener('change', e => { disFilter = e.target.value; renderList(); });
}
