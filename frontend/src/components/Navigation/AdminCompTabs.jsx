import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

export default function AdminCompTabs({ activeTab, variant }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const id = searchParams.get('id') || searchParams.get('compId') || '';
  const querySuffix = id ? `?id=${encodeURIComponent(id)}` : (variant || '');

  const tabs = [
    { id: 'overview', label: 'Overview', path: `/admin/competition-detail${querySuffix}` },
    { id: 'teams', label: 'Manage Teams', path: `/admin/manage-teams${querySuffix}` },
    { id: 'matches', label: 'Manage Matches', path: `/admin/manage-matches${querySuffix}` },
    { id: 'results', label: 'Match Results', path: `/admin/match-results${querySuffix}` },
    { id: 'standings', label: 'Standings', path: `/admin/view-standings${querySuffix}` },
    { id: 'disputes', label: 'Disputes', path: `/admin/dispute-review${querySuffix}` },
    { id: 'edit', label: 'Edit', path: `/admin/edit-competition${querySuffix}` },
  ];

  const currentTab = activeTab || (
    location.pathname.includes('competition-detail') ? 'overview' :
    location.pathname.includes('manage-teams') ? 'teams' :
    location.pathname.includes('manage-matches') ? 'matches' :
    location.pathname.includes('match-results') ? 'results' :
    location.pathname.includes('view-standings') ? 'standings' :
    location.pathname.includes('dispute-review') ? 'disputes' :
    location.pathname.includes('edit-competition') ? 'edit' : ''
  );

  return (
    <div className="admin-comp-tabs">
      {tabs.map(tab => (
        <Link
          key={tab.id}
          to={tab.path}
          className={`admin-tab ${currentTab === tab.id ? 'active' : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
