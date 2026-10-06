import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusAuth } from '../services/authService';
import { NexusTeamWorkflow } from '../services/teamService';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/notifications.css';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [session, setSession] = useState(() => {
    if (NexusAuth && typeof NexusAuth.getSession === 'function') {
      const s = NexusAuth.getSession();
      if (s && s.username) return s;
    }
    try {
      const raw = localStorage.getItem('nexus.auth.session');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  });

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = () => {
    if (!session || !session.username || !NexusTeamWorkflow) return;
    const items = NexusTeamWorkflow.getNotificationsForUser
      ? NexusTeamWorkflow.getNotificationsForUser(session.username)
      : [];
    setNotifications(items);
  };

  useEffect(() => {
    if (!session || !session.username) {
      navigate('/login', { replace: true });
      return;
    }
    loadNotifications();
  }, [session, navigate]);

  if (!session) return null;

  const markAllRead = () => {
    if (NexusTeamWorkflow && typeof NexusTeamWorkflow.markAllNotificationsRead === 'function') {
      NexusTeamWorkflow.markAllNotificationsRead(session.username);
    }
    loadNotifications();
    showToast('All notifications marked as read.');
  };

  const processNotificationAction = (notificationId, action) => {
    if (!NexusTeamWorkflow) {
      showToast('Notification service unavailable.', 'error');
      return;
    }

    const item = NexusTeamWorkflow.getNotificationById(notificationId, session.username);
    if (!item) {
      showToast('Notification not found.', 'error');
      return;
    }

    const meta = item.meta || {};
    let result = { ok: false, error: 'Unsupported action.' };

    if (item.type === 'team-join-request') {
      result = NexusTeamWorkflow.decideJoinRequest({
        compId: meta.compId,
        teamId: meta.teamId,
        requestId: meta.requestId,
        action
      });
    } else if (item.type === 'team-invite') {
      result = NexusTeamWorkflow.decideInvite({
        compId: meta.compId,
        teamId: meta.teamId,
        inviteId: meta.inviteId,
        action
      });
    } else if (item.type === 'co-organizer-invite') {
      result = NexusTeamWorkflow.decideCoOrganizerInvite({
        compId: meta.compId,
        action
      });
    }

    if (!result.ok) {
      showToast(result.error || 'Action failed.', 'error');
      return;
    }

    const finalStatus = action === 'accepted' ? 'approved' : 'rejected';
    const finalVerb = action === 'accepted' ? 'accepted' : 'declined';
    NexusTeamWorkflow.updateNotification(notificationId, {
      status: finalStatus,
      read: true,
      body: (item.body || '') + ' (You ' + finalVerb + ' this.)'
    }, session.username);

    showToast('Request ' + finalVerb + ' successfully.');
    loadNotifications();
  };

  // Counts
  const counts = {
    all: notifications.length,
    pending: notifications.filter(n => (n.status || 'pending') === 'pending').length,
    approved: notifications.filter(n => n.status === 'approved').length,
    rejected: notifications.filter(n => n.status === 'rejected').length
  };

  // Filtering
  const filteredNotifications = notifications.filter(item => {
    const status = item.status || 'pending';
    const statusClass = status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending');
    const matchesTab = activeFilter === 'all' || statusClass === activeFilter;

    const q = searchQuery.toLowerCase().trim();
    const title = (item.title || '').toLowerCase();
    const body = (item.body || '').toLowerCase();
    const matchesSearch = !q || title.includes(q) || body.includes(q) || statusClass.includes(q);

    return matchesTab && matchesSearch;
  });

  return (
    <Shell activeTab="notifications">
      <main className="main-content">
          <div className="page-header-row">
            <div>
              <h1 className="page-title">Notifications</h1>
              <p className="page-subtitle">Stay updated on your competitions, team, and matches.</p>
            </div>
            <button type="button" onClick={markAllRead} className="btn-outline header-btn">
              Mark All Read
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-wrap">
            <div className="search-inner">
              <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="notif-search"
                placeholder="Search notifications by title, content or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter chips */}
          <div className="tabs-row-high">
            <div
              className={`notif-tab ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All <span className="count-badge">{counts.all}</span>
            </div>
            <div
              className={`notif-tab ${activeFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveFilter('pending')}
            >
              Pending <span className="count-badge">{counts.pending}</span>
            </div>
            <div
              className={`notif-tab ${activeFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveFilter('approved')}
            >
              Approved <span className="count-badge">{counts.approved}</span>
            </div>
            <div
              className={`notif-tab ${activeFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveFilter('rejected')}
            >
              Rejected <span className="count-badge">{counts.rejected}</span>
            </div>
          </div>

          {/* Notifications container */}
          <div className="notif-container">
            {notifications.length === 0 ? (
              <div id="notif-empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔔</div>
                <h3 style={{ color: 'var(--text-white)', marginBottom: '8px' }}>No notifications yet</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  You'll be notified about team invites, competition updates, and match results here.
                </p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No notifications match your search or filter.
              </div>
            ) : (
              <div className="notif-list" id="notif-list">
                {filteredNotifications.map(item => {
                  const status = item.status || 'pending';
                  const statusClass = status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending');
                  const unreadClass = item.read ? '' : ' unread';
                  const when = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'just now';

                  const isJoinRequest = item.type === 'team-join-request';
                  const isInvite = item.type === 'team-invite';
                  const isCoOrgInvite = item.type === 'co-organizer-invite';
                  const hasActions = statusClass === 'pending' && (isJoinRequest || isInvite || isCoOrgInvite);
                  const positiveLabel = isJoinRequest ? 'Accept Player' : (isCoOrgInvite ? 'Accept Co-Organizer' : 'Accept Invite');
                  const negativeLabel = isJoinRequest ? 'Reject Player' : (isCoOrgInvite ? 'Decline Co-Organizer' : 'Reject Invite');

                  return (
                    <div
                      key={item.id}
                      className={`notif-item status-${statusClass}${unreadClass}`}
                    >
                      {!item.read && <div className="notif-dot"></div>}
                      <div className={`notif-status-label status-${statusClass}-bg`}>
                        {statusClass.toUpperCase()}
                      </div>
                      <div className="notif-content-wrap">
                        <div className="notif-title-row">
                          <h3>{item.title || 'Notification'}</h3>
                          <span className="notif-time-alt">{when}</span>
                        </div>
                        <p className="notif-body-text">{item.body || ''}</p>
                        {hasActions && (
                          <div className="notif-actions-row">
                            <button
                              type="button"
                              className="btn-notif-accept"
                              onClick={() => processNotificationAction(item.id, 'accepted')}
                            >
                              {positiveLabel}
                            </button>
                            <button
                              type="button"
                              className="btn-notif-reject"
                              onClick={() => processNotificationAction(item.id, 'declined')}
                            >
                              {negativeLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
    </Shell>
  );
}
