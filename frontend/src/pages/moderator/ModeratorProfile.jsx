/**
 * NEXUS ESPORTS — Community Moderator profile
 * Displays the authenticated moderator's real account information.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthAPI } from '../../services/api.js';
import '../../styles/pages/admin/dashboard.css';
import '../../styles/pages/reports.css';

export default function ModeratorProfile() {
  const { session } = useAuth();
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    AuthAPI.me()
      .then((res) => {
        if (!alive) return;
        if (res.ok && res.data) setAccount(res.data);
        else setError(res.error || 'Unable to load your account.');
      })
      .catch(() => { if (alive) setError('Unable to load your account.'); });
    return () => { alive = false; };
  }, []);

  const user = account?.user || account || null;
  const username = user?.username || session?.username || '—';

  return (
    <main className="admin-page reports-page">
      <div className="admin-header-block">
        <h1 className="admin-title-xl">Moderator profile</h1>
        <p className="admin-subtitle-muted">Community Moderator account (reports against organisers only).</p>
      </div>

      {error && <div className="report-inline-error">{error}</div>}

      <div className="info-card" style={{ maxWidth: 560 }}>
        <h3>Account</h3>
        <dl>
          <dt>Username</dt><dd>@{username}</dd>
          <dt>Email</dt><dd>{user?.email || '—'}</dd>
          <dt>Role</dt><dd>Community Moderator</dd>
          <dt>Account ID</dt><dd style={{ fontSize: 11.5, fontWeight: 500 }}>{user?.id || '—'}</dd>
          <dt>Verification</dt><dd>{user?.verificationStatus ? String(user.verificationStatus) : '—'}</dd>
        </dl>
      </div>

      <div className="reputation-note" style={{ maxWidth: 560 }}>
        Scope: Dashboard, Reports and Profile only. This role cannot access Admin or Super Admin functions, edit
        historical evidence, or change its own role.
      </div>
    </main>
  );
}
