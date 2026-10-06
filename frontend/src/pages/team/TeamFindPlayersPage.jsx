import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import TeamTabs from '../../components/Navigation/TeamTabs';
import { useToast } from '../../components/Common/Toast';
import { NexusTeamWorkflow } from '../../services/teamService';
import '../../styles/pages/team/add-players.css';

export default function TeamFindPlayersPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [pageContext, setPageContext] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [directUsername, setDirectUsername] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctx = NexusTeamWorkflow.resolveTeamContext();
    if (!ctx || !ctx.comp || !ctx.team) {
      showToast('Team context not found.', 'error');
      navigate('/competitions', { replace: true });
      return;
    }
    setPageContext(ctx);
  }, [searchParams, navigate, showToast, tick]);

  if (!pageContext || !pageContext.comp || !pageContext.team) {
    return (
      <Shell activeItem="activity">
        <main className="main-content" style={{ padding: '40px' }}>
          <h2>Loading...</h2>
        </main>
      </Shell>
    );
  }

  const { comp, team } = pageContext;
  const isEnded = !!(comp && (comp.ended || comp.status === 'completed'));
  const maxPlayers = comp.maxPlayersPerTeam || 5;
  const members = NexusTeamWorkflow.getTeamRoster(comp.id, team.id);
  const openSlots = Math.max(0, maxPlayers - members.length);

  const availablePlayers = NexusTeamWorkflow.getAvailablePlayers(comp.id, team.id);
  const filteredPlayers = availablePlayers.filter(p =>
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const invites = NexusTeamWorkflow.getInvites(comp.id, team.id) || [];
  const pendingInvitesCount = invites.filter(i => i.status === 'pending').length;

  const joinRequests = NexusTeamWorkflow.getJoinRequests(comp.id, team.id) || [];
  const pendingRequestsCount = joinRequests.filter(r => r.status === 'pending').length;

  const querySuffix = `?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;

  const handleSendInvite = (toUsername) => {
    if (isEnded) {
      showToast('Competition has ended — cannot send invites.', 'error');
      return;
    }

    const result = NexusTeamWorkflow.sendInvite({
      compId: comp.id,
      teamId: team.id,
      toUsername,
      roleOffered: 'Player',
    });

    if (!result.ok) {
      showToast(result.error || 'Failed to send invite.', 'error');
      return;
    }

    showToast(`Invitation sent to ${toUsername}.`);
    setTick(t => t + 1);
  };

  const handleDirectInvite = (e) => {
    e.preventDefault();
    const trimmed = directUsername.trim();
    if (!trimmed) {
      showToast('Please enter a username.', 'error');
      return;
    }
    handleSendInvite(trimmed);
    setDirectUsername('');
  };

  return (
    <Shell activeItem="activity">
      <main className="main-content">
        <h1 className="page-title">{team.name}</h1>
        <p className="page-subtitle">Invite players to join your roster.</p>

        <TeamTabs activeTab="add-players" />

        {isEnded && (
          <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '14px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textAlign: 'center', margin: '24px 0', letterSpacing: '0.5px' }}>
            🏁 Competition has ended — inviting new players is no longer possible.
          </div>
        )}

        <div className="layout-wrapper">
          <div className="content-column">
            {/* Search for players */}
            <div className="search-card">
              <h2 className="card-title-sm">Search Players</h2>
              <div className="search-controls-row">
                <div className="search-bar search-bar-alt" style={{ maxWidth: '100%' }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="7" cy="7" r="5" />
                    <line x1="10.5" y1="10.5" x2="14" y2="14" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by username…"
                    id="player-search"
                    disabled={isEnded}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div id="player-results" className="results-stack">
                {filteredPlayers.length === 0 ? (
                  <div className="role-user-item">
                    <div className="role-user-info">
                      <div className="role-user-name" style={{ color: 'var(--text-muted)' }}>
                        {availablePlayers.length === 0 ? 'No available players found.' : 'No players match your search.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  filteredPlayers.map((player) => {
                    const initial = (player.username || 'U').charAt(0).toUpperCase();
                    return (
                      <div className="role-user-item" key={player.username} data-name={player.username}>
                        <div className="player-avatar-sm">{initial}</div>
                        <div className="role-user-info">
                          <div className="role-user-name">{player.username}</div>
                          <div className="player-meta-info">Registered user</div>
                        </div>
                        <span className="status-pill approved status-pill-sm">Available</span>
                        <button
                          className="btn-table-primary"
                          disabled={isEnded}
                          onClick={() => handleSendInvite(player.username)}
                        >
                          Send Invite
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Direct invite card */}
            <div className="direct-invite-card">
              <h2 className="card-title-sm">Invite by Username</h2>
              <form onSubmit={handleDirectInvite} className="direct-invite-row">
                <input
                  className="form-input direct-invite-input"
                  type="text"
                  id="direct-username"
                  placeholder="Enter exact username…"
                  disabled={isEnded}
                  value={directUsername}
                  onChange={(e) => setDirectUsername(e.target.value)}
                />
                <button type="submit" className="btn-primary" disabled={isEnded}>
                  Send Invitation
                </button>
              </form>
            </div>
          </div>

          <div className="sidebar-sticky-stack">
            <div className="comp-sidebar-block">
              <h3>Roster Status</h3>
              <div className="info-row">
                <span className="key">Current Players</span>
                <span className="val">{members.length} / {maxPlayers}</span>
              </div>
              <div className="info-row">
                <span className="key">Open Slots</span>
                <span className="val stat-val-accent">{openSlots}</span>
              </div>
              <div className="info-row">
                <span className="key">Pending Invites</span>
                <span className="val" id="pending-count">{pendingInvitesCount}</span>
              </div>
              <div className="info-row">
                <span className="key">Join Requests</span>
                <span className="val stat-val-accent">{pendingRequestsCount}</span>
              </div>
            </div>
            <div className="comp-sidebar-block sidebar-btns-stack">
              <Link to={`/team/join-requests${querySuffix}`} className="btn-table-primary btn-sidebar-full" style={{ textAlign: 'center', textDecoration: 'none' }}>
                Review Join Requests
              </Link>
              <Link to={`/team/invitations-sent${querySuffix}`} className="btn-table-secondary btn-sidebar-full" style={{ textAlign: 'center', textDecoration: 'none' }}>
                View Invitations Sent
              </Link>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
