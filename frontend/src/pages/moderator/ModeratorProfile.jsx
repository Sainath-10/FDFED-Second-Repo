/**
 * NEXUS ESPORTS — Community Moderator Profile
 *
 * Uses the same layout, components and account actions as the existing Admin
 * Profile: hero/avatar, account information, security, notification
 * preferences, recent activity and a working logout button.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { findAccount, updateAccountProfile, changeAccountPassword } from '../../services/auth.js';
import { LocalReportsAPI } from '../../services/local/reporting.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/admin/admin-profile.css';
import '../../styles/pages/reports.css';

const normalize = (value) => String(value || '').trim().toLowerCase();
const PREF_PREFIX = 'nexus.profile.toggle.';
const AVATAR_PREFIX = 'nexus.profile.avatar.';

function readStorage(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }

function initials(name) {
  return String(name || 'M').split(' ').filter(Boolean).map((word) => word[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

const PREF_ITEMS = [
  ['pref-report-new', 'New reports'],
  ['pref-report-response', 'Awaiting responses'],
  ['pref-report-resolved', 'Resolved cases'],
  ['pref-email-alerts', 'Email alerts'],
];

export default function ModeratorProfile() {
  const navigate = useNavigate();
  const { session, logout, refreshSession } = useAuth();

  const account = useMemo(() => findAccount(session?.username) || null, [session?.username]);
  const username = account?.username || session?.username || '';
  const avatarKey = `${AVATAR_PREFIX}${normalize(username)}`;

  const [displayName, setDisplayName] = useState(account?.displayName || session?.displayName || username || 'Community Moderator');
  const [nameField, setNameField] = useState(account?.displayName || session?.displayName || '');
  const [email, setEmail] = useState(account?.email || session?.email || '');
  const [usernameField] = useState(username ? `@${username}` : '');
  const [region, setRegion] = useState('South Asia');
  const [bio, setBio] = useState('Community Moderator responsible for reviewing reports against organisers and keeping competition cases fair and auditable.');
  const [avatar, setAvatar] = useState(() => readStorage(avatarKey) || null);
  const [prefs, setPrefs] = useState(() => {
    const next = {};
    PREF_ITEMS.forEach(([key]) => { next[key] = readStorage(PREF_PREFIX + key) !== '0'; });
    return next;
  });
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [reports, setReports] = useState([]);

  useEffect(() => {
    let alive = true;
    LocalReportsAPI.moderation()
      .then((res) => { if (alive && res.ok && Array.isArray(res.data)) setReports(res.data); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => { setAvatar(readStorage(avatarKey) || null); }, [avatarKey]);

  const stats = useMemo(() => ({
    assigned: reports.length,
    active: reports.filter((row) => ['new', 'under_review', 'awaiting_response'].includes(row.status)).length,
    resolved: reports.filter((row) => row.status === 'resolved').length,
    discarded: reports.filter((row) => row.status === 'discarded').length,
  }), [reports]);

  const activity = useMemo(() => (
    reports
      .filter((row) => row.status === 'resolved')
      .sort((a, b) => new Date(b.resolvedAt || b.updatedAt || b.createdAt) - new Date(a.resolvedAt || a.updatedAt || a.createdAt))
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        title: `${row.code || 'Report'} · ${String(row.finding || 'resolved').replace(/_/g, ' ')} · ${String(row.action || 'no action').replace(/_/g, ' ')}`,
        time: row.resolvedAt || row.updatedAt || row.createdAt,
      }))
  ), [reports]);

  const lastLogin = formatTime((session && (session.lastLoginAt || session.loggedInAt)) || Date.now());
  const joined = account?.createdAt || session?.joinedAt
    ? new Date(account?.createdAt || session?.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  function saveAccountInfo() {
    const name = nameField.trim();
    if (!name) { showToast('Name cannot be empty.', 'error'); return; }
    const result = updateAccountProfile(username, { displayName: name, email: email.trim() });
    if (!result.ok) { showToast(result.error, 'error'); return; }
    setDisplayName(name);
    setEmail(result.account.email);
    if (typeof refreshSession === 'function') refreshSession();
    showToast('Account information saved!');
  }

  function updatePassword() {
    if (!pwdCurrent) { showToast('Please enter your current password.', 'error'); return; }
    if (!pwdNew || pwdNew.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }
    if (pwdNew !== pwdConfirm) { showToast('New passwords do not match.', 'error'); return; }
    const result = changeAccountPassword(username, pwdCurrent, pwdNew);
    if (!result.ok) { showToast(result.error, 'error'); return; }
    setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
    setShowPwd({ current: false, new: false, confirm: false });
    showToast('Password updated successfully!');
  }

  function previewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const value = String(ev.target.result || '');
      setAvatar(value);
      writeStorage(avatarKey, value);
    };
    reader.readAsDataURL(file);
  }

  function togglePref(key) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeStorage(PREF_PREFIX + key, next[key] ? '1' : '0');
      return next;
    });
  }

  function doLogout() {
    logout();
    navigate('/pages/login.html', { replace: true });
  }

  const pwdField = (id, label, value, setValue, key) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="password-input-wrap">
        <input className="form-input" type={showPwd[key] ? 'text' : 'password'} id={id} placeholder={label.toLowerCase()} value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="button" className="pwd-eye-btn" onClick={() => setShowPwd((s) => ({ ...s, [key]: !s[key] }))} aria-label="Show/hide password">{showPwd[key] ? '🙈' : '👁️'}</button>
      </div>
    </div>
  );

  return (
    <main className="main-content">
      <div className="admin-header-block">
        <h1 className="admin-title-xl">Community Moderator Profile</h1>
        <p className="admin-subtitle-muted">Manage your account information and settings.</p>
      </div>

      <div className="profile-layout">
        <div className="profile-sidebar-col">
          <div className="profile-avatar-card">
            <div className="avatar-wrap">
              <div className="avatar-circle" id="avatar-display">{avatar ? <img src={avatar} alt="Avatar" /> : initials(displayName)}</div>
              <button className="avatar-edit-btn" onClick={() => document.getElementById('moderator-avatar-upload')?.click()}>✏️</button>
              <input type="file" id="moderator-avatar-upload" accept="image/*" className="hidden-file-input" onChange={previewAvatar} />
            </div>
            <div className="profile-name-lg" id="display-name">{displayName}</div>
            <div className="profile-role-badge">Community Moderator</div>
            <div className="profile-since">Member since {joined}</div>
            <div className="profile-status-row"><span className="status-dot-green"></span><span className="profile-status-txt">Active</span></div>
          </div>

          <div className="comp-sidebar-block">
            <h3>Quick Stats</h3>
            <div className="info-row"><span className="key">Assigned Reports</span><span className="val stat-val-accent">{stats.assigned}</span></div>
            <div className="info-row"><span className="key">Active Cases</span><span className="val stat-val-accent">{stats.active}</span></div>
            <div className="info-row"><span className="key">Resolved</span><span className="val stat-val-accent">{stats.resolved}</span></div>
            <div className="info-row"><span className="key">Discarded</span><span className="val stat-val-accent">{stats.discarded}</span></div>
            <div className="info-row"><span className="key">Last Login</span><span className="val">{lastLogin || '—'}</span></div>
            <button type="button" className="btn-table-secondary quick-logout-btn" id="moderator-profile-logout-btn" onClick={doLogout}>Log Out</button>
          </div>
        </div>

        <div className="profile-main-col">
          <div className="profile-card">
            <div className="profile-card-header"><h2 className="profile-card-title">Account Information</h2></div>
            <div className="form-grid-2col">
              <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" type="text" value={nameField} onChange={(e) => setNameField(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Username</label><input className="form-input" type="text" value={usernameField} disabled /></div>
              <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Role</label><input className="form-input" type="text" value="Community Moderator" disabled /></div>
              <div className="form-group">
                <label className="form-label">Region</label>
                <select className="form-input" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option>South Asia</option><option>Southeast Asia</option><option>Europe</option><option>North America</option><option>Global</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Account Status</label><input className="form-input" type="text" value={account?.status === 'inactive' ? 'Inactive' : 'Active'} disabled /></div>
            </div>
            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label">Bio</label>
              <textarea className="form-input notes-textarea-sm" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="profile-card-footer"><button className="btn-primary" onClick={saveAccountInfo}>Save Changes</button></div>
          </div>

          <div className="profile-card">
            <div className="profile-card-header"><h2 className="profile-card-title">Security</h2></div>
            <div className="form-grid-2col">
              {pwdField('mod-pwd-current', 'Current Password', pwdCurrent, setPwdCurrent, 'current')}
              <div className="form-group"></div>
              {pwdField('mod-pwd-new', 'New Password', pwdNew, setPwdNew, 'new')}
              {pwdField('mod-pwd-confirm', 'Confirm New Password', pwdConfirm, setPwdConfirm, 'confirm')}
            </div>
            <div className="security-extras">
              <div className="security-row">
                <div>
                  <div className="security-label">Two-Factor Authentication</div>
                  <div className="security-desc">Add an extra layer of security to your account.</div>
                </div>
                <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider"></span></label>
              </div>
            </div>
            <div className="profile-card-footer"><button className="btn-primary" onClick={updatePassword}>Update Password</button></div>
          </div>

          <div className="profile-card">
            <div className="profile-card-header"><h2 className="profile-card-title">Notification Preferences</h2></div>
            <div className="notif-list">
              {PREF_ITEMS.map(([key, label]) => (
                <div className="security-row" key={key}>
                  <div><div className="security-label">{label}</div><div className="security-desc">Receive updates about {label.toLowerCase()}.</div></div>
                  <label className="toggle-switch"><input type="checkbox" checked={!!prefs[key]} onChange={() => togglePref(key)} /><span className="toggle-slider"></span></label>
                </div>
              ))}
            </div>
            <div className="profile-card-footer"><button className="btn-primary" onClick={() => showToast('Notification preferences saved!')}>Save Preferences</button></div>
          </div>

          <div className="profile-card">
            <div className="profile-card-header"><h2 className="profile-card-title">Recent Activity</h2></div>
            <div className="activity-list">
              {activity.length === 0 && (
                <div className="activity-item"><span className="activity-icon">⏳</span><div className="activity-info"><div className="activity-title" style={{ color: 'var(--text-muted)' }}>No resolved cases yet.</div></div></div>
              )}
              {activity.map((entry) => (
                <div className="activity-item" key={entry.id}>
                  <span className="activity-icon activity-icon-success">✓</span>
                  <div className="activity-info">
                    <div className="activity-title">{entry.title}</div>
                    <div className="activity-time">{formatTime(entry.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="danger-zone-block">
            <div className="danger-zone-title">Session</div>
            <div className="danger-zone-desc">Sign out of this account. You will need to log in again to access moderator reports.</div>
            <div className="danger-btns-row">
              <button className="btn-table-danger" onClick={doLogout}>Log Out</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
