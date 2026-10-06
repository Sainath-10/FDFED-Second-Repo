import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import { NexusTeamWorkflow } from '../services/teamService';
import { NexusAuth } from '../services/authService';
import '../styles/pages/join-teams.css';

export default function JoinTeamsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const compId = searchParams.get('id') || searchParams.get('compId') || '';
  const preferredTeamId = searchParams.get('teamId') || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutModal, setCheckoutModal] = useState(null); // { teamId, feeAmount }
  const [updateKey, setUpdateKey] = useState(0);

  const comp = compId ? NexusData.getCompetitionById(compId) : null;
  const session = NexusAuth.getSession();
  const currentUsername = (session?.username || '').trim().toLowerCase();

  useEffect(() => {
    if (!comp && compId) {
      showToast('Competition context missing.', 'error');
    }
  }, [comp, compId, showToast]);

  useEffect(() => {
    if (comp) {
      const approvalStatus = NexusData.getApprovalStatus(comp);
      if (approvalStatus === 'rejected') {
        showToast('This competition has been archived.', 'error');
        navigate('/competitions', { replace: true });
      }
    }
  }, [comp, navigate, showToast]);

  // Attempt direct join if teamId is provided in URL
  useEffect(() => {
    if (comp && preferredTeamId && session) {
      const result = NexusTeamWorkflow.directJoinTeam({
        compId: comp.id,
        teamId: preferredTeamId,
      });
      if (result.ok) {
        showToast(`You have joined ${result.team?.name || 'the team'}.`);
        const isCaptain = result.team?.createdBy && result.team.createdBy.toLowerCase() === currentUsername;
        if (isCaptain) {
          navigate(`/team/team-roster?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(preferredTeamId)}`);
        } else {
          navigate(`/comp-participant?id=${encodeURIComponent(comp.id)}`);
        }
      } else {
        showToast(result.error || 'Unable to join team.', 'error');
      }
    }
  }, [comp, preferredTeamId, session, currentUsername, navigate, showToast]);

  if (!comp) {
    return (
      <Shell activeItem="competitions">
        <main className="join-page" style={{ padding: '32px' }}>
          <Link to="/competitions" className="back-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 8H4M4 8L8 12M4 8L8 4" />
            </svg>
            Back to Competitions
          </Link>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h2>Competition Not Found</h2>
            <p style={{ color: 'var(--text-muted)' }}>Could not load competition details for joining teams.</p>
          </div>
        </main>
      </Shell>
    );
  }

  // User's own team status in this comp
  const myTeamBundle = session ? NexusTeamWorkflow.findUserTeamInCompetition(comp.id, session.username) : null;
  const myTeam = myTeamBundle?.team || null;
  const myTeamId = myTeam?.id || null;

  const maxPerTeam = comp.maxPlayersPerTeam || 5;
  const teamsToShow = (comp.teams || []).filter(t => t.status === 'approved');

  // Filtered teams by search query
  const filteredTeams = teamsToShow.filter(t =>
    (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pending requests of the current user
  const myPendingRequests = [];
  if (session) {
    (comp.teams || []).forEach(team => {
      (team.joinRequests || []).forEach(req => {
        if ((req.username || '').toLowerCase() === currentUsername && req.status === 'pending') {
          myPendingRequests.push({ teamName: team.name, teamAvatar: team.avatar, request: req });
        }
      });
    });
  }

  const handleJoinClick = (teamId) => {
    if (!session) {
      navigate('/login');
      return;
    }

    const feeType = comp.feeType || 'free';
    const entryFeeAmount = comp.entryFeeAmount || 0;

    if (feeType === 'per_player' && entryFeeAmount > 0) {
      setCheckoutModal({ teamId, feeAmount: entryFeeAmount });
    } else {
      proceedJoin(teamId);
    }
  };

  const proceedJoin = (teamId) => {
    const result = NexusTeamWorkflow.submitJoinRequest({
      compId: comp.id,
      teamId: teamId,
    });

    if (!result.ok) {
      showToast(result.error || 'Request failed.', 'error');
      return;
    }

    showToast('Join request sent successfully!');
    setCheckoutModal(null);
    setUpdateKey(k => k + 1);
  };

  return (
    <Shell activeItem="competitions">
      <main className="join-page">
        {/* Back */}
        <Link to={`/comp-info?id=${encodeURIComponent(comp.id)}`} className="back-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4" />
          </svg>
          Back to Competition
        </Link>

        {/* Competition Context */}
        <div className="comp-context">
          <svg viewBox="0 0 24 24" fill="none" stroke="#c6ff33" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18m-6-2v2m0 14v-2M9 9h6m-6 6h6M5 9v6a7 7 0 0 0 14 0V9" />
          </svg>
          <div>
            <div className="comp-name" id="comp-context-name">{comp.name} — {comp.game}</div>
            <div className="comp-sub">Select a team to join or create a new team for this tournament</div>
          </div>
        </div>

        {/* Header */}
        <div className="join-header-row">
          <div>
            <h1>Request to Join &amp; Play</h1>
            <p>Browse open teams looking for players, or create your own squad.</p>
          </div>
          {myTeam ? (
            <Link
              to={`/team/team-roster?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(myTeam.id)}`}
              className="create-team-cta"
            >
              View My Team
            </Link>
          ) : (
            <Link
              to={session ? `/create-team?id=${encodeURIComponent(comp.id)}` : '/login'}
              className="create-team-cta"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="7" y1="1" x2="7" y2="13" />
                <line x1="1" y1="7" x2="13" y2="7" />
              </svg>
              Create Team
            </Link>
          )}
        </div>

        {/* Open Requests */}
        <div className="section-label" style={{ marginTop: '20px' }}>Open Teams Looking for Players</div>

        {/* Search bar */}
        <div style={{ marginBottom: '16px' }}>
          <input
            id="team-search"
            type="text"
            placeholder="Search teams by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: '400px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div id="team-list">
          {filteredTeams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <p style={{ color: '#94A3B8', fontSize: '16px' }}>
                {teamsToShow.length === 0
                  ? 'No teams are currently registered in this tournament.'
                  : 'No teams match your search.'}
              </p>
              <p style={{ color: '#64748B', fontSize: '14px', marginTop: '8px' }}>
                {teamsToShow.length === 0 ? 'Be the first to create one.' : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            filteredTeams.map((team) => {
              const members = Array.isArray(team.members) ? team.members.length : (team.players || 0);
              const openSlots = Math.max(0, maxPerTeam - members);
              const isFull = members >= maxPerTeam;
              const isCaptain = currentUsername && (team.createdBy || '').toLowerCase() === currentUsername;
              const hasPending = currentUsername && (team.joinRequests || []).some(
                req => (req.username || '').toLowerCase() === currentUsername && req.status === 'pending'
              );
              const userInAnotherTeam = !!myTeamId && team.id !== myTeamId;
              const isHighlight = preferredTeamId && team.id === preferredTeamId;

              return (
                <div
                  className={`request-card ${isHighlight ? 'request-card-highlight' : ''}`}
                  key={team.id}
                  data-name={team.name}
                  data-team-id={team.id}
                >
                  <div className="request-card-left">
                    <div className="team-icon">{team.avatar || '⚡'}</div>
                    <div>
                      <div className="team-name">{team.name}</div>
                      <div className="team-info">
                        {members}/{maxPerTeam} Players filled
                        {isFull ? (
                          <span className="slots-full" style={{ marginLeft: '6px' }}>0 slots open</span>
                        ) : (
                          <span style={{ marginLeft: '6px' }}>{openSlots} slot{openSlots !== 1 ? 's' : ''} open</span>
                        )}
                      </div>
                      <div className="wanted-roles">
                        <span>Team Tag:</span>
                        <span className="role-badge">{team.tag || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="request-card-actions">
                    <Link
                      to={`/team/team-roster?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`}
                      className="btn-view-team"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                    >
                      View Team
                    </Link>
                    {isCaptain ? (
                      <button className="btn-join" disabled>Your Team</button>
                    ) : isFull ? (
                      <button className="btn-join team-full-btn" disabled>Team Full</button>
                    ) : userInAnotherTeam ? (
                      <button className="btn-join" disabled>In Another Team</button>
                    ) : hasPending ? (
                      <button className="btn-join" disabled>Requested</button>
                    ) : (
                      <button className="btn-join" onClick={() => handleJoinClick(team.id)}>
                        Request to Join
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pending Requests Section */}
        {myPendingRequests.length > 0 && (
          <div className="pending-requests-section">
            <div className="pending-header">
              <svg className="clock-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>PENDING REQUESTS</span>
              <span className="pending-badge">{myPendingRequests.length}</span>
            </div>

            <div className="pending-list">
              {myPendingRequests.map((entry, idx) => {
                const when = entry.request.requestedAt
                  ? new Date(entry.request.requestedAt).toLocaleString()
                  : 'just now';
                return (
                  <div className="pending-card" key={idx}>
                    <div className="pending-content">
                      <div className="team-icon">{entry.teamAvatar || '⚡'}</div>
                      <div className="pending-info">
                        <div className="pending-team-name">{entry.teamName}</div>
                        <div className="pending-time">Sent {when}</div>
                      </div>
                    </div>
                    <button className="btn-cancel-request" disabled>Pending</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Checkout Modal for Per-Player entry fees */}
      {checkoutModal && (
        <div
          id="player-checkout-modal"
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => {
            if (e.target.id === 'player-checkout-modal') setCheckoutModal(null);
          }}
        >
          <div style={{ background: '#0f172a', border: '1px solid #60a5fa', borderRadius: '16px', width: 'min(90vw, 460px)', padding: '32px', boxShadow: '0 20px 60px #000a', color: '#f1f5f9' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: '#f1f5f9' }}>👤 Player Participation Fee</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94a3b8' }}>
              Player Entry Fee for "{comp.name}".
            </p>

            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#cbd5e1' }}>
                <span>Participation Fee Model:</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Per Player (Individual Entry)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#f1f5f9', borderTop: '1px dashed rgba(96,165,250,0.3)', paddingTop: '10px', marginTop: '2px' }}>
                <strong>Total Player Entry Fee:</strong>
                <strong style={{ color: '#60a5fa', fontSize: '20px' }}>₹{checkoutModal.feeAmount.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setCheckoutModal(null)}
                style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => proceedJoin(checkoutModal.teamId)}
                style={{ flex: 2, padding: '12px', background: '#60a5fa', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
              >
                ✔ Pay ₹{checkoutModal.feeAmount.toLocaleString('en-IN')} &amp; Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
