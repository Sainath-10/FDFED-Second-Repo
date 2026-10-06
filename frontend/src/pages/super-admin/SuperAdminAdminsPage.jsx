import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/users.css';

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function formatAdminType(role, adminType) {
  const normRole = normalize(role);
  const normType = normalize(adminType);

  if (normRole === 'comp_admin' || normType === 'comp_admin') {
    return { label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
  }
  if (normRole === 'dispute_admin' || normType === 'dispute_admin') {
    return { label: 'Dispute Admin', icon: '🛡️', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)' };
  }
  if (normRole === 'revenue_admin' || normType === 'revenue_admin') {
    return { label: 'Revenue Admin', icon: '💳', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.3)' };
  }
  if (normRole === 'super_admin' || normRole === 'super-admin' || normType === 'super_admin') {
    return { label: 'Super Admin', icon: '⚡', color: '#c6ff33', bg: 'rgba(198, 255, 51, 0.15)', border: 'rgba(198, 255, 51, 0.3)' };
  }
  return { label: 'Comp Admin', icon: '🏆', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
}

export default function SuperAdminAdminsPage() {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    setLoading(true);
    let roster = [];

    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      roster = raw ? JSON.parse(raw) : [];
    } catch (_) {}

    try {
      const res = await fetch('http://localhost:3001/auth/users');
      if (res.ok) {
        const dbUsers = await res.json();
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          const map = {};
          roster.forEach(a => {
            if (a && a.username) map[normalize(a.username)] = a;
          });
          dbUsers.forEach(u => {
            if (u && (u.username || u.email)) {
              const username = u.username || u.email;
              const key = normalize(username);
              const existing = map[key] || {};
              map[key] = {
                ...existing,
                id: u.id || existing.id,
                username: username,
                email: u.email || existing.email || (username.includes('@') ? username : '—'),
                role: u.adminType || u.role || existing.role || 'regular',
                adminType: u.adminType || existing.adminType || u.role,
                banned: typeof u.banned === 'boolean' ? u.banned : !!existing.banned
              };
            }
          });
          roster = Object.values(map);
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(roster));
        }
      }
    } catch (e) {}

    const adminOnly = roster.filter(u => {
      const r = normalize(u.role);
      const t = normalize(u.adminType);
      return r.includes('admin') || t.includes('admin');
    });

    setAdmins(adminOnly);
    setLoading(false);
  }

  const filteredAdmins = admins.filter(account => {
    const q = normalize(searchTerm);
    if (!q) return true;
    const typeInfo = formatAdminType(account.role, account.adminType);
    const haystack = [
      account.username,
      account.email,
      account.role,
      account.adminType,
      typeInfo.label
    ].map(normalize).join(' ');
    return haystack.includes(q);
  });

  return (
    <Shell sidebarVariant="super-admin" activePage="admins">
      <main className="sa-main-v2">
        <header className="sa-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div className="sa-header-left">
            <h1 className="sa-title">Admins <span className="accent-text">Roster</span></h1>
            <p className="sa-desc">All administrators and super administrators with their assigned admin roles in PostgreSQL.</p>
          </div>
          <div className="sa-header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link
              to="/super-admin/revoke-admin"
              className="btn-table-danger"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="8" cy="8" r="6"/>
                <line x1="5" y1="5" x2="11" y2="11"/>
              </svg>
              Revoke Admin
            </Link>
            <Link
              to="/super-admin/add-admin"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: '#c6ff33',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '13px',
                textDecoration: 'none',
                boxShadow: '0 0 16px rgba(198,255,51,0.2)',
                transition: 'all 0.2s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="3" x2="8" y2="13"/>
                <line x1="3" y1="8" x2="13" y2="8"/>
              </svg>
              Add Admin
            </Link>
          </div>
        </header>

        <section className="sa-users-card">
          <div className="sa-users-header">
            <h2 className="sa-section-title">Administrator Directory</h2>
            <div className="search-bar table-search-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" />
              </svg>
              <input
                type="text"
                placeholder="Search by username, admin type, or email..."
                id="admins-search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="sa-users-table-wrap">
            <table className="sa-users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Admin Type</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody id="admins-table-body">
                {filteredAdmins.map((account, idx) => {
                  const username = account.username || 'unknown';
                  const typeInfo = formatAdminType(account.role, account.adminType);
                  const email = account.email || (username.includes('@') ? username : `${username}@nexus.gg`);
                  const isBanned = !!account.banned;

                  return (
                    <tr
                      key={account.id || idx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/admin-activity?admin=${encodeURIComponent(username)}`)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: typeInfo.bg, border: `1px solid ${typeInfo.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: typeInfo.color, fontSize: '13px' }}>
                            {username.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: '#f5f5f5' }}>{username}</span>
                        </div>
                      </td>
                      <td>
                        {isBanned ? (
                          <span className="sa-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>
                            BANNED
                          </span>
                        ) : (
                          <span className="sa-role-pill" style={{ background: typeInfo.bg, color: typeInfo.color, border: `1px solid ${typeInfo.border}`, fontWeight: 700 }}>
                            {typeInfo.icon} {typeInfo.label}
                          </span>
                        )}
                      </td>
                      <td className="sa-email">{email}</td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <Link
                            to={`/admin/admin-activity?admin=${encodeURIComponent(username)}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              background: 'rgba(198,255,51,0.12)',
                              color: '#c6ff33',
                              border: '1px solid rgba(198,255,51,0.3)',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              textDecoration: 'none',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <circle cx="8" cy="8" r="6"/>
                              <path d="M8 5v3.5l2.5 1.5"/>
                            </svg>
                            Activity
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredAdmins.length === 0 && !loading && (
              <div className="empty-state" id="admins-empty" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No administrators found.
              </div>
            )}
          </div>
        </section>
      </main>
    </Shell>
  );
}
