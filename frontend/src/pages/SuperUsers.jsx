/**
 * NEXUS ESPORTS — Super Admin · Users Roster
 *
 * merges the demo seed accounts with
 * the backend `/auth/users` feed (overlaying stored ban status), renders the roster
 * with super-admin role pills, and supports search.
 */
import { useEffect, useState } from 'react';
import '../vendor/auth-accounts.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/users.css';

const ACCOUNTS_KEY = 'nexus.auth.accounts';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const normalize = (v) => String(v || '').trim().toLowerCase();

const readStoredAccounts = () => { try { const p = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); return Array.isArray(p) ? p : []; } catch (e) { return []; } };
const getSeedAccounts = () => (Array.isArray(window.NEXUS_DEMO_ACCOUNTS) ? window.NEXUS_DEMO_ACCOUNTS : []);

function mergeAccountsWithBanStatus() {
  const seed = getSeedAccounts();
  const stored = readStoredAccounts();
  const storedMap = {};
  stored.forEach((a) => { if (a && a.username) storedMap[normalize(a.username)] = a; });
  const seen = new Set();
  return seed.concat(stored).filter((account) => {
    const key = normalize(account && account.username);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((account) => {
    const storedEntry = storedMap[normalize(account.username)];
    return storedEntry ? Object.assign({}, account, storedEntry) : account;
  });
}

function rolePill(account) {
  if (account.banned || account.isBanned) return <span className="sa-role-pill" style={{ background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }}>BANNED</span>;
  const t = String(account.adminType || account.role || '').toLowerCase();
  const pill = (text, color, bg) => <span className="sa-role-pill" style={{ background: bg, color, border: `1px solid ${color}` }}>{text}</span>;
  if (t.includes('super')) return pill('SUPER ADMIN', '#e7000b', 'rgba(231,0,11,0.15)');
  if (t.includes('comp')) return pill('COMP ADMIN', '#c6ff33', 'rgba(198,255,51,0.15)');
  if (t.includes('dispute')) return pill('DISPUTE ADMIN', '#c084fc', 'rgba(168,85,247,0.15)');
  if (t.includes('revenue')) return pill('REVENUE ADMIN', '#4ade80', 'rgba(34,197,94,0.15)');
  if (t === 'admin') return pill('ADMIN', '#c6ff33', 'rgba(198,255,51,0.15)');
  return pill('USER', '#94a3b8', 'rgba(255,255,255,0.06)');
}

export default function SuperUsers() {
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    const base = mergeAccountsWithBanStatus();
    setRoster(base);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/users`);
        if (!res.ok) return;
        const dbUsers = await res.json();
        if (!Array.isArray(dbUsers) || dbUsers.length === 0) return;
        const map = {};
        getSeedAccounts().forEach((a) => { if (a && a.username) map[normalize(a.username)] = a; });
        readStoredAccounts().forEach((a) => { if (a && a.username) map[normalize(a.username)] = a; });
        dbUsers.forEach((u) => {
          if (!u || !(u.username || u.email)) return;
          const username = u.username || u.email;
          const key = normalize(username);
          const existing = map[key] || {};
          map[key] = Object.assign({}, existing, {
            id: u.id || existing.id,
            username,
            email: u.email || existing.email || (username.includes('@') ? username : '—'),
            role: u.adminType || u.role || existing.role || 'regular',
            adminType: u.adminType || existing.adminType || u.role,
            banned: typeof u.banned === 'boolean' ? u.banned : !!existing.banned,
            warningCount: typeof u.warningCount === 'number' ? u.warningCount : (existing.warningCount || 0),
          });
        });
        const merged = Object.values(map);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(merged));
        if (alive) setRoster(merged);
      } catch (err) {
        console.warn('Backend DB fetch offline, using cached roster:', err);
      }
    })();

    return () => { alive = false; };
  }, []);

  const q = normalize(query);
  const list = q
    ? roster.filter((a) => [a.username, a.email, a.adminType, a.role, a.banned ? 'banned' : ''].map(normalize).join(' ').includes(q))
    : roster;

  return (
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
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
            <input type="text" placeholder="Search by username, role, or email..." id="users-search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="sa-users-table-wrap">
          <table className="sa-users-table">
            <thead><tr><th>Username</th><th>Role</th><th>Email</th></tr></thead>
            <tbody id="users-table-body">
              {list.map((account) => {
                const username = account.username || 'unknown';
                const email = account.email || (username.includes('@') ? username : '—');
                const isBanned = !!(account.banned || account.isBanned);
                return (
                  <tr key={username} style={isBanned ? { opacity: 0.5 } : undefined}>
                    <td>{username}{isBanned ? <span style={{ fontSize: 10, color: '#e7000b' }}> (banned)</span> : null}</td>
                    <td>{rolePill(account)}</td>
                    <td className="sa-email">{email}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty-state" id="users-empty">No users found.</div>}
        </div>
      </section>
    </main>
  );
}


