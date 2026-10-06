import React, { useState, useEffect } from 'react';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/users.css';

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    let roster = [];

    // Local cached accounts
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      roster = raw ? JSON.parse(raw) : [];
    } catch (_) {}

    // Fetch from backend
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
                banned: typeof u.banned === 'boolean' ? u.banned : !!existing.banned,
                warningCount: typeof u.warningCount === 'number' ? u.warningCount : (existing.warningCount || 0)
              };
            }
          });

          roster = Object.values(map);
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(roster));
        }
      }
    } catch (e) {}

    setUsers(roster);
    setLoading(false);
  }

  function getRoleBadge(account) {
    if (account.banned || account.isBanned) {
      return (
        <span className="sa-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>
          BANNED
        </span>
      );
    }
    const t = String(account.adminType || account.role || '').toLowerCase();
    if (t.includes('super')) {
      return (
        <span className="sa-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>
          SUPER ADMIN
        </span>
      );
    }
    if (t.includes('comp')) {
      return (
        <span className="sa-role-pill" style={{ background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)' }}>
          COMP ADMIN
        </span>
      );
    }
    if (t.includes('dispute')) {
      return (
        <span className="sa-role-pill" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>
          DISPUTE ADMIN
        </span>
      );
    }
    if (t.includes('revenue')) {
      return (
        <span className="sa-role-pill" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
          REVENUE ADMIN
        </span>
      );
    }
    if (t === 'admin') {
      return (
        <span className="sa-role-pill" style={{ background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)' }}>
          ADMIN
        </span>
      );
    }
    return (
      <span className="sa-role-pill" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>
        USER
      </span>
    );
  }

  const filteredUsers = users.filter(account => {
    const q = normalize(searchTerm);
    if (!q) return true;
    const haystack = [
      account.username,
      account.email,
      account.adminType,
      account.role,
      account.banned ? 'banned' : ''
    ].map(normalize).join(' ');
    return haystack.includes(q);
  });

  return (
    <Shell sidebarVariant="super-admin" activePage="users">
      <main className="sa-main-v2">
        <header className="sa-header-v2">
          <div className="sa-header-left">
            <h1 className="sa-title">Users <span className="accent-text">Roster</span></h1>
            <p className="sa-desc">All registered users with their roles and email addresses.</p>
          </div>
        </header>

        <section className="sa-users-card">
          <div className="sa-users-header">
            <h2 className="sa-section-title">User Directory</h2>
            <div className="search-bar table-search-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" />
              </svg>
              <input
                type="text"
                placeholder="Search by username, role, or email..."
                id="users-search"
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
                  <th>Role</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                {filteredUsers.map((account, idx) => {
                  const username = account.username || 'unknown';
                  const email = account.email || (username.includes('@') ? username : '—');
                  const isBanned = !!(account.banned || account.isBanned);

                  return (
                    <tr key={account.id || idx} style={isBanned ? { opacity: 0.5 } : {}}>
                      <td>
                        {username}
                        {isBanned && <span style={{ fontSize: '10px', color: '#e7000b', marginLeft: '6px' }}>(banned)</span>}
                      </td>
                      <td>{getRoleBadge(account)}</td>
                      <td className="sa-email">{email}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredUsers.length === 0 && !loading && (
              <div className="empty-state" id="users-empty">No users found.</div>
            )}
          </div>
        </section>
      </main>
    </Shell>
  );
}
