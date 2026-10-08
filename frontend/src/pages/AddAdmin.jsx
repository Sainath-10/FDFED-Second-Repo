/**
 * NEXUS ESPORTS — Super Admin · Add Administrator
 *
 * Creates a new administrator (or elevates an existing account) through
 * POST /auth/add-admin, then syncs the local accounts cache.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/users.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ACCOUNTS_KEY = 'nexus.auth.accounts';
const DEFAULT_PASSWORD = 'nexus';
const normalize = (v) => String(v || '').trim().toLowerCase();

export default function AddAdmin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [adminType, setAdminType] = useState('comp_admin');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const uname = username.trim().replace(/^@/, '');
    if (!uname) {
      setError('Please enter a username or email');
      showToast('Please enter a username or email', 'error');
      return;
    }
    const pass = password.trim() || DEFAULT_PASSWORD;
    const email = uname.includes('@') ? uname : `${uname}@nexus.gg`;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/add-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, email, password: pass, adminType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'Could not save the administrator. Is the backend running on ' + API_URL + '?';
        setError(Array.isArray(msg) ? msg.join(', ') : msg);
        showToast(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
        setSubmitting(false);
        return;
      }

      try {
        const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        const idx = stored.findIndex((a) => normalize(a.username) === normalize(uname));
        const item = { username: uname, email, password: pass, role: adminType, adminType };
        if (idx >= 0) stored[idx] = Object.assign(stored[idx], item);
        else stored.push(item);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stored));
      } catch (err) { /* cache sync is best-effort */ }

      showToast(`${uname} now has ${adminType} access (password: ${pass}).`, 'success');
      setTimeout(() => navigate('/pages/super-admin/admins.html'), 600);
    } catch (err) {
      const msg = `Cannot reach the backend at ${API_URL}.`;
      setError(msg);
      showToast(msg, 'error');
      setSubmitting(false);
    }
  }

  return (
    <main className="sa-main-v2">
      <header className="sa-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sa-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Link to="/pages/super-admin/admins.html" style={{ color: '#c6ff33', textDecoration: 'none', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>← Back to Admins Roster</Link>
          </div>
          <h1 className="sa-title">Add <span className="accent-text">Administrator</span></h1>
          <p className="sa-desc">Assign administrator access and specific admin type stored directly in PostgreSQL.</p>
        </div>
      </header>

      <section className="sa-users-card" style={{ maxWidth: 640, marginTop: 24, padding: 32 }}>
        <form id="add-admin-page-form" style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onSubmit={onSubmit}>
          {error && (
            <div id="add-admin-error-box" style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#ef4444', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><span>⚠️</span> <span>{error}</span></div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Username or Email *</label>
            <input type="text" id="page-admin-username" className="form-input" placeholder="e.g. disputeadmin or name@nexus.gg" required value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 14 }} />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
              A new account is created if this user does not exist yet; an existing account is elevated.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Admin Type / Role *</label>
            <select id="page-admin-type" className="form-select" required value={adminType} onChange={(e) => setAdminType(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 14, cursor: 'pointer' }}>
              <option value="comp_admin">🏆 Competition Admin (comp_admin)</option>
              <option value="dispute_admin">🛡️ Dispute Admin (dispute_admin)</option>
              <option value="revenue_admin">💳 Revenue Admin (revenue_admin)</option>
              <option value="super_admin">⚡ Super Admin (super_admin)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Password</label>
            <input type="text" id="page-admin-password" className="form-input" placeholder="nexus" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 14 }} />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>Defaults to <strong style={{ color: '#c6ff33' }}>nexus</strong>. Only applied when the account is created.</p>
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            <Link to="/pages/super-admin/admins.html" style={{ flex: 1, padding: 12, textAlign: 'center', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Cancel</Link>
            <button type="submit" id="add-admin-submit-btn" disabled={submitting} style={{ flex: 2, padding: 12, background: '#c6ff33', border: 'none', color: '#000', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14, boxShadow: '0 0 16px rgba(198,255,51,0.25)' }}>Save &amp; Grant Admin Access</button>
          </div>
        </form>
      </section>
    </main>
  );
}


