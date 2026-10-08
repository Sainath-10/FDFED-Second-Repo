/**
 * NEXUS ESPORTS — Team Roster
 *
 * captain-aware roster with
 * remove-player, empty slots, the active-competitions card, permission-gated tabs
 * and the ended-competition view-only lock.
 */
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import NexusTeamWorkflow from '../../services/teamWorkflow.js';
import TeamTabs from '../../components/TeamTabs.jsx';
import { showToast } from '../../lib/toast.js';
import { assetUrl } from '../../lib/assets.js';
import '../../styles/pages/team/team-roster.css';

export default function TeamRoster() {
  const { ctx, refresh } = useTeamContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ctx || !ctx.comp || !ctx.team) return;
    if (NexusTeamWorkflow && NexusTeamWorkflow.refreshTeamManagementUI) {
      NexusTeamWorkflow.refreshTeamManagementUI(ctx.comp.id, ctx.team.id);
    }
  }, [ctx]);

  if (!ctx || !ctx.comp || !ctx.team) {
    return <main className="main-content"><h1 className="page-title">Team</h1></main>;
  }

  const { comp, team, session, context } = ctx;
  const members = NexusTeamWorkflow.getTeamRoster(comp.id, team.id) || [];
  const canManage = !!(session && (session.username || '').toLowerCase() === (team.createdBy || '').toLowerCase());
  const maxPlayers = comp.maxPlayersPerTeam || 5;
  const isEnded = !!(comp.ended || comp.status === 'completed');
  const openSlots = Math.max(0, maxPlayers - members.length);
  const hasRoom = members.length < maxPlayers;
  const captain = team.leader || team.createdBy || 'Captain';
  const addHref = `/pages/team/add-players.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;

  function removePlayer(username) {
    if (!window.confirm(`Remove ${username} from the team?`)) return;
    const result = NexusTeamWorkflow.removePlayer({ compId: comp.id, teamId: team.id, username });
    if (!result.ok) { showToast(result.error || 'Unable to remove player.', 'error'); return; }
    showToast(`${username} removed from ${team.name}.`, 'error');
    refresh();
  }

  const showAdd = canManage && hasRoom && !isEnded;

  return (
    <main className="main-content">
      <h1 className="page-title">{team.name}</h1>
      <p className="page-subtitle">{comp.game || 'Game'} - Captain: {captain}</p>

      <TeamTabs active="roster" context={context} canManage={canManage} isEnded={isEnded} />

      {isEnded && (
        <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', margin: '12px 0 16px', letterSpacing: '0.5px' }}>
          🏁 Competition has ended — team roster is now view-only.
        </div>
      )}

      <div className="layout-wrapper">
        <div>
          <div className="roster-header-row">
            <div className="roster-stats-summary">
              {members.length} / {maxPlayers} players - <span className="summary-accent">{openSlots} slot{openSlots !== 1 ? 's' : ''} open</span>
            </div>
            {showAdd && <Link to={addHref} className="btn-primary header-btn-primary">+ Add New Player</Link>}
          </div>

          <div className="roster-grid">
            {members.map((member) => {
              const username = member.username || 'user';
              const initial = username.charAt(0).toUpperCase();
              const isCaptain = (member.role || '').toLowerCase() === 'captain' || username.toLowerCase() === (team.createdBy || '').toLowerCase();
              if (isCaptain) {
                return (
                  <div className="player-card player-card-captain" key={username}>
                    <div className="player-avatar-placeholder">{initial}</div>
                    <div className="p-name">{member.displayName || username}</div>
                    <div className="p-role">Captain</div>
                    <div className="p-stats">Username: {username}</div>
                    <div className="captain-pill-wrapper"><span className="captain-pill">Captain</span></div>
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
                      <button className="btn-table-danger btn-remove-alt" onClick={() => removePlayer(username)}>Remove</button>
                    )}
                  </div>
                </div>
              );
            })}

            {canManage && !isEnded && Array.from({ length: openSlots }).map((_, i) => (
              <div className="player-card player-card-empty" key={`empty-${i}`} onClick={() => navigate(addHref)}>
                <div className="empty-slot-icon">+</div>
                <div className="p-name player-name-placeholder">Empty Slot</div>
                <div className="p-role player-role-placeholder">Click to add player</div>
                <div className="empty-slot-btn-wrapper">
                  <Link to={addHref} className="btn-table-secondary btn-invite-mini">Invite Player</Link>
                </div>
              </div>
            ))}
          </div>

          <div className="active-comps-card">
            <h2 className="active-comps-title">Active Competitions</h2>
            <div className="comp-list-stack">
              <div className="comp-item-mini">
                <img src={assetUrl('b890c61489a080992ad7e99adabb1145e6d59606.png')} className="comp-img-mini" alt="Competition" />
                <div className="comp-info-mini">
                  <div className="comp-name-mini">{comp.name}</div>
                  <div className="comp-meta-mini">{comp.game}</div>
                </div>
                <span className="status-pill ongoing">{String(comp.status || 'ongoing').toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


