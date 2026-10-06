import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusData } from '../services/competitionService';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/subpage.css';

function isTeamDispute(d) {
  return d && (d.targetType === 'team' || d.targetType === 'opponent_team');
}

export default function CompDisputeReviewPage() {
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('id') || 'comp-1';
  const preselect = searchParams.get('dispute');
  const { showToast } = useToast();

  const [comp, setComp] = useState(null);
  const [allDisputes, setAllDisputes] = useState([]);
  const [activeDisputeId, setActiveDisputeId] = useState(null);
  const [disFilter, setDisFilter] = useState('all');
  const [disSearch, setDisSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const [orgNotes, setOrgNotes] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);
  const [banRequested, setBanRequested] = useState(false);

  const loadOrganizerDisputes = (cId) => {
    const disputes = NexusData.loadDisputes ? NexusData.loadDisputes() : [];
    let changed = false;

    disputes.forEach(d => {
      if (d.competitionId === cId && isTeamDispute(d) && d.status === 'escalated_to_admin') {
        d.status = 'open_organizer';
        d.escalated = false;
        d.superAdminState = '';
        d.escalatedReason = '';
        d.escalationReason = '';
        changed = true;
      }
    });

    if (changed && NexusData.saveDisputes) {
      NexusData.saveDisputes(disputes);
    }

    return disputes.filter(d =>
      d.competitionId === cId &&
      (d.status === 'open_organizer' || d.status === 'under_review' || d.status === 'resolved' || d.status === 'escalated_to_admin')
    );
  };

  const refreshData = () => {
    const loadedComp = NexusData.getCompetitionById(compId) || {
      id: compId,
      name: 'Competition',
      game: '—',
      disputes: []
    };
    setComp(loadedComp);

    const loadedDisputes = loadOrganizerDisputes(compId);
    setAllDisputes(loadedDisputes);
  };

  useEffect(() => {
    refreshData();
    if (preselect) {
      setActiveDisputeId(preselect);
    }
  }, [compId, preselect]);

  if (!comp) return null;

  const total = allDisputes.length;
  const pending = allDisputes.filter(d => d.status === 'open_organizer' || d.status === 'under_review').length;
  const resolved = allDisputes.filter(d => d.status === 'resolved').length;
  const escalated = allDisputes.filter(d => d.status === 'escalated_to_admin').length;
  const orgs = Array.isArray(comp.organizers) && comp.organizers.length > 0
    ? comp.organizers.join(', ')
    : (comp.createdBy || comp.organizerId || 'Organizer');

  const getFilteredDisputes = () => {
    return allDisputes
      .filter(d => {
        const isPending = d.status === 'open_organizer' || d.status === 'under_review';
        const isEscalated = d.status === 'escalated_to_admin';
        const statusMatch =
          disFilter === 'all' ||
          (disFilter === 'awaiting' && isPending) ||
          (disFilter === 'resolved' && d.status === 'resolved') ||
          (disFilter === 'escalated' && isEscalated);

        const searchTarget = [d.reason, d.reportedBy, d.targetUserOrTeam, d.id].filter(Boolean).join(' ').toLowerCase();
        const queryMatch = !disSearch || searchTarget.includes(disSearch.toLowerCase());
        return statusMatch && queryMatch;
      })
      .sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return sortOrder === 'newest' ? tB - tA : tA - tB;
      });
  };

  const filteredDisputes = getFilteredDisputes();
  const activeDispute = allDisputes.find(x => x.id === activeDisputeId);

  const handleIssueWarning = (dId) => {
    if (!orgNotes.trim() || orgNotes.trim().length < 5) {
      showToast('Please enter a reason for the warning (min. 5 characters).', 'error');
      return;
    }

    const result = NexusData.issueOrganizerWarning(dId, orgNotes.trim());
    if (!result) {
      showToast('Failed to issue warning.', 'error');
      return;
    }

    if (result.autoBanned) {
      showToast(`Team "${result.dispute.targetUserOrTeam}" has been banned from this tournament after 3 warnings.`, 'error');
    } else if (result.autoEscalated) {
      showToast(`⚠ Warning #${result.warningCount} issued. Dispute auto-escalated to Platform Admin with ban request!`, 'warning');
    } else if (isTeamDispute(result.dispute)) {
      const nextText = result.warningCount >= 2 ? 'Next warning will ban this team from the tournament.' : 'Team dispute remains with the organizer.';
      showToast(`Warning #${result.warningCount}/3 issued to "${result.dispute.targetUserOrTeam}". ${nextText}`);
    } else {
      showToast(`⚠ Warning #${result.warningCount}/2 issued to "${result.dispute.targetUserOrTeam}". One more warning will auto-escalate to Admin.`);
    }

    setOrgNotes('');
    refreshData();
  };

  const handleResolveDispute = (dId) => {
    if (!orgNotes.trim() || orgNotes.trim().length < 5) {
      showToast('Please enter resolution notes (min. 5 characters).', 'error');
      return;
    }
    const sessionRaw = localStorage.getItem('nexus.auth.session');
    let username = 'organizer';
    try {
      const s = JSON.parse(sessionRaw);
      username = s?.username || s?.displayName || 'organizer';
    } catch (e) {}

    NexusData.updateDisputeStatus(dId, {
      status: 'resolved',
      organizerNotes: orgNotes.trim(),
      resolvedBy: username
    });

    showToast('Dispute resolved successfully!');
    setOrgNotes('');
    refreshData();
  };

  const handleEscalateDispute = (dId) => {
    NexusData.updateDisputeStatus(dId, {
      status: 'escalated_to_admin',
      organizerNotes: orgNotes.trim(),
      banRequested
    });

    showToast(banRequested ? 'Escalated with ban request!' : 'Escalated to Platform Admin.');
    setOrgNotes('');
    setShowEscalate(false);
    refreshData();
  };

  const getTargetLabel = (targetType) => {
    const map = {
      team: '⚔ Team',
      player: '👤 Player',
      opponent_team: '⚔ Opponent/Team',
      match_rule: '📋 Match Rule',
      organizer: '⚠ Organizer'
    };
    return map[targetType] || targetType;
  };

  return (
    <Shell activeTab="activity">
      <main className="sub-main">
          <div className="sub-page-header">
            <div className="sub-header-content">
              <h1 className="sub-page-title">Dispute Review</h1>
              <p className="sub-page-subtitle">Review and resolve match disputes submitted by teams</p>
            </div>
            <Link to={`/competition-detail?id=${comp.id}`} className="btn-back" id="btn-back-to-comp">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="10" y1="3" x2="4" y2="8" />
                <line x1="4" y1="8" x2="10" y2="13" />
              </svg>
              Back to Dashboard
            </Link>
          </div>

          <div className="disputes-stats-row" id="disputes-stats-row">
            <div className="stat-card">
              <div className="stat-label">COMPETITION</div>
              <div className="stat-val-text">{comp.name}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">ORGANIZERS</div>
              <div className="stat-val-text">👥 {orgs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">TOTAL</div>
              <div className="stat-big">{total}</div>
            </div>
            <div className="stat-card stat-card-highlight">
              <div className="stat-label">PENDING REVIEW</div>
              <div className="stat-big stat-accent">{pending}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">ESCALATED</div>
              <div className="stat-big" style={{ color: '#fb923c' }}>{escalated}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">RESOLVED</div>
              <div className="stat-big" style={{ color: '#60a5fa' }}>{resolved}</div>
            </div>
          </div>

          <div className="results-toolbar">
            <div className="search-box-wrapper search-box-wide">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round">
                <circle cx="9" cy="9" r="6" />
                <line x1="14" y1="14" x2="18" y2="18" />
              </svg>
              <input
                type="text"
                className="sub-search"
                id="disputes-search"
                placeholder="Search dispute ID, match ID, or team name..."
                value={disSearch}
                onChange={(e) => setDisSearch(e.target.value)}
              />
            </div>
            <select
              className="sub-select"
              id="disputes-status-filter"
              value={disFilter}
              onChange={(e) => setDisFilter(e.target.value)}
            >
              <option value="all">Status: All</option>
              <option value="awaiting">Awaiting Review</option>
              <option value="escalated">Escalated to Admin</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              className="sub-select"
              id="disputes-sort"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
            </select>
          </div>

          <div className="disputes-body">
            <div className="disputes-list-panel" id="disputes-list-panel">
              {filteredDisputes.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No disputes in your queue.
                </div>
              ) : (
                filteredDisputes.map(d => {
                  const isPending = d.status === 'open_organizer' || d.status === 'under_review';
                  const warnCount = d.organizerWarnings || 0;
                  const active = d.id === activeDisputeId ? 'dispute-row-active' : '';

                  return (
                    <div
                      key={d.id}
                      className={`dispute-list-row ${active}`}
                      onClick={() => {
                        setActiveDisputeId(d.id);
                        setShowEscalate(false);
                      }}
                    >
                      <div className="dispute-row-id">#{d.id.slice(-8)}</div>
                      <div className="dispute-row-info">
                        <div className="dispute-row-title">
                          {getTargetLabel(d.targetType)} — {d.targetUserOrTeam || 'Unknown'}
                          {warnCount > 0 && (
                            <span style={{ color: '#fb923c', fontSize: '11px', marginLeft: '6px' }}>
                              ⚠{warnCount}
                            </span>
                          )}
                        </div>
                        <div className="dispute-row-meta">
                          Filed by: {d.reportedBy || 'Player'} • {new Date(d.createdAt).toLocaleDateString()}
                        </div>
                        <div className="dispute-row-reason">
                          {(d.reason || '').slice(0, 80)}{(d.reason || '').length > 80 ? '…' : ''}
                        </div>
                      </div>
                      {isPending && <span className="sm-status-badge sm-awaiting">AWAITING REVIEW</span>}
                      {d.status === 'resolved' && <span className="sm-status-badge sm-completed">RESOLVED</span>}
                      {d.status === 'escalated_to_admin' && (
                        <span className="sm-status-badge" style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid #fb923c' }}>
                          ESCALATED TO ADMIN
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="dispute-detail-panel" id="dispute-detail-panel">
              {!activeDispute ? (
                <div className="detail-empty-state">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2a3a4a" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <p>Select a dispute to review</p>
                </div>
              ) : (
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>DISPUTE ID</div>
                      <div style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 700 }}>#{activeDispute.id.slice(-12)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>CATEGORY</div>
                      <div style={{ color: '#c6ff33', fontSize: '14px', fontWeight: 600 }}>
                        {getTargetLabel(activeDispute.targetType)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>FILED BY</div>
                      <div style={{ color: '#f1f5f9', fontSize: '14px' }}>{activeDispute.reportedBy || 'Player'}</div>
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>AGAINST</div>
                      <div style={{ color: '#f1f5f9', fontSize: '14px' }}>{activeDispute.targetUserOrTeam || '—'}</div>
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '12px', gridColumn: 'span 2' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>FILED ON</div>
                      <div style={{ color: '#f1f5f9', fontSize: '14px' }}>{new Date(activeDispute.createdAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>Reason</div>
                    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px', color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6 }}>
                      {activeDispute.reason}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>Evidence</div>
                    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px' }}>
                      {(activeDispute.evidenceUrls || []).length > 0 ? (
                        activeDispute.evidenceUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#c6ff33', fontSize: '13px', display: 'block', wordBreak: 'break-all' }}
                          >
                            {url}
                          </a>
                        ))
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '13px' }}>No evidence provided</span>
                      )}
                    </div>
                  </div>

                  {/* Actions / Status display */}
                  {(activeDispute.status === 'open_organizer' || activeDispute.status === 'under_review') ? (
                    <div style={{ marginTop: '28px' }}>
                      {activeDispute.organizerWarnings > 0 && (
                        <div style={{ marginTop: '8px', background: 'rgba(251,146,60,0.1)', border: '1px solid #fb923c44', borderRadius: '8px', padding: '10px' }}>
                          <span style={{ color: '#fb923c', fontSize: '13px', fontWeight: 600 }}>
                            {isTeamDispute(activeDispute)
                              ? `Organizer Warnings Issued: ${activeDispute.organizerWarnings}/3`
                              : `⚠ Organizer Warnings Issued: ${activeDispute.organizerWarnings}/2`}
                          </span>
                          <span style={{ color: '#f87171', fontSize: '12px', marginLeft: '8px' }}>
                            {isTeamDispute(activeDispute)
                              ? (activeDispute.organizerWarnings >= 3
                                ? 'Team banned from this tournament.'
                                : activeDispute.organizerWarnings === 2
                                ? 'Next warning bans this team from the tournament.'
                                : 'Team dispute remains with the organizer.')
                              : (activeDispute.organizerWarnings >= 2 ? 'Auto-escalated to Admin!' : '')}
                          </span>
                        </div>
                      )}

                      <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', marginTop: '16px' }}>
                        Organizer Notes / Resolution
                      </div>
                      <textarea
                        rows="3"
                        placeholder="Write your review notes here..."
                        value={orgNotes}
                        onChange={(e) => setOrgNotes(e.target.value)}
                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                      />

                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleIssueWarning(activeDispute.id)}
                          style={{ flex: 1, minWidth: '140px', padding: '12px', background: '#fb923c', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                        >
                          ⚠️ Give Warning ({activeDispute.organizerWarnings || 0}/{isTeamDispute(activeDispute) ? 3 : 2})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveDispute(activeDispute.id)}
                          style={{ flex: 1, minWidth: '140px', padding: '12px', background: '#22c55e', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                        >
                          ✔ Resolve Dispute
                        </button>
                        {!isTeamDispute(activeDispute) && (
                          <button
                            type="button"
                            onClick={() => setShowEscalate(!showEscalate)}
                            style={{ flex: 1, minWidth: '160px', padding: '12px', background: 'none', border: '1px solid #fb923c', color: '#fb923c', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                          >
                            🔺 Escalate to Admin
                          </button>
                        )}
                      </div>

                      {showEscalate && !isTeamDispute(activeDispute) && (
                        <div style={{ marginTop: '16px', background: '#1e293b', border: '1px solid #fb923c33', borderRadius: '10px', padding: '16px' }}>
                          <p style={{ margin: '0 0 12px', color: '#fb923c', fontSize: '13px', fontWeight: 600 }}>Escalation to Platform Admin</p>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '14px' }}>
                            <input
                              type="checkbox"
                              checked={banRequested}
                              onChange={(e) => setBanRequested(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: '#f87171' }}
                            />
                            <span style={{ color: '#f87171', fontSize: '13px' }}>Request platform ban for offending player</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleEscalateDispute(activeDispute.id)}
                            style={{ width: '100%', padding: '12px', background: '#fb923c', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                          >
                            Confirm Escalation
                          </button>
                        </div>
                      )}
                    </div>
                  ) : activeDispute.status === 'escalated_to_admin' ? (
                    <div style={{ marginTop: '20px', background: 'rgba(251,146,60,0.1)', border: '1px solid #fb923c44', borderRadius: '8px', padding: '16px' }}>
                      <p style={{ margin: '0 0 6px', color: '#fb923c', fontSize: '13px', fontWeight: 600 }}>🔺 Escalated to Platform Admin</p>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>Organizer Notes: {activeDispute.organizerNotes || '—'}</p>
                      <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '13px' }}>
                        Ban Requested: <strong style={{ color: activeDispute.banRequested ? '#f87171' : '#94a3b8' }}>{activeDispute.banRequested ? 'Yes' : 'No'}</strong>
                      </p>
                      <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '13px' }}>
                        Warnings Issued: <strong>{activeDispute.organizerWarnings || 0}</strong>
                      </p>
                    </div>
                  ) : (
                    <div style={{ marginTop: '20px', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e44', borderRadius: '8px', padding: '16px' }}>
                      <p style={{ margin: '0 0 6px', color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>✔ Resolved</p>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>Notes: {activeDispute.organizerNotes || activeDispute.adminNotes || '—'}</p>
                      <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12px' }}>Resolved by: {activeDispute.resolvedBy || 'Organizer'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
    </Shell>
  );
}
