/**
 * NEXUS ESPORTS — Team Roster
 *
 * captain-aware roster with
 * remove-player, empty slots, the active-competitions card, permission-gated tabs
 * and the ended-competition view-only lock.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTeamContext, hasCompetitionStarted } from '../../hooks/useTeamContext.js';
import NexusTeamWorkflow from '../../services/teamWorkflow.js';
import { TeamsAPI } from '../../services/api.js';
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
  // §6.2 — one shared competition-started check across all roster rules
  const isStarted = hasCompetitionStarted(comp);
  const rosterLocked = isEnded || isStarted;
  const openSlots = Math.max(0, maxPlayers - members.length);
  const hasRoom = members.length < maxPlayers;
  const captain = team.leader || team.createdBy || 'Captain';
  const addHref = `/pages/team/add-players.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;
  const reportHref = `/pages/report-dispute.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;

  // §6.1 — removal requires a meaningful reason (modal), backend is authoritative
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);

  function askRemovePlayer(username) {
    if (!canManage || rosterLocked) return;
    setRemoveTarget(username);
    setRemoveReason('');
  }

  async function confirmRemovePlayer() {
    const reason = String(removeReason || '').trim();
    if (!removeTarget) return;
    if (reason.length < 5) { showToast('Please provide a meaningful removal reason (min 5 characters).', 'error'); return; }
    if (removing) return;
    setRemoving(true);
    let noted = '';
    try {
      const res = await TeamsAPI.removeMember(team.id, removeTarget, reason);
      if (res.ok) noted = '';
      else if (!/backend|network|Failed to fetch|is the backend/i.test(String(res.error || ''))) {
        setRemoving(false);
        showToast(res.error || 'Unable to remove player.', 'error'); // e.g. paid-participant block from the backend
        return;
      }
    } catch (err) { /* offline — fall back to local workflow below */ }

    const result = NexusTeamWorkflow.removePlayer({ compId: comp.id, teamId: team.id, username: removeTarget, reason });
    setRemoving(false);
    if (!result.ok) { showToast(result.error || 'Unable to remove player.', 'error'); setRemoveTarget(null); return; }
    showToast(`${removeTarget} removed from ${team.name}. The participant has been notified.`, 'error');
    setRemoveTarget(null);
    setRemoveReason('');
    refresh();
  }

  const showAdd = canManage && hasRoom && !rosterLocked;

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

      {isStarted && !isEnded && (
        <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', margin: '12px 0 16px', letterSpacing: '0.5px' }}>
          🎮 Competition has started — roster changes are locked. Report issues through the dispute workflow instead: <Link to={reportHref} style={{ color: '#fb923c', textDecoration: 'underline' }}>File a report</Link>.
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
                    {canManage && !rosterLocked && (
                      <button className="btn-table-danger btn-remove-alt" onClick={() => askRemovePlayer(username)}>Remove</button>
                    )}
                  </div>
                </div>
              );
            })}

            {canManage && !rosterLocked && Array.from({ length: openSlots }).map((_, i) => (
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

          {canManage && hasRoom === false && !rosterLocked && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 16 }}>
              🚫 Team is full — all {maxPlayers} slots are taken. The backend also enforces this limit on every invite and join-request approval.
            </div>
          )}

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

      {removeTarget && (
        <div className="modal-overlay open" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#f87171' }}>Remove Player</h3>
              <button className="modal-close" onClick={() => setRemoveTarget(null)}>✕</button>
            </div>
            <p style={{ color: '#9aa4b2', fontSize: 14, marginBottom: 10 }}>
              You are removing <strong style={{ color: '#fff' }}>{removeTarget}</strong> from <strong style={{ color: '#c6ff33' }}>{team.name}</strong>.
            </p>
            <p style={{ color: '#9aa4b2', fontSize: 12, marginBottom: 12 }}>
              A meaningful reason is mandatory and is shared with the participant and recorded in the audit log. If this participant has already paid a participation fee for this competition, direct removal is blocked — use the dispute/report workflow instead.
            </p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="e.g. Repeatedly missed scheduled matches without notice"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              style={{ width: '100%', marginBottom: 16 }}
              maxLength={500}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setRemoveTarget(null)}>Cancel</button>
              <button className="btn-submit" style={{ background: '#ef4444' }} disabled={removing} onClick={confirmRemovePlayer}>{removing ? 'Removing…' : 'Remove Player'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


