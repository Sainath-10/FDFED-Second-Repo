/**
 * NEXUS ESPORTS — Super Admin · Revoke administrator
 *
 * Returns a staff account to a normal player account, with a reason they see
 * at their next login. The backend refuses self-revocation and removing the
 * last Super Admin.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthAPI } from '../../services/api.js';
import { Notice, PageHeader } from '../../components/ui.jsx';
import { showToast } from '../../lib/toast.js';

const STAFF = ['super_admin', 'finance_moderator', 'community_moderator'];

export default function RevokeAdmin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const [staff, setStaff] = useState([]);
  const [username, setUsername] = useState(params.get('username') || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    AuthAPI.getAllUsers().then((res) => {
      if (res.ok) setStaff((res.data || []).filter((u) => (STAFF.includes(u.role) || u.adminType) && u.username !== session?.username));
    });
  }, [session?.username]);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    if (!username.trim() || reason.trim().length < 5) { setError('Choose an administrator and give a reason (at least 5 characters).'); return; }
    setSubmitting(true);
    const res = await AuthAPI.revokeAdmin(username.trim(), reason.trim());
    setSubmitting(false);
    if (!res.ok) { setError(res.error || 'Access was not revoked.'); return; }
    showToast(`@${username.trim()} no longer has staff access.`);
    navigate('/pages/super-admin/admins.html');
  }

  return (
    <main className="main-content">
      <Link to="/pages/super-admin/admins.html" className="back-btn-alt">← Back to admins</Link>
      <PageHeader title="Revoke administrator" subtitle="The account becomes a normal player account. You cannot revoke yourself." />
      <form className="ui-card" style={{ maxWidth: 640 }} onSubmit={onSubmit}>
        <div className="ui-field">
          <label htmlFor="revoke-user">Administrator *</label>
          <select id="revoke-user" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)}>
            <option value="">Choose…</option>
            {staff.map((u) => <option key={u.id} value={u.username}>@{u.username} — {(u.adminType || u.role).replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="ui-field">
          <label htmlFor="revoke-reason">Reason *</label>
          <textarea id="revoke-reason" className="form-input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="ui-field-help">They see this reason the next time they log in.</span>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="ui-dialog-actions">
          <Link className="btn-cancel" to="/pages/super-admin/admins.html">Cancel</Link>
          <button type="submit" className="btn-danger" disabled={submitting}>{submitting ? 'Revoking…' : 'Revoke access'}</button>
        </div>
      </form>
    </main>
  );
}
