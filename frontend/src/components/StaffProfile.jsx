/**
 * NEXUS ESPORTS — staff profile
 *
 * Shared profile for Admins, Super Admins, Finance and Community Moderators:
 * who they are, their most recent real actions, and account settings.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AdminAPI, ReportsAPI } from '../services/api.js';
import AccountSettings from './AccountSettings.jsx';
import { EmptyState, LoadingState, PageHeader, formatDate } from './ui.jsx';

const ROLE_LABEL = { admin: 'Admin', 'super-admin': 'Super Admin', finance_moderator: 'Finance moderator', community_moderator: 'Community moderator' };
const label = (type) => String(type || 'ACTION').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function StaffProfile() {
  const { session } = useAuth();
  const moderator = session?.role === 'community_moderator';
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    if (!session?.username) return;
    if (moderator) {
      ReportsAPI.moderatorActivity().then((res) => setActivity(res.ok ? (res.data || []).map((r) => ({
        id: r.id, actionType: r.status === 'discarded' ? 'REPORT_DISCARDED' : 'REPORT_DECIDED', details: `${r.code} — ${r.competitionName}`, timestamp: r.resolvedAt || r.updatedAt,
      })) : []));
    } else {
      AdminAPI.getActivity(session.username).then((res) => setActivity(res.ok ? res.data || [] : []));
    }
  }, [session?.username, moderator]);

  const allHref = moderator ? '/pages/moderator/activity.html' : '/pages/admin/admin-activity.html';

  return (
    <main className="main-content">
      <PageHeader title="Profile" subtitle={`${ROLE_LABEL[session?.role] || 'Staff'} account`} />
      <div className="ui-card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        {session?.profilePicUrl
          ? <img src={session.profilePicUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
          : <span className="ui-avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{String(session?.username || '?').charAt(0).toUpperCase()}</span>}
        <div>
          <div className="ui-row-title" style={{ fontSize: 20 }}>@{session?.username}</div>
          <div className="ui-row-meta">{ROLE_LABEL[session?.role] || 'Staff'} · {session?.email}</div>
          {session?.bio && <p className="ui-row-meta" style={{ marginTop: 6, color: 'var(--text-light)' }}>{session.bio}</p>}
        </div>
      </div>

      <section className="ui-card" style={{ marginBottom: 20 }}>
        <div className="ui-row-actions" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 className="ui-card-title" style={{ margin: 0 }}>Recent activity</h2>
          <Link className="btn-table-secondary" to={allHref}>View all</Link>
        </div>
        {activity === null && <LoadingState label="Loading activity…" />}
        {activity && activity.length === 0 && <EmptyState title="No activity yet" />}
        {activity && activity.slice(0, 6).map((r) => (
          <div className="ui-kv" key={r.id}><span className="k">{label(r.actionType)} — {r.details}</span><span className="v">{formatDate(r.timestamp, true)}</span></div>
        ))}
      </section>

      <AccountSettings />
    </main>
  );
}
