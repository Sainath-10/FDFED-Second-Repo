/**
 * NEXUS ESPORTS — Super Admin · Admins Roster
 *
 * Original roster layout (header actions, sa-users-card / sa-users-table,
 * search, role/status filters). Each administrator has exactly one action:
 * View Activity. Community Moderators open the moderator Activity page; other
 * administrator roles keep using the existing Admin Activity page.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listAdministrativeAccounts } from '../../services/auth.js';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/users.css';

const normalize = (v) => String(v || '').trim().toLowerCase();

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'comp_admin', label: 'Comp Admin' },
  { value: 'dispute_admin', label: 'Dispute Admin' },
  { value: 'revenue_admin', label: 'Revenue Admin' },
  { value: 'community_moderator', label: 'Community Moderator' },
];

function formatAdminType(role, adminType) {
  const r = normalize(role);
  const t = normalize(adminType);
  if (r === 'community_moderator' || t === 'community_moderator') return { key: 'community_moderator', label: 'Community Moderator', icon: '🚩', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)', border: 'rgba(244, 114, 182, 0.3)' };
  if (r === 'comp_admin' || t === 'comp_admin') return { key: 'comp_admin', label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
  if (r === 'dispute_admin' || t === 'dispute_admin') return { key: 'dispute_admin', label: 'Dispute Admin', icon: '🛡️', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)' };
  if (r === 'revenue_admin' || t === 'revenue_admin') return { key: 'revenue_admin', label: 'Revenue Admin', icon: '💳', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)' };
  if (r === 'super_admin' || r === 'super-admin' || t === 'super_admin') return { key: 'super_admin', label: 'Super Admin', icon: '⚡', color: '#c6ff33', bg: 'rgba(198, 255, 51, 0.15)', border: 'rgba(198, 255, 51, 0.3)' };
  if (r === 'admin' || t === 'admin') return { key: 'admin', label: 'Admin', icon: '🔧', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' };
  return { key: 'comp_admin', label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
}

const statusOf = (account) => (String(account.status || '').toLowerCase() === 'inactive' || account.banned ? 'inactive' : 'active');
const displayNameOf = (account) => account.displayName || account.name || account.username || 'Administrator';
const emailOf = (account) => account.email || (String(account.username || '').includes('@') ? account.username : `${account.username}@nexus.gg`);

const selectStyle = {
  padding: '10px 12px',
  background: 'var(--bg-input)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: 'var(--text-white)',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
};

const activityButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  background: 'rgba(198,255,51,0.12)',
  color: '#c6ff33',
  border: '1px solid rgba(198,255,51,0.3)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
};

function activityHrefFor(account, typeInfo) {
  const encoded = encodeURIComponent(account.username || '');
  if (typeInfo.key === 'community_moderator') {
    return `/pages/moderator/activity.html?admin=${encoded}`;
  }
  return `/pages/admin/admin-activity.html?admin=${encoded}`;
}

export default function Admins() {
  const navigate = useNavigate();
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(() => {
    const rows = listAdministrativeAccounts().slice();
    rows.sort((a, b) => {
      const roleA = formatAdminType(a.role, a.adminType).label;
      const roleB = formatAdminType(b.role, b.adminType).label;
      if (roleA !== roleB) return roleA.localeCompare(roleB);
      return displayNameOf(a).localeCompare(displayNameOf(b));
    });
    setRoster(rows);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onStorage = (event) => {
      if (!event.key || event.key === 'nexus.auth.accounts') load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [load]);

  const list = useMemo(() => {
    const q = normalize(query);
    return roster.filter((account) => {
      const typeInfo = formatAdminType(account.role, account.adminType);
      if (roleFilter !== 'all' && typeInfo.key !== roleFilter) return false;
      if (statusFilter !== 'all' && statusOf(account) !== statusFilter) return false;
      if (!q) return true;
      return [account.username, emailOf(account), displayNameOf(account), account.role, account.adminType, typeInfo.label]
        .map(normalize)
        .join(' ')
        .includes(q);
    });
  }, [roster, query, roleFilter, statusFilter]);

  return (
    <main className="sa-main-v2">
      <header className="sa-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="sa-header-left">
          <h1 className="sa-title">Admins <span className="accent-text">Roster</span></h1>
          <p className="sa-desc">All administrators and super administrators with their assigned admin roles in PostgreSQL.</p>
        </div>
        <div className="sa-header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/pages/super-admin/revoke-admin.html" className="btn-table-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="6" /><line x1="5" y1="5" x2="11" y2="11" /></svg>
            Revoke Admin
          </Link>
          <Link to="/pages/super-admin/add-admin.html" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#c6ff33', color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13, textDecoration: 'none', boxShadow: '0 0 16px rgba(198,255,51,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>
            Add Admin
          </Link>
        </div>
      </header>

      <section className="sa-users-card">
        <div className="sa-users-header">
          <h2 className="sa-section-title">Administrator Directory</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by admin type" style={selectStyle}>
              <option value="all">All admin types</option>
              {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by account status" style={selectStyle}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="search-bar table-search-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
              <input type="text" placeholder="Search by username, admin type, or email..." id="admins-search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="sa-users-table-wrap">
          <table className="sa-users-table">
            <thead><tr><th>Administrator / Username</th><th>Admin Type</th><th>Email</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody id="admins-table-body">
              {list.map((account) => {
                const username = account.username || 'unknown';
                const typeInfo = formatAdminType(account.role, account.adminType);
                const email = emailOf(account);
                const inactive = statusOf(account) === 'inactive';
                const activityHref = activityHrefFor(account, typeInfo);
                return (
                  <tr key={username} style={{ cursor: 'pointer' }} onClick={() => navigate(activityHref)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: typeInfo.bg, border: `1px solid ${typeInfo.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: typeInfo.color, fontSize: 13 }}>
                          {String(displayNameOf(account)).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f5f5f5' }}>{displayNameOf(account)}</div>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>@{username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="sa-role-pill" style={{ background: typeInfo.bg, color: typeInfo.color, border: `1px solid ${typeInfo.border}`, fontWeight: 700 }}>{typeInfo.icon} {typeInfo.label}</span>
                        {inactive && <span className="sa-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>Inactive</span>}
                      </div>
                    </td>
                    <td className="sa-email">{email}</td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <Link to={activityHref} style={activityButtonStyle}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5l2.5 1.5" /></svg>
                        View Activity
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty-state" id="admins-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No administrators found.</div>}
        </div>
      </section>
    </main>
  );
}
