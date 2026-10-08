/**
 * NEXUS ESPORTS — Invitations Sent
 *
 * the sent-invite
 * list with status pill + revoke, and the "Invite More Players" footer link.
 */
import { Link } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import NexusTeamWorkflow from '../../services/teamWorkflow.js';
import TeamTabs from '../../components/TeamTabs.jsx';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/team/invitations-sent.css';

function formatSentTime(value) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString();
}

export default function InvitationsSent() {
  const { ctx, refresh } = useTeamContext();

  if (!ctx || !ctx.comp || !ctx.team) {
    return <main className="main-content"><h1 className="page-title">Team</h1></main>;
  }

  const { comp, team, session, context } = ctx;
  const invites = NexusTeamWorkflow.getInvites(comp.id, team.id) || [];
  const requests = NexusTeamWorkflow.getJoinRequests(comp.id, team.id) || [];
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const canManage = !!(session && (session.username || '').toLowerCase() === (team.createdBy || '').toLowerCase());
  const isEnded = !!(comp.ended || comp.status === 'completed');
  const inviteMoreHref = `/pages/team/add-players.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;

  function revoke(inviteId, username) {
    if (!window.confirm(`Revoke invitation to ${username}?`)) return;
    const result = NexusTeamWorkflow.revokeInvite({ compId: comp.id, teamId: team.id, inviteId });
    if (!result.ok) { showToast(result.error || 'Failed to revoke invite.', 'error'); return; }
    showToast(`Invitation to ${username} revoked.`, 'error');
    refresh();
  }

  return (
    <main className="main-content">
      <h1 className="page-title">{team.name}</h1>
      <p className="page-subtitle">Track invitations sent to players.</p>

      <TeamTabs active="invitations" context={context} canManage={canManage} isEnded={isEnded} joinRequestCount={pendingRequests} />

      <div className="invites-stack">
        {invites.map((invite) => {
          const username = invite.toUsername || 'user';
          const initial = username.charAt(0).toUpperCase();
          const statusClass = invite.status === 'accepted' ? 'approved' : (invite.status === 'declined' ? 'rejected' : 'pending');
          const statusLabel = invite.status ? invite.status.toUpperCase() : 'PENDING';
          return (
            <div className="invite-row" data-invite-id={invite.id} key={invite.id}>
              <div className="invite-avatar-sm">{initial}</div>
              <div className="invite-info-wrapper">
                <div className="invite-name">{username}</div>
                <div className="invite-meta">Invited for: {invite.roleOffered || 'Player'} slot - Sent {formatSentTime(invite.sentAt)}</div>
              </div>
              <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
              {invite.status === 'pending' ? (
                <button className="btn-table-danger btn-revoke-mini" onClick={() => revoke(invite.id, username)}>Revoke</button>
              ) : (
                <span className={`status-text-${invite.status === 'accepted' ? 'green' : 'red'}`}>
                  {invite.status === 'accepted' ? 'Joined team' : 'Invitation closed'}
                </span>
              )}
            </div>
          );
        })}

        <div className="invites-footer-actions">
          <Link to={inviteMoreHref} className="btn-primary invite-more-btn">+ Invite More Players</Link>
        </div>
      </div>
    </main>
  );
}


