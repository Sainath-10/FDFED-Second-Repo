import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import TeamTabs from '../../components/Navigation/TeamTabs';
import { useToast } from '../../components/Common/Toast';
import { NexusTeamWorkflow } from '../../services/teamService';
import '../../styles/pages/team/team-roster.css';

export default function TeamRosterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [pageContext, setPageContext] = useState(null);
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
          <h2>Loading team roster...</h2>
        </main>
      </Shell>
    );
  }

  const { comp, team, session } = pageContext;
  const members = NexusTeamWorkflow.getTeamRoster(comp.id, team.id);
  const canManage = session && (session.username || '').toLowerCase() === (team.createdBy || '').toLowerCase();
  const isEnded = !!(comp && (comp.ended || comp.status === 'completed'));
  const maxPlayers = comp.maxPlayersPerTeam || 5;
  const openSlots = Math.max(0, maxPlayers - members.length);
  const captain = team.leader || team.createdBy || 'Captain';

  const handleRemovePlayer = (username) => {
    if (!window.confirm(`Remove ${username} from the team?`)) return;

    const result = NexusTeamWorkflow.removePlayer({
      compId: comp.id,
      teamId: team.id,
      username: username,
    });

    if (!result.ok) {
      showToast(result.error || 'Unable to remove player.', 'error');
      return;
    }

    showToast(`${username} removed from ${team.name}.`, 'error');
    setTick(t => t + 1);
  };

  const querySuffix = `?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;

  return (
    <Shell activeItem="activity">
      <main className="main-content">
        <h1 className="page-title">{team.name}</h1>
        <p className="page-subtitle">{(comp.game || 'Game')} — Captain: {captain}</p>

        <TeamTabs activeTab="roster" />

        <div className="layout-wrapper">
          <div>
            <div className="roster-header-row">
              <div className="roster-stats-summary">
                {members.length} / {maxPlayers} players ·{' '}
                <span className="summary-accent">
                  {openSlots} slot{openSlots !== 1 ? 's' : ''} open
                </span>
              </div>
              {canManage && openSlots > 0 && !isEnded && (
                <Link to={`/team/add-players${querySuffix}`} className="btn-primary header-btn-primary">
                  + Add New Player
                </Link>
              )}
            </div>

            {/* Ended banner */}
            {isEnded && (
              <div
                id="_ended_banner_roster_"
                style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textAlign: 'center', margin: '12px 0 16px', letterSpacing: '0.5px' }}
              >
                🏁 Competition has ended — team roster is now view-only.
              </div>
            )}

            <div className="roster-grid">
              {members.map((member) => {
                const username = member.username || 'user';
                const initial = username.charAt(0).toUpperCase();
                const isCaptain = (member.role || '').toLowerCase() === 'captain' ||
                  username.toLowerCase() === (team.createdBy || '').toLowerCase();

                if (isCaptain) {
                  return (
                    <div className="player-card player-card-captain" key={username}>
                      <div className="player-avatar-placeholder">{initial}</div>
                      <div className="p-name">{member.displayName || username}</div>
                      <div className="p-role">Captain</div>
                      <div className="p-stats">Username: {username}</div>
                      <div className="captain-pill-wrapper">
                        <span className="captain-pill">Captain</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="player-card" key={username}>
                    <div className="player-avatar-placeholder">{initial}</div>
                    <div className="p-name">{member.displayName || username}</div>
                    <div className="p-role">Player</div>
                    <div className="p-stats">Username: {username}</div>
                    <div className="captain-pill-wrapper">
                      {canManage && !isEnded && (
                        <button
                          className="btn-table-danger btn-remove-alt"
                          onClick={() => handleRemovePlayer(username)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Empty slots for captain */}
              {canManage && !isEnded && Array.from({ length: openSlots }).map((_, i) => (
                <div
                  className="player-card player-card-empty"
                  key={`empty-${i}`}
                  onClick={() => navigate(`/team/add-players${querySuffix}`)}
                >
                  <div className="empty-slot-icon">+</div>
                  <div className="p-name player-name-placeholder">Empty Slot</div>
                  <div className="p-role player-role-placeholder">Click to add player</div>
                  <div className="empty-slot-btn-wrapper">
                    <Link to={`/team/add-players${querySuffix}`} className="btn-table-secondary btn-invite-mini">
                      Invite Player
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Competitions */}
            <div className="active-comps-card">
              <h2 className="active-comps-title">Active Competitions</h2>
              <div className="comp-list-stack">
                <div className="comp-item-mini">
                  <img
                    src={comp.img || '/assets/b890c61489a080992ad7e99adabb1145e6d59606.png'}
                    className="comp-img-mini"
                    alt={comp.name}
                  />
                  <div className="comp-info-mini">
                    <div className="comp-name-mini">{comp.name}</div>
                    <div className="comp-meta-mini">{comp.game}</div>
                  </div>
                  <span className="status-pill ongoing">{(comp.status || 'ongoing').toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
