/**
 * NEXUS ESPORTS — Super Admin · Revoke Administrator
 *
 * demotes an admin via
 * POST /auth/revoke-admin and syncs the local accounts cache.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/users.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ACCOUNTS_KEY = 'nexus.auth.accounts';
const normalize = (v) => String(v || '').trim().toLowerCase();

export default function RevokeAdmin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const uname = username.trim();
    const why = reason.trim();
    if (!uname || !why) {
      setError('Please enter both username and reason');
      showToast('Please enter both username and reason', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/revoke-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, reason: why }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'Failed to revoke admin in database';
        setError(msg);
        showToast(msg, 'error');
        setSubmitting(false);
        return;
      }

      try {
        const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        const item = stored.find((a) => normalize(a.username) === normalize(uname));
        if (item) {
          item.role = 'participant';
          item.adminType = null;
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stored));
        }
      } catch (err) { /* ignore */ }

      showToast(`Revoked admin privileges for ${uname}. Reason recorded in DB.`, 'success');
      setTimeout(() => navigate('/pages/super-admin/admins.html'), 600);
    } catch (err) {
      showToast(err.message || 'Error revoking admin', 'error');
      setSubmitting(false);
    }
  }

  return (
    <main className="sa-main-v2">
      <header className="sa-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sa-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Link to="/pages/super-admin/admins.html" style={{ color: '#ef4444', textDecoration: 'none', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>← Back to Admins Roster</Link>
          </div>
          <h1 className="sa-title">Revoke <span className="accent-text" style={{ color: '#ef4444' }}>Admin Privileges</span></h1>
          <p className="sa-desc">Demote an administrator to participant status in PostgreSQL and specify the revocation reason.</p>
        </div>
      </header>

      <section className="sa-users-card" style={{ maxWidth: 640, marginTop: 24, padding: 32, border: '1px solid rgba(239,68,68,0.3)' }}>
        <form id="revoke-admin-page-form" style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onSubmit={onSubmit}>
          {error && (
            <div id="revoke-admin-error-box" style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#ef4444', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><span>⚠️</span> <span>{error}</span></div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Admin Username or Email *</label>
            <input type="text" id="page-revoke-username" className="form-input" placeholder="e.g. compadmin@nexus.gg" required value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 14 }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>Reason for Revocation *</label>
            <textarea id="page-revoke-reason" className="form-input" placeholder="e.g. Policy violation / Security audit demotion..." required rows="4" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 14, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            <Link to="/pages/super-admin/admins.html" style={{ flex: 1, padding: 12, textAlign: 'center', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Cancel</Link>
            <button type="submit" id="revoke-admin-submit-btn" disabled={submitting} style={{ flex: 2, padding: 12, background: '#ef4444', border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14, boxShadow: '0 0 16px rgba(239,68,68,0.3)' }}>Confirm &amp; Revoke Access</button>
          </div>
        </form>
      </section>
    </main>
  );
}


