/**
 * NEXUS ESPORTS — Invitations Sent
 *
 * Invitations this team sent, from the backend, with revoke for pending ones.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import { TeamsAPI } from '../../services/api.js';
import TeamHeader from '../../components/TeamHeader.jsx';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, formatDate } from '../../components/ui.jsx';
import { teamGate } from './TeamGate.jsx';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/team/invitations-sent.css';

const STATUS_CLASS = { accepted: 'approved', declined: 'rejected', revoked: 'rejected', pending: 'pending' };

export default function InvitationsSent() {
  const t = useTeamContext();
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);
  const [revoking, setRevoking] = useState(null);
  const teamId = t.team?.id;

  const load = useCallback(async () => {
    if (!teamId) return;
    const [inv, req] = await Promise.all([TeamsAPI.getTeamInvites(teamId), TeamsAPI.getJoinRequests(teamId)]);
    if (inv.ok) { setInvites(Array.isArray(inv.data) ? inv.data : []); setError(''); } else setError(inv.error || 'Unable to load invitations.');
    if (req.ok && Array.isArray(req.data)) setPendingRequests(req.data.filter((r) => r.status === 'pending').length);
  }, [teamId]);

  useEffect(() => { if (t.canManage) load(); }, [load, t.canManage]);

  const gate = teamGate(t, { captainOnly: true, title: 'Invitations sent' });
  if (gate) return gate;

  const { team, comp, isEnded } = t;

  async function revoke() {
    const res = await TeamsAPI.revokeInvite(team.id, revoking.id);
    if (!res.ok) { showToast(res.error || 'Unable to revoke the invitation.', 'error'); return; }
    showToast(`Invitation to ${revoking.toUsername} revoked.`);
    setRevoking(null);
    load();
  }

  return (
    <main className="main-content">
      <TeamHeader t={t} active="invitations" joinRequestCount={pendingRequests} />
      <div className="td-section-head">
        <div>
          <h2 className="td-section-title">Invitations sent</h2>
          <p className="td-section-sub">Players you invited, and whether they accepted.</p>
        </div>
        {!isEnded && <Link to={`/pages/team/add-players.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`} className="td-btn td-btn-primary">+ Invite more players</Link>}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && invites === null && <LoadingState label="Loading invitations…" />}
      {!error && invites && invites.length === 0 && <EmptyState title="No invitations yet" message="Invitations you send appear here with their status." />}

      <div className="ui-list">
        {(invites || []).map((invite) => (
          <div className="ui-row" key={invite.id}>
            <div className="ui-avatar">{String(invite.toUsername || 'U').charAt(0).toUpperCase()}</div>
            <div className="ui-row-main">
              <div className="ui-row-title">@{invite.toUsername}</div>
              <div className="ui-row-meta">Sent {formatDate(invite.createdAt, true)} by @{invite.fromUsername}</div>
            </div>
            <span className={`status-pill ${STATUS_CLASS[invite.status] || 'pending'}`}>{String(invite.status || 'pending').toUpperCase()}</span>
            {invite.status === 'pending' && !isEnded && (
              <button type="button" className="btn-table-danger" onClick={() => setRevoking(invite)}>Revoke</button>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!revoking}
        title="Revoke invitation"
        message={revoking ? `Revoke the invitation to @${revoking.toUsername}? They will no longer be able to accept it.` : ''}
        confirmLabel="Revoke"
        onConfirm={revoke}
        onClose={() => setRevoking(null)}
      />
    </main>
  );
}
