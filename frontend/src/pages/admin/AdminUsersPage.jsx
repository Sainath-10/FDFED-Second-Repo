import React, { useState, useEffect } from 'react';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/admin/dashboard.css';
import '../../styles/pages/admin/users.css';

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getRoleBadge(account) {
  if (account.banned || account.isBanned) {
    return <span className="user-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>BANNED</span>;
  }
  const t = String(account.adminType || account.role || '').toLowerCase();
  if (t.includes('super')) {
    return <span className="user-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>SUPER ADMIN</span>;
  }
  if (t.includes('comp')) {
    return <span className="user-role-pill" style={{ background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)' }}>COMP ADMIN</span>;
  }
  if (t.includes('dispute')) {
    return <span className="user-role-pill" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>DISPUTE ADMIN</span>;
  }
  if (t.includes('revenue')) {
    return <span className="user-role-pill" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>REVENUE ADMIN</span>;
  }
  if (t === 'admin') {
    return <span className="user-role-pill" style={{ background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)' }}>ADMIN</span>;
  }
  return <span className="user-role-pill" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>USER</span>;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadAccounts = () => {
    let local = [];
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      if (raw) local = JSON.parse(raw);
    } catch (e) {}

    const seed = [
      { username: 'regular', email: 'regular@nexus.gg', role: 'regular' },
      { username: 'admin', email: 'admin@nexus.gg', role: 'admin', adminType: 'comp_admin' },
      { username: 'dispute_admin', email: 'disputes@nexus.gg', role: 'admin', adminType: 'dispute_admin' },
      { username: 'revenue_admin', email: 'revenue@nexus.gg', role: 'admin', adminType: 'revenue_admin' },
      { username: 'superadmin', email: 'superadmin@nexus.gg', role: 'super-admin' },
      { username: 'alex', email: 'alex@nexus.gg', role: 'regular' },
      { username: 'user2', email: 'user2@nexus.gg', role: 'regular' }
    ];

    const map = {};
    seed.forEach(u => { map[normalize(u.username)] = u; });
    local.forEach(u => {
      if (u && u.username) map[normalize(u.username)] = { ...map[normalize(u.username)], ...u };
    });

    setUsers(Object.values(map));
  };

  useEffect(() => {
    loadAccounts();

    fetch('http://localhost:3001/auth/users')
      .then(res => res.json())
      .then(dbUsers => {
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          setUsers(prev => {
            const map = {};
            prev.forEach(u => { map[normalize(u.username)] = u; });
            dbUsers.forEach(u => {
              if (u && (u.username || u.email)) {
                const uname = u.username || u.email;
                const k = normalize(uname);
                map[k] = {
                  ...map[k],
                  username: uname,
                  email: u.email || (map[k] && map[k].email) || '—',
                  role: u.adminType || u.role || 'regular',
                  banned: !!u.banned
                };
              }
            });
            const merged = Object.values(map);
            try {
              localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(merged));
            } catch (err) {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const filteredUsers = users.filter(account => {
    if (!searchQuery) return true;
    const q = normalize(searchQuery);
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
    <Shell sidebarVariant="admin" activePage="users">
      <main className="admin-page">
        <div className="admin-header-block">
          <h1 className="admin-title-xl">
            Users <span style={{ color: 'var(--accent)' }}>Roster</span>
          </h1>
          <p className="admin-subtitle-muted">All registered users with their roles and email addresses.</p>
        </div>

        <section className="users-card">
          <div className="users-card-header">
            <h2 className="table-title-md">User Directory</h2>
            <div className="search-bar table-search-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" />
              </svg>
              <input
                type="text"
                placeholder="Search by username, role, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((account, idx) => {
                    const isBanned = !!(account.banned || account.isBanned);
                    return (
                      <tr key={account.username + idx} style={isBanned ? { opacity: 0.5 } : {}}>
                        <td>
                          {account.username}
                          {isBanned && <span style={{ fontSize: '10px', color: '#e7000b', marginLeft: '6px' }}>(banned)</span>}
                        </td>
                        <td>{getRoleBadge(account)}</td>
                        <td className="user-email">{account.email || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </Shell>
  );
}
