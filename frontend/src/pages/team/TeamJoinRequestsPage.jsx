import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import TeamTabs from '../../components/Navigation/TeamTabs';
import { useToast } from '../../components/Common/Toast';
import { NexusTeamWorkflow } from '../../services/teamService';
import '../../styles/pages/team/join-requests.css';

export default function TeamJoinRequestsPage() {
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
  const allRequests = NexusTeamWorkflow.getJoinRequests(comp.id, team.id) || [];
  const pending = allRequests.filter(req => req.status === 'pending');

  const handleDecision = (requestId, username, action) => {
    const result = NexusTeamWorkflow.decideJoinRequest({
      compId: comp.id,
      teamId: team.id,
      requestId: requestId,
      action: action,
    });

    if (!result.ok) {
      showToast(result.error || 'Failed to update request.', 'error');
      return;
    }

    if (action === 'accepted') {
      showToast(`${username} accepted to ${team.name}!`);
    } else {
      showToast(`${username}'s request declined.`, 'error');
    }

    setTick(t => t + 1);
  };

  return (
    <Shell activeItem="activity">
      <main className="main-content">
        <h1 className="page-title">{team.name}</h1>
        <p className="page-subtitle">Players who have requested to join your team</p>

        <TeamTabs activeTab="join-requests" />

        <div id="requests-list" className="requests-stack">
          {pending.length === 0 ? (
            <div id="no-requests" className="empty-state-card" style={{ display: 'block' }}>
              <div className="empty-emoji">✅</div>
              <div className="empty-title">All caught up!</div>
              <div className="empty-subtitle">No pending join requests.</div>
            </div>
          ) : (
            pending.map((req) => {
              const displayName = req.displayName || req.username || 'User';
              const initial = displayName.charAt(0).toUpperCase();
              const when = req.requestedAt ? new Date(req.requestedAt).toLocaleString() : 'just now';

              return (
                <div className="request-card request-card-alt" id={req.id} key={req.id}>
                  <div className="request-avatar-md">{initial}</div>
                  <div className="request-info-wrapper">
                    <div className="request-name">{displayName}</div>
                    <div className="request-meta">Username: {req.username}</div>
                    <div className="request-time">Requested: {when}</div>
                  </div>
                  <div className="request-slot-info">
                    {req.message ? `Message: "${req.message}"` : 'No message provided'}
                  </div>
                  <div className="request-actions-row">
                    <button
                      className="btn-notif-accept"
                      onClick={() => handleDecision(req.id, req.username, 'accepted')}
                    >
                      Accept
                    </button>
                    <button
                      className="btn-notif-reject"
                      onClick={() => handleDecision(req.id, req.username, 'declined')}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </Shell>
  );
}
