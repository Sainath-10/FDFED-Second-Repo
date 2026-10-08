/**
 * NEXUS ESPORTS — Add Players
 *
 * available-player search +
 * send-invite, invite-by-username, roster-status sidebar, and the ended-competition
 * lock (banner + all controls disabled).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import NexusTeamWorkflow from '../../services/teamWorkflow.js';
import TeamTabs from '../../components/TeamTabs.jsx';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/team/add-players.css';

export default function AddPlayers() {
  const { ctx, refresh } = useTeamContext();
  const [query, setQuery] = useState('');
  const [direct, setDirect] = useState('');

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
  const isEnded = !!(comp.ended || comp.status === 'completed');
  const players = NexusTeamWorkflow.getAvailablePlayers(comp.id, team.id) || [];
  const members = NexusTeamWorkflow.getTeamRoster(comp.id, team.id) || [];
  const invites = NexusTeamWorkflow.getInvites(comp.id, team.id) || [];
  const requests = NexusTeamWorkflow.getJoinRequests(comp.id, team.id) || [];
  const maxPlayers = comp.maxPlayersPerTeam || 5;
  const canManage = !!(session && (session.username || '').toLowerCase() === (team.createdBy || '').toLowerCase());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => String(p.username || '').toLowerCase().includes(q));
  }, [players, query]);

  const pendingInvites = invites.filter((i) => i.status === 'pending').length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;

  function sendInvite(name) {
    if (!name) return;
    const result = NexusTeamWorkflow.sendInvite({ compId: comp.id, teamId: team.id, toUsername: name, roleOffered: 'Player' });
    if (!result.ok) { showToast(result.error || 'Failed to send invite.', 'error'); return; }
    showToast(`Invitation sent to ${name}.`);
    refresh();
  }

  function directInvite() {
    const username = direct.trim();
    if (!username) { showToast('Please enter a username.', 'error'); return; }
    sendInvite(username);
    setDirect('');
  }

  return (
    <main className="main-content">
      <h1 className="page-title">{team.name}</h1>
      <p className="page-subtitle">Invite players to join your roster.</p>

      <TeamTabs active="add-players" context={context} canManage={canManage} isEnded={isEnded} joinRequestCount={pendingRequests} />

      {isEnded && (
        <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '14px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, textAlign: 'center', margin: '24px 0', letterSpacing: '0.5px' }}>
          🏁 Competition has ended — inviting new players is no longer possible.
        </div>
      )}

      <div className="layout-wrapper">
        <div className="content-column">
          <div className="search-card">
            <h2 className="card-title-sm">Search Players</h2>
            <div className="search-controls-row">
              <div className="search-bar search-bar-alt" style={{ maxWidth: '100%' }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
                <input type="text" placeholder="Search by username…" id="player-search" value={query} onChange={(e) => setQuery(e.target.value)} disabled={isEnded} />
              </div>
            </div>

            <div id="player-results" className="results-stack">
              {filtered.length === 0 ? (
                <div className="role-user-item"><div className="role-user-info"><div className="role-user-name">No available players found.</div></div></div>
              ) : (
                filtered.map((player) => {
                  const username = player.username || 'U';
                  const initial = username.charAt(0).toUpperCase();
                  return (
                    <div className="role-user-item" data-name={username} key={username}>
                      <div className="player-avatar-sm">{initial}</div>
                      <div className="role-user-info">
                        <div className="role-user-name">{username}</div>
                        <div className="player-meta-info">Registered user</div>
                      </div>
                      <span className="status-pill approved status-pill-sm">Available</span>
                      <button className="btn-table-primary" onClick={() => sendInvite(username)} disabled={isEnded}>Send Invite</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="direct-invite-card">
            <h2 className="card-title-sm">Invite by Username</h2>
            <div className="direct-invite-row">
              <input className="form-input direct-invite-input" type="text" id="direct-username" placeholder="Enter exact username…" value={direct} onChange={(e) => setDirect(e.target.value)} disabled={isEnded} />
              <button className="btn-primary" onClick={directInvite} disabled={isEnded}>Send Invitation</button>
            </div>
          </div>
        </div>

        <div className="sidebar-sticky-stack">
          <div className="comp-sidebar-block">
            <h3>Roster Status</h3>
            <div className="info-row"><span className="key">Current Players</span><span className="val">{members.length} / {maxPlayers}</span></div>
            <div className="info-row"><span className="key">Open Slots</span><span className="val stat-val-accent">{Math.max(0, maxPlayers - members.length)}</span></div>
            <div className="info-row"><span className="key">Pending Invites</span><span className="val" id="pending-count">{pendingInvites}</span></div>
            <div className="info-row"><span className="key">Join Requests</span><span className="val stat-val-accent">{pendingRequests}</span></div>
          </div>
          <div className="comp-sidebar-block sidebar-btns-stack">
            <Link to={`/pages/team/join-requests.html${context && context.compId ? `?compId=${encodeURIComponent(context.compId)}&teamId=${encodeURIComponent(context.teamId)}` : ''}`} className="btn-table-primary btn-sidebar-full">Review Join Requests</Link>
            <Link to={`/pages/team/invitations-sent.html${context && context.compId ? `?compId=${encodeURIComponent(context.compId)}&teamId=${encodeURIComponent(context.teamId)}` : ''}`} className="btn-table-secondary btn-sidebar-full">View Invitations Sent</Link>
          </div>
        </div>
      </div>
    </main>
  );
}


