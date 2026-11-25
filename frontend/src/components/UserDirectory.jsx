/**
 * NEXUS ESPORTS — user directory
 *
 * Every account from the backend. The only action here is unbanning an
 * account that reached three warnings; there is no manual warn, ban or
 * password reset. The backend enforces who may act on whom (nobody can act on
 * themselves or on a Super Admin; only a Super Admin can act on other staff).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthAPI } from '../services/api.js';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, formatDate } from './ui.jsx';
import { showToast } from '../lib/toast.js';

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  finance_moderator: 'Finance',
  community_moderator: 'Moderator',
  team_lead: 'Team lead',
  participant: 'Player',
};
const STAFF = ['super_admin', 'finance_moderator', 'community_moderator'];
const roleOf = (u) => (u.adminType && ROLE_LABEL[u.adminType] ? u.adminType : u.role);

export default function UserDirectory({ title = 'Users', subtitle = 'Every registered account.' }) {
  const { session } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [acting, setActing] = useState(null);
  const isSuper = session?.role === 'super-admin';

  const load = useCallback(async () => {
    const res = await AuthAPI.getAllUsers();
    if (res.ok) { setUsers(Array.isArray(res.data) ? res.data : []); setError(''); } else setError(res.error || 'Unable to load users.');
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || []).filter((u) => {
      const role = roleOf(u);
      if (roleFilter === 'staff' && !STAFF.includes(role)) return false;
      if (roleFilter === 'players' && STAFF.includes(role)) return false;
      if (roleFilter === 'banned' && !u.banned) return false;
      return !q || `${u.username} ${u.email} ${ROLE_LABEL[role] || role}`.toLowerCase().includes(q);
    });
  }, [users, query, roleFilter]);

  function canModerate(u) {
    const role = roleOf(u);
    if (u.username === session?.username || role === 'super_admin') return false;
    return isSuper || !STAFF.includes(role);
  }

  async function unban() {
    const { user } = acting;
    const res = await AuthAPI.unbanUser(user.id);
    if (!res.ok) { showToast(res.error || 'That action failed.', 'error'); return; }
    setActing(null);
    showToast(`@${user.username} was unbanned.`);
    load();
  }

  return (
    <main className="main-content">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="sub-panel-toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="search" className="form-input" style={{ maxWidth: 360 }} aria-label="Search users" placeholder="Search by username, email or role…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="form-input" style={{ maxWidth: 200 }} aria-label="Filter users" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All accounts</option>
          <option value="players">Players</option>
          <option value="staff">Staff</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && users === null && <LoadingState label="Loading users…" />}
      {!error && users && visible.length === 0 && <EmptyState title="No users match" />}
      {!error && users && visible.length > 0 && (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Warnings</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visible.map((u) => {
                const role = roleOf(u);
                return (
                  <tr key={u.id} style={u.banned ? { opacity: 0.65 } : undefined}>
                    <td>@{u.username}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABEL[role] || role}</td>
                    <td>{u.warningCount || 0} / 3</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u.banned ? <span className="status-pill rejected">Banned</span> : <span className="status-pill approved">Active</span>}</td>
                    <td>
                      {canModerate(u) && u.banned ? (
                        <div className="ui-row-actions">
                          <button type="button" className="btn-table-primary" onClick={() => setActing({ user: u })}>Unban</button>
                        </div>
                      ) : <span style={{ color: 'var(--text-dimmer)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!acting}
        tone="primary"
        title={`Unban @${acting?.user.username}`}
        message="The account can log in again and its warnings are cleared."
        confirmLabel="Unban"
        onConfirm={unban}
        onClose={() => setActing(null)}
      />
    </main>
  );
}
