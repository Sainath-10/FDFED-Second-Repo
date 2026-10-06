import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { showToast } from '../components/Common/Toast';
import NexusData from '../services/competitionService';
import NexusAuth from '../services/authService';
import '../styles/pages/competition-detail.css';

function getDefaultBanner(gameName) {
  const g = String(gameName || '').toLowerCase();
  if (g.includes('valorant')) {
    return '/assets/8764f3a5ce7a0eb0275743600c60fb0c727893c8.png';
  }
  if (g.includes('counter-strike') || g.includes('cs2') || g.includes('cs:go') || g.includes('csgo')) {
    return '/assets/c4f97eccde97e10ac89b61ec5fb36fdce0ab2477.png';
  }
  if (g.includes('league of legends') || g.includes('lol')) {
    return '/assets/95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png';
  }
  if (g.includes('apex')) {
    return '/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';
  }
  return '/assets/b890c61489a080992ad7e99adabb1145e6d59606.png';
}

function formatPrizePool(prize) {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) {
    return 'No Prize Pool';
  }
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

export default function CompetitionDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('id');

  const [comp, setComp] = useState(null);
  const [matchPage, setMatchPage] = useState(0);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [newOrgInput, setNewOrgInput] = useState('');

  const loadComp = () => {
    if (!compId) return;
    const found = NexusData.getCompetitionById(compId);
    setComp(found);
  };

  useEffect(() => {
    if (!compId) {
      navigate('/my-activity');
      return;
    }
    loadComp();
  }, [compId]);

  if (!comp) {
    return (
      <Shell activePage="competitions">
        <main className="comp-main">
          <div style={{ padding: '60px 40px', textAlign: 'center', color: '#9aa4b2' }}>
            <h2>Competition Not Found</h2>
            <p>Could not find tournament #{compId}</p>
            <Link to="/competitions" className="btn-primary" style={{ marginTop: 20, display: 'inline-block' }}>
              Browse Competitions
            </Link>
          </div>
        </main>
      </Shell>
    );
  }

  const isEnded = !!(comp.ended || comp.status === 'completed');
  const bannerImg = comp.img || getDefaultBanner(comp.game);
  const heroStyle = bannerImg
    ? { background: `linear-gradient(rgba(10, 15, 20, 0.75), rgba(10, 15, 20, 0.95)), url('${bannerImg}') center/cover no-repeat` }
    : { background: `linear-gradient(135deg, ${comp.bannerColor || '#1a2e1a'} 0%, #0a0a0a 70%)` };

  const statusColors = { ongoing: '#c6ff33', completed: '#9aa4b2', upcoming: '#60a5fa' };
  const teams = Array.isArray(comp.teams) ? comp.teams : [];
  const approvedTeams = teams.filter(t => t.status === 'approved');
  const maxTeams = comp.maxTeams || 16;
  const typeLabel = comp.type === 'tournament' ? 'TOURNAMENT' : 'LEAGUE';

  // Pending disputes count
  let pendingDisputesCount = 0;
  if (NexusData && typeof NexusData.loadDisputes === 'function') {
    const allDisputes = NexusData.loadDisputes();
    pendingDisputesCount = allDisputes.filter(d =>
      d.competitionId === comp.id &&
      (d.status === 'open_organizer' || d.status === 'under_review' || d.status === 'open' || d.status === 'awaiting')
    ).length;
  } else if (Array.isArray(comp.disputes)) {
    pendingDisputesCount = comp.disputes.filter(d =>
      d.status === 'open_organizer' || d.status === 'under_review' || d.status === 'open' || d.status === 'awaiting'
    ).length;
  }

  // Matches pagination
  const matches = Array.isArray(comp.matches) ? comp.matches : [];
  const MATCHES_PER_PAGE = 3;
  const matchSlice = matches.slice(matchPage * MATCHES_PER_PAGE, (matchPage + 1) * MATCHES_PER_PAGE);

  const handleApproveTeam = (teamId) => {
    if (isEnded) {
      showToast('Competition has ended — team approvals are locked.', 'error');
      return;
    }
    const session = NexusAuth.getSession();
    const by = session?.username || 'organizer';

    if (NexusData && typeof NexusData.setTeamRegistrationStatus === 'function') {
      NexusData.setTeamRegistrationStatus(comp.id, teamId, 'approved', by);
    } else {
      const t = comp.teams.find(item => item.id === teamId);
      if (t) {
        t.status = 'approved';
        NexusData.updateCompetition(comp);
      }
    }
    loadComp();
    showToast('Team approved successfully!', 'success');
  };

  const handleRejectTeam = (teamId) => {
    if (isEnded) {
      showToast('Competition has ended — team approvals are locked.', 'error');
      return;
    }
    const session = NexusAuth.getSession();
    const by = session?.username || 'organizer';

    if (NexusData && typeof NexusData.setTeamRegistrationStatus === 'function') {
      NexusData.setTeamRegistrationStatus(comp.id, teamId, 'rejected', by);
    } else {
      const t = comp.teams.find(item => item.id === teamId);
      if (t) {
        t.status = 'rejected';
        NexusData.updateCompetition(comp);
      }
    }
    loadComp();
    showToast('Team registration rejected.', 'error');
  };

  const handleAddOrganizer = () => {
    const cleanOrg = newOrgInput.trim().replace(/^@/, '');
    if (!cleanOrg) {
      showToast('Please enter an organizer username or ID.', 'error');
      return;
    }

    if (NexusData && typeof NexusData.addCoOrganizer === 'function') {
      const res = NexusData.addCoOrganizer(comp.id, cleanOrg);
      if (!res.ok) {
        showToast(res.error || 'Unable to add organizer.', 'error');
        return;
      }
    }

    setNewOrgInput('');
    loadComp();
    showToast(`Co-Organizer @${cleanOrg} added successfully!`, 'success');
  };

  const handleRemoveOrganizer = (orgId) => {
    if (NexusData && typeof NexusData.removeCoOrganizer === 'function') {
      const res = NexusData.removeCoOrganizer(comp.id, orgId);
      if (!res.ok) {
        showToast(res.error || 'Unable to remove organizer.', 'error');
        return;
      }
    }
    loadComp();
    showToast(`Co-Organizer @${orgId} removed.`, 'success');
  };

  const creator = comp.createdBy || comp.organizerId || 'Primary Organizer';
  const orgList = Array.isArray(comp.organizers) && comp.organizers.length > 0
    ? Array.from(new Set([creator, ...comp.organizers]))
    : [creator];

  const hasEntryFee = comp.feeType && comp.feeType !== 'free' && Number(comp.entryFeeAmount || 0) > 0;

  return (
    <Shell activePage="competitions">
      <main className="comp-main" id="comp-main">
        {/* HERO */}
        <div className="comp-hero" id="comp-hero" style={heroStyle}>
          <div className="comp-hero-content">
            <div className="comp-hero-tags">
              <span className="hero-tag hero-tag-status" style={{ color: statusColors[comp.status] || '#c6ff33' }}>
                {(comp.status || 'ongoing').toUpperCase()}
              </span>
              <span className="hero-tag-sep">•</span>
              <span className="hero-tag hero-tag-game">{(comp.game || '').toUpperCase()}</span>
            </div>
            <h1 className="comp-hero-title">{comp.name}</h1>
            <div className="comp-hero-meta">
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="1" y="2" width="14" height="13" rx="2" />
                  <line x1="1" y1="6" x2="15" y2="6" />
                  <line x1="5" y1="1" x2="5" y2="3" />
                  <line x1="11" y1="1" x2="11" y2="3" />
                </svg>
                {comp.dates}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z" />
                  <circle cx="8" cy="6" r="1.5" />
                </svg>
                {comp.location}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                  <path d="M2 15c0-3 2.7-5 6-5s6 2 6 5" />
                </svg>
                {comp.participants || approvedTeams.length} Participants
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4.5 1h7l-1 5a3.5 3.5 0 0 1-5 0L4.5 1z" />
                  <path d="M2 1h2.5m9 0H14" />
                  <path d="M8 9v5m-2 0h4" />
                </svg>
                {formatPrizePool(comp.prizePool)}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 2" />
                </svg>
                {comp.season}
              </span>
            </div>
          </div>

          <div className="comp-hero-actions">
            {hasEntryFee && (
              <Link
                to={`/organizer-revenue?id=${comp.id}`}
                className="hero-btn hero-btn-secondary"
                style={{ borderColor: 'rgba(96,165,250,0.45)', color: '#bfdbfe' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M6 9v6M18 9v6" />
                </svg>
                TRANSACTIONS
              </Link>
            )}

            <Link to={`/comp-standings?id=${comp.id}`} className="hero-btn hero-btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              VIEW STANDINGS
            </Link>

            {isEnded ? (
              <span
                className="hero-btn"
                style={{
                  background: 'rgba(251,146,60,0.12)',
                  border: '1px solid rgba(251,146,60,0.35)',
                  color: '#fb923c',
                  cursor: 'default',
                  pointerEvents: 'none'
                }}
              >
                🏁 COMPETITION ENDED
              </span>
            ) : (
              <>
                <Link to={`/comp-manage-teams?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  </svg>
                  MANAGE TEAMS
                </Link>

                <Link to={`/comp-manage-matches?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  MANAGE MATCHES
                </Link>

                <button
                  type="button"
                  onClick={() => setShowOrgModal(true)}
                  className="hero-btn hero-btn-secondary"
                  style={{ borderColor: 'rgba(198,255,51,0.4)', color: '#c6ff33', cursor: 'pointer' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  + ADD / MANAGE ORGANIZERS ({orgList.length})
                </button>

                <Link
                  to={`/comp-dispute-review?id=${comp.id}`}
                  className="hero-btn hero-btn-secondary"
                  style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  DISPUTES ({pendingDisputesCount})
                </Link>

                <Link to={`/edit-competition?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  EDIT COMPETITION
                </Link>
              </>
            )}
          </div>
        </div>

        {/* STATS ROW */}
        <div className="comp-stats-row">
          <div className="stat-card">
            <span className="stat-label">{typeLabel}</span>
            <span className="stat-val">{comp.name}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">TITLE</span>
            <span className="stat-val">
              <span className="stat-game-icon">🎮</span> {comp.game}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">MATCHES</span>
            <span className="stat-val stat-accent">{comp.totalMatches || matches.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">TEAMS</span>
            <span className="stat-val stat-accent">{approvedTeams.length} / {maxTeams}</span>
          </div>
          <div className="stat-card stat-card-highlight">
            <span className="stat-label">STATUS</span>
            <span className="stat-val stat-accent">{(comp.status || 'ongoing').toUpperCase()}</span>
          </div>
        </div>

        {/* BODY (TEAMS & MATCHES) */}
        <div className="comp-body">
          {/* Teams panel */}
          <div className="comp-panel">
            <div className="comp-panel-header">
              <div className="comp-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
                <span>Registered Teams</span>
              </div>
              <span className="comp-panel-count">
                Showing all {teams.length} teams ({approvedTeams.length} approved)
              </span>
            </div>

            <div className="comp-teams-table">
              {teams.length === 0 ? (
                <div className="empty-state">No teams registered yet.</div>
              ) : (
                <div className="teams-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {teams.map((t) => {
                    const statusMap = { approved: 'APPROVED', pending: 'PENDING', rejected: 'REJECTED' };
                    const statusCls = { approved: 'status-approved', pending: 'status-pending', rejected: 'status-rejected' };
                    const canManage = comp.role === 'organizer' && t.status === 'pending';

                    return (
                      <div key={t.id} className="team-row">
                        <div
                          className="team-avatar"
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/team/team-roster?compId=${comp.id}&teamId=${t.id}`)}
                        >
                          {t.avatar || '🛡️'}
                        </div>
                        <div
                          className="team-info"
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/team/team-roster?compId=${comp.id}&teamId=${t.id}`)}
                        >
                          <span className="team-name">{t.name}</span>
                          <span className="team-players">{t.players || t.members?.length || 0} Players</span>
                        </div>
                        <span className={`team-status ${statusCls[t.status] || ''}`}>
                          {statusMap[t.status] || (t.status || 'pending').toUpperCase()}
                        </span>
                        <div className="team-actions">
                          {canManage && (
                            <>
                              <button
                                className="act-btn act-btn-approve"
                                onClick={() => handleApproveTeam(t.id)}
                              >
                                Approve
                              </button>
                              <button
                                className="act-btn act-btn-reject"
                                onClick={() => handleRejectTeam(t.id)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Link to={`/comp-manage-teams?id=${comp.id}`} className="comp-view-all">
              View All Registered Teams →
            </Link>
          </div>

          {/* Matches panel */}
          <div className="comp-panel">
            <div className="comp-panel-header">
              <div className="comp-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>Match Schedule</span>
              </div>
              <div className="comp-panel-nav">
                <button
                  className="comp-nav-btn"
                  onClick={() => setMatchPage((p) => Math.max(0, p - 1))}
                  disabled={matchPage === 0}
                >
                  &#8249;
                </button>
                <button
                  className="comp-nav-btn"
                  onClick={() => setMatchPage((p) => p + 1)}
                  disabled={(matchPage + 1) * MATCHES_PER_PAGE >= matches.length}
                >
                  &#8250;
                </button>
              </div>
            </div>

            <div className="comp-matches-list">
              {matches.length === 0 ? (
                <div className="empty-state">No matches scheduled yet.</div>
              ) : (
                matchSlice.map((m) => {
                  const isLive = m.status === 'live';
                  const isCompleted = m.status === 'completed';

                  return (
                    <div key={m.id} className={`match-item ${isLive ? 'match-item-live' : ''}`}>
                      <div className="match-round">
                        {m.round} {isLive && <span className="live-tag">LIVE</span>}
                      </div>
                      <div className="match-teams-row">
                        {isCompleted ? (
                          <>
                            <span className="match-team">{m.team1}</span>
                            <span className="match-score">{m.score1} – {m.score2}</span>
                            <span className="match-team">{m.team2}</span>
                          </>
                        ) : (
                          <>
                            <span className="match-team">{m.team1}</span>
                            <span className="match-vs">VS</span>
                            <span className="match-team">{m.team2}</span>
                          </>
                        )}
                      </div>
                      <div className="match-meta">
                        {m.date} · {m.time}
                      </div>
                      {isLive && (
                        <Link to={`/comp-match-results?id=${comp.id}`} className="match-result-btn">
                          MATCH RESULTS
                        </Link>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ORGANIZERS MODAL */}
        {showOrgModal && (
          <div
            id="organizers-modal"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
          >
            <div
              style={{
                background: '#131b24',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14,
                padding: 26,
                maxWidth: 500,
                width: '90%',
                boxShadow: '0 12px 36px rgba(0,0,0,0.6)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  paddingBottom: 12
                }}
              >
                <div>
                  <h3 style={{ color: '#fff', margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>👥</span> Tournament Organizers
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 0 0' }}>
                    Add and manage co-organizers for this tournament.
                  </p>
                </div>
                <button
                  onClick={() => setShowOrgModal(false)}
                  style={{ background: 'none', border: 'none', color: '#9aa4b2', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}
                >
                  Add Co-Organizer
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        fontWeight: 700
                      }}
                    >
                      @
                    </span>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter username or User ID"
                      value={newOrgInput}
                      onChange={(e) => setNewOrgInput(e.target.value)}
                      style={{
                        paddingLeft: 28,
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        borderRadius: 8,
                        paddingTop: 8,
                        paddingBottom: 8
                      }}
                    />
                  </div>
                  <button
                    className="btn-table-primary"
                    onClick={handleAddOrganizer}
                    style={{
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#c6ff33',
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}
                >
                  Current Organizers
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {orgList.map((org) => {
                    const isOwner = org === creator;
                    return (
                      <div
                        key={org}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          padding: '10px 14px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>👤</span>
                          <div>
                            <div style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>@{org}</div>
                            <div
                              style={{
                                fontSize: 11,
                                color: isOwner ? '#c6ff33' : 'var(--text-muted)',
                                fontWeight: isOwner ? 700 : 400
                              }}
                            >
                              {isOwner ? 'Primary Creator / Owner' : 'Co-Organizer'}
                            </div>
                          </div>
                        </div>
                        {!isOwner ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveOrganizer(org)}
                            style={{
                              background: 'rgba(239,68,68,0.15)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              color: '#ef4444',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Protected</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 20, textAlign: 'right' }}>
                <button
                  className="btn-table-secondary"
                  onClick={() => setShowOrgModal(false)}
                  style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8 }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
