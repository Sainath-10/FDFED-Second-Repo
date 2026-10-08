/**
 * NEXUS ESPORTS — Join Requests
 *
 * pending join requests
 * with accept/decline, a tab badge count, and the empty state.
 */
import { useTeamContext } from '../../hooks/useTeamContext.js';
import NexusTeamWorkflow from '../../services/teamWorkflow.js';
import TeamTabs from '../../components/TeamTabs.jsx';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/team/join-requests.css';

export default function JoinRequests() {
  const { ctx, refresh } = useTeamContext();

  if (!ctx || !ctx.comp || !ctx.team) {
    return <main className="main-content"><h1 className="page-title">Team</h1></main>;
  }

  const { comp, team, session, context } = ctx;
  const pending = (NexusTeamWorkflow.getJoinRequests(comp.id, team.id) || []).filter((r) => r.status === 'pending');
  const canManage = !!(session && (session.username || '').toLowerCase() === (team.createdBy || '').toLowerCase());
  const isEnded = !!(comp.ended || comp.status === 'completed');

  function handleRequest(requestId, username, action) {
    const result = NexusTeamWorkflow.decideJoinRequest({ compId: comp.id, teamId: team.id, requestId, action });
    if (!result.ok) { showToast(result.error || 'Failed to update request.', 'error'); return; }
    if (action === 'accepted') showToast(`${username} accepted to ${team.name}!`);
    else showToast(`${username}'s request declined.`, 'error');
    refresh();
  }

  return (
    <main className="main-content">
      <h1 className="page-title">{team.name}</h1>
      <p className="page-subtitle">Players who have requested to join your team</p>

      <TeamTabs active="join-requests" context={context} canManage={canManage} isEnded={isEnded} joinRequestCount={pending.length} />

      <div id="requests-list" className="requests-stack">
        {pending.length === 0 ? (
          <div id="no-requests" className="empty-state-card" style={{ display: 'block' }}>
            <div className="empty-emoji">OK</div>
            <div className="empty-title">All caught up!</div>
            <div className="empty-subtitle">No pending join requests.</div>
          </div>
        ) : (
          pending.map((req) => {
            const initial = (req.displayName || req.username || 'U').charAt(0).toUpperCase();
            const when = req.requestedAt ? new Date(req.requestedAt).toLocaleString() : 'just now';
            return (
              <div className="request-card request-card-alt" id={req.id} key={req.id}>
                <div className="request-avatar-md">{initial}</div>
                <div className="request-info-wrapper">
                  <div className="request-name">{req.displayName || req.username}</div>
                  <div className="request-meta">Username: {req.username}</div>
                  <div className="request-time">Requested: {when}</div>
                </div>
                <div className="request-slot-info">{req.message ? `Message: "${req.message}"` : 'No message provided'}</div>
                <div className="request-actions-row">
                  <button className="btn-notif-accept" onClick={() => handleRequest(req.id, req.username, 'accepted')}>Accept</button>
                  <button className="btn-notif-reject" onClick={() => handleRequest(req.id, req.username, 'declined')}>Decline</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}


