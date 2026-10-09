/**
 * NEXUS ESPORTS — Super Admin · Admins Roster
 *
 * lists administrators from the
 * backend (falling back to the local accounts cache) with role pills, search, and a
 * deep link to each admin's activity log.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/users.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ACCOUNTS_KEY = 'nexus.auth.accounts';
const ADMIN_TYPES = ['comp_admin', 'dispute_admin', 'revenue_admin', 'super_admin', 'super-admin', 'admin'];
const normalize = (v) => String(v || '').trim().toLowerCase();

function formatAdminType(role, adminType) {
  const r = normalize(role);
  const t = normalize(adminType);
  if (r === 'comp_admin' || t === 'comp_admin') return { label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
  if (r === 'dispute_admin' || t === 'dispute_admin') return { label: 'Dispute Admin', icon: '🛡️', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)' };
  if (r === 'revenue_admin' || t === 'revenue_admin') return { label: 'Revenue Admin', icon: '💳', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)' };
  if (r === 'super_admin' || r === 'super-admin' || t === 'super_admin') return { label: 'Super Admin', icon: '⚡', color: '#c6ff33', bg: 'rgba(198, 255, 51, 0.15)', border: 'rgba(198, 255, 51, 0.3)' };
  return { label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
}

export default function Admins() {
  const navigate = useNavigate();
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/users`);
        if (res.ok) {
          const dbUsers = await res.json();
          if (Array.isArray(dbUsers)) {
            const list = dbUsers.filter((u) => {
              if (!u) return false;
              const r = normalize(u.role);
              const t = normalize(u.adminType);
              if (r === 'participant' || r === 'regular' || r === 'user') return false;
              return ADMIN_TYPES.includes(r) || ADMIN_TYPES.includes(t);
            }).map((u) => ({
              username: u.username || u.email,
              email: u.email || `${u.username}@nexus.gg`,
              role: u.role,
              adminType: u.adminType || u.role,
              banned: !!u.banned,
            }));
            if (alive) setRoster(list);
            return;
          }
        }
      } catch (e) {
        console.warn('Could not fetch DB users for Admins roster:', e);
      }
      try {
        const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        const list = stored.filter((a) => {
          const r = normalize(a.role);
          if (r === 'participant' || r === 'regular') return false;
          return ADMIN_TYPES.includes(r);
        });
        if (alive) setRoster(list);
      } catch (err) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const q = normalize(query);
  const list = q
    ? roster.filter((account) => {
      const typeInfo = formatAdminType(account.role, account.adminType);
      return [account.username, account.email, account.role, account.adminType, typeInfo.label].map(normalize).join(' ').includes(q);
    })
    : roster;

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
          <div className="search-bar table-search-wrap">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
            <input type="text" placeholder="Search by username, admin type, or email..." id="admins-search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="sa-users-table-wrap">
          <table className="sa-users-table">
            <thead><tr><th>Username</th><th>Admin Type</th><th>Email</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody id="admins-table-body">
              {list.map((account) => {
                const username = account.username || 'unknown';
                const typeInfo = formatAdminType(account.role, account.adminType);
                const email = account.email || (username.includes('@') ? username : `${username}@nexus.gg`);
                const isBanned = !!account.banned;
                const activityHref = `/pages/admin/admin-activity.html?admin=${encodeURIComponent(username)}`;
                return (
                  <tr key={username} style={{ cursor: 'pointer' }} onClick={() => { navigate(activityHref); }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: typeInfo.bg, border: `1px solid ${typeInfo.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: typeInfo.color, fontSize: 13 }}>{String(username).charAt(0).toUpperCase()}</div>
                        <span style={{ fontWeight: 600, color: '#f5f5f5' }}>{username}</span>
                      </div>
                    </td>
                    <td>
                      {isBanned
                        ? <span className="sa-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>BANNED</span>
                        : <span className="sa-role-pill" style={{ background: typeInfo.bg, color: typeInfo.color, border: `1px solid ${typeInfo.border}`, fontWeight: 700 }}>{typeInfo.icon} {typeInfo.label}</span>}
                    </td>
                    <td className="sa-email">{email}</td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link to={activityHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(198,255,51,0.12)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5l2.5 1.5" /></svg>
                          Activity
                        </Link>
                      </div>
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


