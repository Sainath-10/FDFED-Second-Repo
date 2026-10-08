/**
 * NEXUS ESPORTS — Admin Profile
 *
 * session-driven profile,
 * avatar preview, account-info save, password update (verified against the local
 * accounts store), quick stats, and the merged recent-activity list.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/admin/admin-profile.css';

const ADMIN_ACTIVITY_KEY = 'nexus.admin.activity';

const loadAdminActivity = () => { try { return JSON.parse(localStorage.getItem(ADMIN_ACTIVITY_KEY) || '[]'); } catch (e) { return []; } };

function formatActivityTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffDays = Math.floor((new Date() - d) / 86400000);
  const timeStr = `${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} IST`;
  if (diffDays === 0) return `Today · ${timeStr}`;
  if (diffDays === 1) return `Yesterday · ${timeStr}`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${timeStr}`;
}
function iconForType(type) {
  switch (type) {
    case 'approved': return { icon: '✅', cls: 'activity-icon-success' };
    case 'rejected': return { icon: '❌', cls: 'activity-icon-danger' };
    case 'pending': return { icon: '🕐', cls: 'activity-icon-warn' };
    case 'dispute': return { icon: '⚖️', cls: 'activity-icon-warn' };
    case 'password': return { icon: '🔐', cls: 'activity-icon-info' };
    default: return { icon: '📝', cls: 'activity-icon-info' };
  }
}
const initials = (name) => String(name || 'A').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export default function AdminProfile() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();

  const [displayName, setDisplayName] = useState((session && (session.displayName || session.username)) || 'Admin');
  const [nameField, setNameField] = useState((session && session.displayName) || '');
  const [email, setEmail] = useState((session && session.email) || '');
  const [usernameField, setUsernameField] = useState((() => {
    const u = (session && session.username) || '';
    return u.includes('@') ? u : (u ? `@${u}` : '');
  })());
  const [phone, setPhone] = useState('+91 98765 43210');
  const [region, setRegion] = useState('South Asia');
  const [bio, setBio] = useState('Platform administrator responsible for managing tournaments, resolving disputes, and maintaining fair play across all competitions.');
  const [avatar, setAvatar] = useState(null);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [activityVersion, setActivityVersion] = useState(0);

  const stats = useMemo(() => {
    try {
      const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
      const disputes = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
      return {
        managed: comps.length,
        resolved: disputes.filter((d) => d.status === 'resolved').length,
        processed: comps.filter((c) => c.approvalStatus === 'approved' || c.approvalStatus === 'rejected').length,
      };
    } catch (e) { return { managed: 0, resolved: 0, processed: 0 }; }
  }, [activityVersion]);

  const lastLogin = useMemo(() => {
    const t = (session && (session.lastLoginAt || session.loggedInAt)) || Date.now();
    return formatActivityTime(t);
  }, [session]);

  const activity = useMemo(() => {
    const combined = [...loadAdminActivity()];
    try {
      const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
      if (Array.isArray(comps)) {
        comps.forEach((comp) => {
          if (!comp) return;
          const status = String(comp.approvalStatus || '').toLowerCase();
          const name = comp.name || 'Competition';
          if (status === 'approved' || status === 'rejected') {
            combined.push({ id: `comp-act-${comp.id}`, type: status, title: `${status === 'approved' ? 'Approved tournament: ' : 'Rejected tournament: '}${name}`, time: comp.approvalUpdatedAt || comp.createdAt || new Date().toISOString() });
          } else if (status === 'pending') {
            combined.push({ id: `comp-pend-${comp.id}`, type: 'pending', title: `${comp.createdBy || comp.organizerId || 'An organizer'} submitted a tournament request: ${name}`, time: comp.approvalUpdatedAt || comp.createdAt || new Date().toISOString() });
          }
        });
      }
    } catch (e) { /* ignore */ }
    combined.sort((a, b) => new Date(b.time) - new Date(a.time));
    return combined.slice(0, 15);
  }, [activityVersion]);

  function pushActivity(entry) {
    const list = loadAdminActivity();
    list.unshift({ id: `act-${Math.random().toString(36).slice(2, 10)}`, type: entry.type || 'info', title: entry.title || '', time: new Date().toISOString() });
    try { localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) { /* ignore */ }
    setActivityVersion((v) => v + 1);
  }

  function saveAccountInfo() {
    const name = nameField.trim();
    if (!name) { showToast('Name cannot be empty.', 'error'); return; }
    setDisplayName(name);
    try {
      const raw = localStorage.getItem('nexus.auth.session');
      if (raw) {
        const s = JSON.parse(raw);
        s.displayName = name;
        localStorage.setItem('nexus.auth.session', JSON.stringify(s));
      }
    } catch (e) { /* ignore */ }
    showToast('Account information saved!');
  }

  function updatePassword() {
    if (!pwdCurrent) { showToast('Please enter your current password.', 'error'); return; }
    if (!pwdNew || pwdNew.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }
    if (pwdNew !== pwdConfirm) { showToast('New passwords do not match.', 'error'); return; }

    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]'); } catch (e) { accounts = []; }

    if (session && accounts.length) {
      const uname = String(session.username || '').toLowerCase();
      const acct = accounts.find((a) => String(a.username || '').toLowerCase() === uname || String(a.email || '').toLowerCase() === uname);
      if (acct) {
        if (acct.password !== pwdCurrent) { showToast('Current password is incorrect.', 'error'); return; }
        acct.password = pwdNew;
        try { localStorage.setItem('nexus.auth.accounts', JSON.stringify(accounts)); } catch (e) { /* ignore */ }
      }
    }

    setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
    setShowPwd({ current: false, new: false, confirm: false });
    pushActivity({ type: 'password', title: 'Password updated successfully.' });
    showToast('Password updated successfully!');
  }

  function previewAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setAvatar(ev.target.result);
    r.readAsDataURL(file);
  }

  function doLogout() {
    logout();
    navigate('/pages/login.html');
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
        <h1 className="admin-title-xl">Admin Profile</h1>
        <p className="admin-subtitle-muted">Manage your account information and settings.</p>
      </div>

      <div className="profile-layout">
        <div className="profile-sidebar-col">
          <div className="profile-avatar-card">
            <div className="avatar-wrap">
              <div className="avatar-circle" id="avatar-display">{avatar ? <img src={avatar} alt="Avatar" /> : initials(displayName)}</div>
              <button className="avatar-edit-btn" onClick={() => document.getElementById('avatar-upload')?.click()}>✏️</button>
              <input type="file" id="avatar-upload" accept="image/*" className="hidden-file-input" onChange={previewAvatar} />
            </div>
            <div className="profile-name-lg" id="display-name">{displayName}</div>
            <div className="profile-role-badge">Admin</div>
            <div className="profile-since">Member since Jan 2024</div>
            <div className="profile-status-row"><span className="status-dot-green"></span><span className="profile-status-txt">Active</span></div>
          </div>

          <div className="comp-sidebar-block">
            <h3>Quick Stats</h3>
            <div className="info-row"><span className="key">Tournaments Managed</span><span className="val stat-val-accent">{stats.managed}</span></div>
            <div className="info-row"><span className="key">Disputes Resolved</span><span className="val stat-val-accent">{stats.resolved}</span></div>
            <div className="info-row"><span className="key">Approvals Processed</span><span className="val stat-val-accent">{stats.processed}</span></div>
            <div className="info-row"><span className="key">Last Login</span><span className="val" id="admin-last-login">{lastLogin}</span></div>
            <button type="button" className="btn-table-secondary quick-logout-btn" id="admin-profile-logout-btn" onClick={doLogout}>Log Out</button>
          </div>
        </div>

        <div className="profile-main-col">
          <div className="profile-card">
            <div className="profile-card-header"><h2 className="profile-card-title">Account Information</h2></div>
            <div className="form-grid-2col">
              <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" type="text" id="field-name" value={nameField} onChange={(e) => setNameField(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Username</label><input className="form-input" type="text" value={usernameField} onChange={(e) => setUsernameField(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Role</label><input className="form-input" type="text" value="Admin" disabled /></div>
              <div className="form-group">
                <label className="form-label">Region</label>
                <select className="form-input" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option>South Asia</option><option>Southeast Asia</option><option>Europe</option><option>North America</option><option>Global</option>
                </select>
              </div>
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
              {pwdField('pwd-current', 'Current Password', pwdCurrent, setPwdCurrent, 'current')}
              <div className="form-group"></div>
              {pwdField('pwd-new', 'New Password', pwdNew, setPwdNew, 'new')}
              {pwdField('pwd-confirm', 'Confirm New Password', pwdConfirm, setPwdConfirm, 'confirm')}
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
              <div className="security-row"><div><div className="security-label">New Tournament Submission</div><div className="security-desc">Notify when an organizer submits a new tournament for approval.</div></div><label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider"></span></label></div>
              <div className="security-row"><div><div className="security-label">Dispute Filed</div><div className="security-desc">Notify when a team files a new dispute.</div></div><label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider"></span></label></div>
              <div className="security-row"><div><div className="security-label">Team Registration</div><div className="security-desc">Notify on new team registrations requiring approval.</div></div><label className="toggle-switch"><input type="checkbox" /><span className="toggle-slider"></span></label></div>
            </div>
            <div className="profile-card-footer"><button className="btn-primary" onClick={() => showToast('Notification preferences saved!')}>Save Preferences</button></div>
          </div>

          <div className="profile-card">
            <div className="profile-card-header"><h2 className="profile-card-title">Recent Activity</h2></div>
            <div className="activity-list" id="admin-activity-list">
              {activity.length === 0 && (
                <div className="activity-item"><span className="activity-icon">⏳</span><div className="activity-info"><div className="activity-title" style={{ color: 'var(--text-muted)' }}>No recent activity yet.</div></div></div>
              )}
              {activity.map((entry) => {
                const { icon, cls } = iconForType(entry.type);
                return (
                  <div className="activity-item" key={entry.id}>
                    <span className={`activity-icon ${cls}`}>{icon}</span>
                    <div className="activity-info">
                      <div className="activity-title">{entry.title}</div>
                      <div className="activity-time">{formatActivityTime(entry.time)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="danger-zone-block">
            <div className="danger-zone-title">Danger Zone</div>
            <div className="danger-zone-desc">These actions are irreversible. Proceed with caution.</div>
            <div className="danger-btns-row">
              <button className="btn-table-danger" onClick={() => { if (window.confirm('Deactivate your account?')) showToast('Account deactivated.', 'error'); }}>Deactivate Account</button>
              <button className="btn-table-secondary" onClick={() => showToast('Logged out from all sessions.', 'error')}>Logout All Sessions</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


