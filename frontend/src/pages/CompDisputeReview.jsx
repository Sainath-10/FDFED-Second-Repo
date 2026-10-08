/**
 * NEXUS ESPORTS — Organizer Dispute Review
 *
 * the organizer
 * queue (open_organizer / under_review / escalated / resolved), the dispute detail
 * panel, and the warn / resolve / escalate-to-admin actions.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/subpage.css';

const isTeamDispute = (d) => !!(d && (d.targetType === 'team' || d.targetType === 'opponent_team'));
const LIST_TARGET = { team: '⚔ Team', player: '👤 Player', opponent_team: '⚔ Opponent/Team', match_rule: '📋 Match Rule', organizer: '⚠ Organizer' };
const DETAIL_TARGET = { team: '⚔ Team Dispute', player: '👤 Player Dispute', opponent_team: '⚔ Opponent / Team Issue', match_rule: '📋 Match Rule Violation', organizer: '⚠ Organizer Misconduct' };

function loadOrganizerDisputes(compId) {
  const disputes = NexusData.loadDisputes() || [];
  let changed = false;
  disputes.forEach((d) => {
    if (d.competitionId === compId && isTeamDispute(d) && d.status === 'escalated_to_admin') {
      d.status = 'open_organizer';
      d.escalated = false;
      d.superAdminState = '';
      d.escalatedReason = '';
      d.escalationReason = '';
      changed = true;
    }
  });
  if (changed && typeof NexusData.saveDisputes === 'function') NexusData.saveDisputes(disputes);
  return disputes.filter((d) => d.competitionId === compId
    && ['open_organizer', 'under_review', 'resolved', 'escalated_to_admin'].includes(d.status));
}

export default function CompDisputeReview() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const id = params.get('id') || '';
  const preselect = params.get('dispute');

  const [allDisputes, setAllDisputes] = useState(() => (id && NexusData ? loadOrganizerDisputes(id) : []));
  const [activeId, setActiveId] = useState(preselect || null);
  const [disFilter, setDisFilter] = useState('all');
  const [disSearch, setDisSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [banRequested, setBanRequested] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);

  const comp = (id && NexusData ? NexusData.getCompetitionById(id) : null) || { id, name: 'Competition', game: '—', disputes: [] };

  useEffect(() => {
    if (!session) return;
    setAllDisputes(loadOrganizerDisputes(id));
  }, [id, session]);

  function refresh(keepId) {
    setAllDisputes(loadOrganizerDisputes(id));
    if (keepId) setActiveId(keepId);
  }

  function openDispute(disputeId) {
    setActiveId(disputeId);
    setNotes('');
    setBanRequested(false);
    setShowEscalate(false);
  }

  const total = allDisputes.length;
  const pendingCount = allDisputes.filter((d) => d.status === 'open_organizer' || d.status === 'under_review').length;
  const resolvedCount = allDisputes.filter((d) => d.status === 'resolved').length;
  const escalatedCount = allDisputes.filter((d) => d.status === 'escalated_to_admin').length;
  const orgs = Array.isArray(comp.organizers) && comp.organizers.length > 0 ? comp.organizers.join(', ') : (comp.createdBy || comp.organizerId || 'Organizer');

  const filtered = allDisputes.filter((d) => {
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

  const d = activeId ? allDisputes.find((x) => x.id === activeId) : null;
  const isPending = d && (d.status === 'open_organizer' || d.status === 'under_review');
  const isEscalated = d && d.status === 'escalated_to_admin';
  const teamDispute = d ? isTeamDispute(d) : false;
  const warnCount = d ? (d.organizerWarnings || 0) : 0;

  function issueWarning() {
    if (!notes.trim() || notes.trim().length < 5) { showToast('Please enter a reason for the warning (min. 5 characters).', 'error'); return; }
    const result = NexusData.issueOrganizerWarning(d.id, notes.trim());
    if (!result) { showToast('Failed to issue warning.', 'error'); return; }
    if (result.autoBanned) showToast(`Team "${result.dispute.targetUserOrTeam}" has been banned from this tournament after 3 warnings.`, 'error');
    else if (result.autoEscalated) showToast(`⚠ Warning #${result.warningCount} issued. Dispute auto-escalated to Platform Admin with ban request!`, 'warning');
    else if (isTeamDispute(result.dispute)) {
      const nextText = result.warningCount >= 2 ? 'Next warning will ban this team from the tournament.' : 'Team dispute remains with the organizer.';
      showToast(`Warning #${result.warningCount}/3 issued to "${result.dispute.targetUserOrTeam}". ${nextText}`);
    } else {
      showToast(`⚠ Warning #${result.warningCount}/2 issued to "${result.dispute.targetUserOrTeam}". One more warning will auto-escalate to Admin.`);
    }
    refresh(d.id);
  }

  function resolveDispute() {
    if (!notes.trim() || notes.trim().length < 5) { showToast('Please enter resolution notes (min. 5 characters).', 'error'); return; }
    const username = (session && (session.username || session.displayName)) || 'organizer';
    NexusData.updateDisputeStatus(d.id, { status: 'resolved', organizerNotes: notes, resolvedBy: username });
    showToast('Dispute resolved successfully!');
    refresh(d.id);
  }

  function escalateDispute() {
    NexusData.updateDisputeStatus(d.id, { status: 'escalated_to_admin', organizerNotes: notes, banRequested });
    showToast(banRequested ? 'Escalated with ban request!' : 'Escalated to Platform Admin.');
    refresh(d.id);
  }

  let detailActions = null;
  if (d && isPending) {
    let warnLabel = null;
    if (warnCount > 0 && !teamDispute) {
      warnLabel = (
        <div style={{ marginTop: 8, background: 'rgba(251,146,60,0.1)', border: '1px solid #fb923c44', borderRadius: 8, padding: 10 }}>
          <span style={{ color: '#fb923c', fontSize: 13, fontWeight: 600 }}>⚠ Organizer Warnings Issued: {warnCount}/2</span>
          {warnCount >= 2 && <span style={{ color: '#f87171', fontSize: 12, marginLeft: 8 }}>Auto-escalated to Admin!</span>}
        </div>
      );
    } else if (warnCount > 0 && teamDispute) {
      const hint = warnCount >= 3 ? 'Team banned from this tournament.' : (warnCount === 2 ? 'Next warning bans this team from the tournament.' : 'Team dispute remains with the organizer.');
      warnLabel = (
        <div style={{ marginTop: 8, background: 'rgba(251,146,60,0.1)', border: '1px solid #fb923c44', borderRadius: 8, padding: 10 }}>
          <span style={{ color: '#fb923c', fontSize: 13, fontWeight: 600 }}>Organizer Warnings Issued: {warnCount}/3</span>
          <span style={{ color: '#f87171', fontSize: 12, marginLeft: 8 }}>{hint}</span>
        </div>
      );
    }

    detailActions = (
      <div style={{ marginTop: 28 }}>
        {warnLabel}
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8, marginTop: 16 }}>Organizer Notes / Resolution</div>
        <textarea id="org-notes" rows="3" placeholder="Write your review notes here..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={issueWarning} style={{ flex: 1, minWidth: 140, padding: 12, background: '#fb923c', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            ⚠️ Give Warning ({warnCount}/{teamDispute ? 3 : 2})
          </button>
          <button onClick={resolveDispute} style={{ flex: 1, minWidth: 140, padding: 12, background: '#22c55e', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            ✔ Resolve Dispute
          </button>
          {!teamDispute && (
            <button onClick={() => setShowEscalate((v) => !v)} style={{ flex: 1, minWidth: 160, padding: 12, background: 'none', border: '1px solid #fb923c', color: '#fb923c', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              🔺 Escalate to Admin
            </button>
          )}
        </div>
        {!teamDispute && showEscalate && (
          <div style={{ marginTop: 16, background: '#1e293b', border: '1px solid #fb923c33', borderRadius: 10, padding: 16 }}>
            <p style={{ margin: '0 0 12px', color: '#fb923c', fontSize: 13, fontWeight: 600 }}>Escalation to Platform Admin</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
              <input type="checkbox" checked={banRequested} onChange={(e) => setBanRequested(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#f87171' }} />
              <span style={{ color: '#f87171', fontSize: 13 }}>Request platform ban for offending player</span>
            </label>
            <button onClick={escalateDispute} style={{ width: '100%', padding: 12, background: '#fb923c', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Confirm Escalation</button>
          </div>
        )}
      </div>
    );
  } else if (d && isEscalated) {
    detailActions = (
      <div style={{ marginTop: 20, background: 'rgba(251,146,60,0.1)', border: '1px solid #fb923c44', borderRadius: 8, padding: 16 }}>
        <p style={{ margin: '0 0 6px', color: '#fb923c', fontSize: 13, fontWeight: 600 }}>🔺 Escalated to Platform Admin</p>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Organizer Notes: {d.organizerNotes || '—'}</p>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>Ban Requested: <strong style={{ color: d.banRequested ? '#f87171' : '#94a3b8' }}>{d.banRequested ? 'Yes' : 'No'}</strong></p>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>Warnings Issued: <strong>{d.organizerWarnings || 0}</strong></p>
      </div>
    );
  } else if (d) {
    detailActions = (
      <div style={{ marginTop: 20, background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e44', borderRadius: 8, padding: 16 }}>
        <p style={{ margin: '0 0 6px', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>✔ Resolved</p>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Notes: {d.organizerNotes || d.adminNotes || '—'}</p>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>Resolved by: {d.resolvedBy || 'Organizer'}</p>
      </div>
    );
  }

  return (
    <main className="sub-main">
      <div className="sub-page-header">
        <div className="sub-header-content">
          <h1 className="sub-page-title">Dispute Review</h1>
          <p className="sub-page-subtitle">Review and resolve match disputes submitted by teams</p>
        </div>
        <Link className="btn-back" id="btn-back-to-comp" to={`/pages/competition-detail.html?id=${id}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="disputes-stats-row" id="disputes-stats-row">
        <div className="stat-card"><div className="stat-label">COMPETITION</div><div className="stat-val-text">{comp.name}</div></div>
        <div className="stat-card"><div className="stat-label">ORGANIZERS</div><div className="stat-val-text">👥 {orgs}</div></div>
        <div className="stat-card"><div className="stat-label">TOTAL</div><div className="stat-big">{total}</div></div>
        <div className="stat-card stat-card-highlight"><div className="stat-label">PENDING REVIEW</div><div className="stat-big stat-accent">{pendingCount}</div></div>
        <div className="stat-card"><div className="stat-label">ESCALATED</div><div className="stat-big" style={{ color: '#fb923c' }}>{escalatedCount}</div></div>
        <div className="stat-card"><div className="stat-label">RESOLVED</div><div className="stat-big" style={{ color: '#60a5fa' }}>{resolvedCount}</div></div>
      </div>

      <div className="results-toolbar">
        <div className="search-box-wrapper search-box-wide">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round"><circle cx="9" cy="9" r="6" /><line x1="14" y1="14" x2="18" y2="18" /></svg>
          <input type="text" className="sub-search" id="disputes-search" placeholder="Search dispute ID, match ID, or team name..." value={disSearch} onChange={(e) => setDisSearch(e.target.value.toLowerCase())} />
        </div>
        <select className="sub-select" id="disputes-status-filter" value={disFilter} onChange={(e) => setDisFilter(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="awaiting">Awaiting Review</option>
          <option value="escalated">Escalated to Admin</option>
          <option value="resolved">Resolved</option>
        </select>
        <select className="sub-select" id="disputes-sort">
          <option>Sort: Newest</option>
          <option>Sort: Oldest</option>
        </select>
      </div>

      <div className="disputes-body">
        <div className="disputes-list-panel" id="disputes-list-panel">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No disputes in your queue.</div>
          ) : (
            filtered.map((row) => {
              let statusBadge = <span className="sm-status-badge sm-awaiting">AWAITING REVIEW</span>;
              if (row.status === 'resolved') statusBadge = <span className="sm-status-badge sm-completed">RESOLVED</span>;
              else if (row.status === 'escalated_to_admin') statusBadge = <span className="sm-status-badge" style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid #fb923c' }}>ESCALATED TO ADMIN</span>;
              const w = row.organizerWarnings || 0;
              return (
                <div className={`dispute-list-row ${row.id === activeId ? 'dispute-row-active' : ''}`} key={row.id} onClick={() => openDispute(row.id)}>
                  <div className="dispute-row-id">#{String(row.id).slice(-8)}</div>
                  <div className="dispute-row-info">
                    <div className="dispute-row-title">{LIST_TARGET[row.targetType] || row.targetType} — {row.targetUserOrTeam || 'Unknown'}{w > 0 && <span style={{ color: '#fb923c', fontSize: 11 }}> ⚠{w}</span>}</div>
                    <div className="dispute-row-meta">Filed by: {row.reportedBy || 'Player'} • {new Date(row.createdAt).toLocaleDateString()}</div>
                    <div className="dispute-row-reason">{String(row.reason || '').slice(0, 80)}{String(row.reason || '').length > 80 ? '…' : ''}</div>
                  </div>
                  {statusBadge}
                </div>
              );
            })
          )}
        </div>

        <div className="dispute-detail-panel" id="dispute-detail-panel">
          {!d ? (
            <div className="detail-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2a3a4a" strokeWidth="1.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <p>Select a dispute to review</p>
            </div>
          ) : (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>DISPUTE ID</div>
                  <div style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>#{String(d.id).slice(-12)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>CATEGORY</div>
                  <div style={{ color: '#c6ff33', fontSize: 14, fontWeight: 600 }}>{DETAIL_TARGET[d.targetType] || d.targetType}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>FILED BY</div>
                  <div style={{ color: '#f1f5f9', fontSize: 14 }}>{d.reportedBy || 'Player'}</div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>AGAINST</div>
                  <div style={{ color: '#f1f5f9', fontSize: 14 }}>{d.targetUserOrTeam || '—'}</div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 12, gridColumn: 'span 2' }}>
                  <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>FILED ON</div>
                  <div style={{ color: '#f1f5f9', fontSize: 14 }}>{new Date(d.createdAt).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Reason</div>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 14, color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>{d.reason}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Evidence</div>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
                  {(d.evidenceUrls || []).length
                    ? d.evidenceUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url} style={{ color: '#c6ff33', fontSize: 13, display: 'block', wordBreak: 'break-all' }}>{url}</a>)
                    : <span style={{ color: '#64748b', fontSize: 13 }}>No evidence provided</span>}
                </div>
              </div>

              {detailActions}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


