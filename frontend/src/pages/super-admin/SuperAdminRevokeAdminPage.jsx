import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/users.css';

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default function SuperAdminRevokeAdminPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    const u = username.trim();
    const r = reason.trim();

    if (!u || !r) {
      setErrorMsg('Please enter both username and reason');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('http://localhost:3001/auth/revoke-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u,
          reason: r
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || 'Failed to revoke admin in database';
        setErrorMsg(msg);
        setSubmitting(false);
        return;
      }

      // Sync LocalStorage cache
      try {
        const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        const item = stored.find(a => normalize(a.username) === normalize(u));
        if (item) {
          item.role = 'participant';
          item.adminType = null;
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stored));
        }
      } catch (err) {}

      alert(`Revoked admin privileges for ${u}. Reason recorded in DB.`);
      navigate('/super-admin/admins');
    } catch (err) {
      setErrorMsg(err.message || 'Error revoking admin');
      setSubmitting(false);
    }
  }

  return (
    <Shell sidebarVariant="super-admin" activePage="admins">
      <main className="sa-main-v2">
        <header className="sa-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="sa-header-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <Link to="/super-admin/admins" style={{ color: '#ef4444', textDecoration: 'none', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                ← Back to Admins Roster
              </Link>
            </div>
            <h1 className="sa-title">Revoke <span className="accent-text" style={{ color: '#ef4444' }}>Admin Privileges</span></h1>
            <p className="sa-desc">Demote an administrator to participant status in PostgreSQL and specify the revocation reason.</p>
          </div>
        </header>

        <section className="sa-users-card" style={{ maxWidth: '640px', marginTop: '24px', padding: '32px', border: '1px solid rgba(239,68,68,0.3)' }}>
          {errorMsg && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', color: '#ef4444', fontSize: '13px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span> <span>{errorMsg}</span>
            </div>
          )}

          <form id="revoke-admin-page-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>Admin Username or Email *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. compadmin@nexus.gg"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>Reason for Revocation *</label>
              <textarea
                className="form-input"
                placeholder="e.g. Policy violation / Security audit demotion..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
                rows="4"
                style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '14px', marginTop: '12px' }}>
              <Link to="/super-admin/admins" style={{ flex: 1, padding: '12px', textAlign: 'center', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                style={{ flex: 2, padding: '12px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '10px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '14px', boxShadow: '0 0 16px rgba(239,68,68,0.3)', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Revoking Access...' : 'Confirm & Revoke Access'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </Shell>
  );
}
