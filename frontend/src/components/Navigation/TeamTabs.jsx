import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import NexusTeamWorkflow from '../../services/teamService';

export default function TeamTabs({ activeTab }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const compId = searchParams.get('compId') || searchParams.get('id') || (NexusTeamWorkflow.getActiveTeamContext() || {}).compId;
  const teamId = searchParams.get('teamId') || (NexusTeamWorkflow.getActiveTeamContext() || {}).teamId;

  const querySuffix = compId && teamId ? `?compId=${encodeURIComponent(compId)}&teamId=${encodeURIComponent(teamId)}` : '';

  // Calculate pending requests count for badge
  let pendingRequestsCount = 0;
  if (compId && teamId) {
    const requests = NexusTeamWorkflow.getJoinRequests(compId, teamId) || [];
    pendingRequestsCount = requests.filter(r => r && r.status === 'pending').length;
  }

  const tabs = [
    { id: 'roster', label: 'Roster', path: `/team/team-roster${querySuffix}` },
    { id: 'add-players', label: 'Add Players', path: `/team/add-players${querySuffix}` },
    { id: 'join-requests', label: 'Join Requests', path: `/team/join-requests${querySuffix}`, badge: pendingRequestsCount },
    { id: 'invitations', label: 'Invitations Sent', path: `/team/invitations-sent${querySuffix}` },
    { id: 'settings', label: 'Settings', path: `/team/team-settings${querySuffix}` },
  ];

  const currentTab = activeTab || (
    location.pathname.includes('team-roster') ? 'roster' :
    location.pathname.includes('add-players') ? 'add-players' :
    location.pathname.includes('join-requests') ? 'join-requests' :
    location.pathname.includes('invitations-sent') ? 'invitations' :
    location.pathname.includes('team-settings') ? 'settings' : ''
  );

  return (
    <div className="team-tabs-nav">
      {tabs.map(tab => (
        <Link
          key={tab.id}
          to={tab.path}
          className={`team-tab ${currentTab === tab.id ? 'active' : ''}`}
        >
          {tab.label}
          {tab.badge > 0 && (
            <span className="notif-badge-sm" style={{ marginLeft: 6 }}>
              {tab.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
