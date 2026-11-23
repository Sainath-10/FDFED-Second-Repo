/**
 * NEXUS ESPORTS — Super Admin · Admins
 *
 * Every staff account from the backend, with links to add, revoke and view
 * each person's activity.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthAPI } from '../../services/api.js';
import { ADMIN_ROLE_OPTIONS } from '../../lib/adminRoles.js';
import { EmptyState, ErrorState, LoadingState, PageHeader, formatDate } from '../../components/ui.jsx';

const STAFF = ['super_admin', 'finance_moderator', 'community_moderator'];
const typeOf = (u) => (STAFF.includes(u.adminType) ? u.adminType : u.role);
const labelOf = (type) => ADMIN_ROLE_OPTIONS.find((o) => o.value === type)?.label || type;

export default function Admins() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const load = useCallback(async () => {
    const res = await AuthAPI.getAllUsers();
    if (!res.ok) { setError(res.error || 'Unable to load administrators.'); return; }
    setError('');
    setRows((res.data || []).filter((u) => STAFF.includes(typeOf(u))).sort((a, b) => labelOf(typeOf(a)).localeCompare(labelOf(typeOf(b))) || a.username.localeCompare(b.username)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter((u) => (roleFilter === 'all' || typeOf(u) === roleFilter) && (!q || `${u.username} ${u.email} ${labelOf(typeOf(u))}`.toLowerCase().includes(q)));
  }, [rows, query, roleFilter]);

  return (
    <main className="main-content">
      <PageHeader
        title="Administrators"
        subtitle="Every staff account on the platform."
        actions={<>
          <Link className="btn-cancel" to="/pages/super-admin/revoke-admin.html">Revoke access</Link>
          <Link className="btn-primary" to="/pages/super-admin/add-admin.html">+ Add administrator</Link>
        </>}
      />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="search" className="form-input" style={{ maxWidth: 340 }} aria-label="Search administrators" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="form-input" style={{ maxWidth: 220 }} aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          {ADMIN_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && rows === null && <LoadingState label="Loading administrators…" />}
      {!error && rows && visible.length === 0 && <EmptyState title="No administrators match" />}
      {!error && rows && visible.length > 0 && (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Since</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visible.map((u) => {
                const type = typeOf(u);
                const activity = type === 'community_moderator'
                  ? `/pages/moderator/activity.html?admin=${encodeURIComponent(u.username)}`
                  : `/pages/admin/admin-activity.html?admin=${encodeURIComponent(u.username)}`;
                return (
                  <tr key={u.id}>
                    <td>@{u.username}</td>
                    <td>{u.email}</td>
                    <td>{labelOf(type)}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u.banned ? <span className="status-pill rejected">Banned</span> : <span className="status-pill approved">Active</span>}</td>
                    <td>
                      <div className="ui-row-actions">
                        <Link className="btn-table-secondary" to={activity}>Activity</Link>
                        <Link className="btn-table-danger" to={`/pages/super-admin/revoke-admin.html?username=${encodeURIComponent(u.username)}`}>Revoke</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
