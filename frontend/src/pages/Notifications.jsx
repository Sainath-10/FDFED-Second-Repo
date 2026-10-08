/**
 * NEXUS ESPORTS — Notifications
 *
 *
 * per-user notifications from the team workflow, with status tabs + search
 * filtering, accept/reject actions for pending invites/join-requests, counts and
 * "Mark All Read".
 */
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/notifications.css';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const statusClassOf = (item) => {
  const s = item.status || 'pending';
  return s === 'approved' ? 'approved' : (s === 'rejected' ? 'rejected' : 'pending');
};

export default function Notifications() {
  const { session } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);

  const items = useMemo(() => {
    if (!session || !NexusTeamWorkflow || typeof NexusTeamWorkflow.getNotificationsForUser !== 'function') return [];
    return NexusTeamWorkflow.getNotificationsForUser(session.username) || [];
  }, [session, version]);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, approved: 0, rejected: 0 };
    items.forEach((i) => { c[statusClassOf(i)] += 1; });
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((item) => {
      const sc = statusClassOf(item);
      const matchesTab = activeFilter === 'all' || sc === activeFilter;
      if (!matchesTab) return false;
      if (!q) return true;
      const title = String(item.title || '').toLowerCase();
      const body = String(item.body || '').toLowerCase();
      return title.includes(q) || body.includes(q) || sc.includes(q);
    });
  }, [items, activeFilter, query]);

  function markAllRead() {
    if (session && NexusTeamWorkflow && typeof NexusTeamWorkflow.markAllNotificationsRead === 'function') {
      NexusTeamWorkflow.markAllNotificationsRead(session.username);
    }
    setVersion((v) => v + 1);
    showToast('All notifications marked as read.');
  }

  function processAction(notificationId, action) {
    if (!session || !NexusTeamWorkflow) { showToast('Please log in first.', 'error'); return; }
    const item = NexusTeamWorkflow.getNotificationById(notificationId, session.username);
    if (!item) { showToast('Notification not found.', 'error'); return; }

    const meta = item.meta || {};
    let result = { ok: false, error: 'Unsupported action.' };
    if (item.type === 'team-join-request') {
      result = NexusTeamWorkflow.decideJoinRequest({ compId: meta.compId, teamId: meta.teamId, requestId: meta.requestId, action });
    } else if (item.type === 'team-invite') {
      result = NexusTeamWorkflow.decideInvite({ compId: meta.compId, teamId: meta.teamId, inviteId: meta.inviteId, action });
    } else if (item.type === 'co-organizer-invite') {
      result = NexusTeamWorkflow.decideCoOrganizerInvite({ compId: meta.compId, action });
    }

    if (!result.ok) { showToast(result.error || 'Action failed.', 'error'); return; }

    const finalStatus = action === 'accepted' ? 'approved' : 'rejected';
    const finalVerb = action === 'accepted' ? 'accepted' : 'declined';
    NexusTeamWorkflow.updateNotification(notificationId, {
      status: finalStatus,
      read: true,
      body: `${item.body || ''} (You ${finalVerb} this.)`,
    }, session.username);

    showToast(`Request ${finalVerb} successfully.`);
    setVersion((v) => v + 1);
  }

  const pendingTypes = ['team-join-request', 'team-invite', 'co-organizer-invite'];

  return (
    <main className="main-content">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Stay updated on your competitions, team, and matches.</p>
        </div>
        <button onClick={markAllRead} className="btn-outline header-btn">Mark All Read</button>
      </div>

      <div className="search-wrap">
        <div className="search-inner">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="notif-search" placeholder="Search notifications by title, content or status..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="tabs-row-high">
        {TABS.map((tab) => (
          <div key={tab.id} className={`notif-tab${activeFilter === tab.id ? ' active' : ''}`} data-filter={tab.id} onClick={() => setActiveFilter(tab.id)}>
            {tab.label} <span className="count-badge">{counts[tab.id]}</span>
          </div>
        ))}
      </div>

      <div className="notif-container">
        <div className="notif-list" id="notif-list">
          {visible.map((item) => {
            const sc = statusClassOf(item);
            const type = item.type || 'system';
            const when = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'just now';
            const isJoinRequest = type === 'team-join-request';
            const isCoOrgInvite = type === 'co-organizer-invite';
            const showActions = sc === 'pending' && pendingTypes.includes(type);
            const positiveLabel = isJoinRequest ? 'Accept Player' : (isCoOrgInvite ? 'Accept Co-Organizer' : 'Accept Invite');
            const negativeLabel = isJoinRequest ? 'Reject Player' : (isCoOrgInvite ? 'Decline Co-Organizer' : 'Reject Invite');

            return (
              <div
                key={item.id}
                className={`notif-item status-${sc}${item.read ? '' : ' unread'}`}
                data-status={sc}
                data-dynamic="true"
                data-notif-id={item.id}
                data-notif-type={type}
              >
                {!item.read && <div className="notif-dot"></div>}
                <div className={`notif-status-label status-${sc}-bg`}>{sc.toUpperCase()}</div>
                <div className="notif-content-wrap">
                  <div className="notif-title-row">
                    <h3>{item.title || 'Notification'}</h3>
                    <span className="notif-time-alt">{when}</span>
                  </div>
                  <p className="notif-body-text">{item.body || ''}</p>
                  {showActions && (
                    <div className="notif-actions-row">
                      <button className="btn-notif-accept" onClick={() => processAction(item.id, 'accepted')}>{positiveLabel}</button>
                      <button className="btn-notif-reject" onClick={() => processAction(item.id, 'declined')}>{negativeLabel}</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div id="notif-empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <h3 style={{ color: 'var(--text-white)', marginBottom: 8 }}>No notifications yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>You'll be notified about team invites, competition updates, and match results here.</p>
          </div>
        )}
      </div>
    </main>
  );
}


