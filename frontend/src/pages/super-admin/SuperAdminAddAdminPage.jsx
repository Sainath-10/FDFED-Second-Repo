import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/users.css';

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default function SuperAdminAddAdminPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [adminType, setAdminType] = useState('comp_admin');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    const u = username.trim();
    if (!u) {
      setErrorMsg('Please enter a username');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('http://localhost:3001/auth/add-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u,
          adminType: adminType
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || 'Failed to update admin status in PostgreSQL database';
        setErrorMsg(msg);
        setSubmitting(false);
        return;
      }

      // Sync LocalStorage cache
      try {
        const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        const existingIdx = stored.findIndex(a => normalize(a.username) === normalize(u));
        const updatedItem = {
          username: u,
          email: u.includes('@') ? u : `${u}@nexus.gg`,
          password: 'admin123',
          role: adminType,
          adminType: adminType
        };
        if (existingIdx >= 0) stored[existingIdx] = Object.assign(stored[existingIdx], updatedItem);
        else stored.push(updatedItem);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stored));
      } catch (err) {}

      alert(`Successfully granted ${adminType} access to ${u}!`);
      navigate('/super-admin/admins');
    } catch (err) {
      setErrorMsg(err.message || 'Error saving admin');
      setSubmitting(false);
    }
  }

  return (
    <Shell sidebarVariant="super-admin" activePage="admins">
      <main className="sa-main-v2">
        <header className="sa-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="sa-header-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <Link to="/super-admin/admins" style={{ color: '#c6ff33', textDecoration: 'none', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                ← Back to Admins Roster
              </Link>
            </div>
            <h1 className="sa-title">Add <span className="accent-text">Administrator</span></h1>
            <p className="sa-desc">Assign administrator access and specific admin type stored directly in PostgreSQL.</p>
          </div>
        </header>

        <section className="sa-users-card" style={{ maxWidth: '640px', marginTop: '24px', padding: '32px' }}>
          {errorMsg && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', color: '#ef4444', fontSize: '13px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span> <span>{errorMsg}</span>
            </div>
          )}

          <form id="add-admin-page-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>Username *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. disputeadmin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>Admin Type / Role *</label>
              <select
                className="form-select"
                value={adminType}
                onChange={e => setAdminType(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}
              >
                <option value="comp_admin">🏆 Competition Admin (comp_admin)</option>
                <option value="dispute_admin">🛡️ Dispute Admin (dispute_admin)</option>
                <option value="revenue_admin">💳 Revenue Admin (revenue_admin)</option>
                <option value="super_admin">⚡ Super Admin (super_admin)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '14px', marginTop: '12px' }}>
              <Link to="/super-admin/admins" style={{ flex: 1, padding: '12px', textAlign: 'center', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                style={{ flex: 2, padding: '12px', background: '#c6ff33', border: 'none', color: '#000', borderRadius: '10px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '14px', boxShadow: '0 0 16px rgba(198,255,51,0.25)', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Granting Access...' : 'Save & Grant Admin Access'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </Shell>
  );
}
