import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import TeamTabs from '../../components/Navigation/TeamTabs';
import { useToast } from '../../components/Common/Toast';
import { NexusTeamWorkflow } from '../../services/teamService';
import '../../styles/pages/team/invitations-sent.css';

export default function TeamInvitesPage() {
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
          <h2>Loading...</h2>
        </main>
      </Shell>
    );
  }

  const { comp, team } = pageContext;
  const invites = NexusTeamWorkflow.getInvites(comp.id, team.id) || [];
  const querySuffix = `?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;

  const formatSentTime = (value) => {
    if (!value) return 'just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'just now';
    return date.toLocaleString();
  };

  const handleRevoke = (inviteId, username) => {
    if (!window.confirm(`Revoke invitation to ${username}?`)) return;

    const result = NexusTeamWorkflow.revokeInvite({
      compId: comp.id,
      teamId: team.id,
      inviteId: inviteId,
    });

    if (!result.ok) {
      showToast(result.error || 'Failed to revoke invite.', 'error');
      return;
    }

    showToast(`Invitation to ${username} revoked.`, 'error');
    setTick(t => t + 1);
  };

  return (
    <Shell activeItem="activity">
      <main className="main-content">
        <h1 className="page-title">{team.name}</h1>
        <p className="page-subtitle">Track invitations you've sent to players</p>

        <TeamTabs activeTab="invitations" />

        <div className="invites-stack">
          {invites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              No invitations have been sent yet.
            </div>
          ) : (
            invites.map((invite) => {
              const username = invite.toUsername || 'user';
              const initial = username.charAt(0).toUpperCase();
              const isAccepted = invite.status === 'accepted';
              const isDeclined = invite.status === 'declined';
              const isPending = !isAccepted && !isDeclined;

              const rowClass = isAccepted
                ? 'invite-row invite-row-accepted'
                : isDeclined
                ? 'invite-row invite-row-declined'
                : 'invite-row';

              const avatarClass = isAccepted
                ? 'invite-avatar-sm avatar-accepted'
                : isDeclined
                ? 'invite-avatar-sm avatar-declined'
                : 'invite-avatar-sm';

              const statusPillClass = isAccepted ? 'approved' : isDeclined ? 'rejected' : 'pending';
              const statusLabel = isAccepted ? 'Accepted' : isDeclined ? 'Declined' : 'Pending';

              return (
                <div className={rowClass} key={invite.id} data-invite-id={invite.id}>
                  <div className={avatarClass}>{initial}</div>
                  <div className="invite-info-wrapper">
                    <div className="invite-name">{username}</div>
                    <div className="invite-meta">
                      Invited for: {invite.roleOffered || 'Player'} slot · Sent {formatSentTime(invite.sentAt)}
                    </div>
                  </div>
                  <span className={`status-pill ${statusPillClass}`}>{statusLabel}</span>
                  {isPending ? (
                    <button
                      className="btn-table-danger btn-revoke-mini"
                      onClick={() => handleRevoke(invite.id, username)}
                    >
                      Revoke
                    </button>
                  ) : (
                    <span className={isAccepted ? 'status-text-green' : 'status-text-red'}>
                      {isAccepted ? '✓ Joined team' : '✗ Declined offer'}
                    </span>
                  )}
                </div>
              );
            })
          )}

          <div className="invites-footer-actions">
            <Link to={`/team/add-players${querySuffix}`} className="btn-primary invite-more-btn">
              + Invite More Players
            </Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
