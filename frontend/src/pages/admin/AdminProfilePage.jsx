import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/admin-profile.css';

export default function AdminProfilePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(NexusAuth.getSession());

  // Form states
  const [displayName, setDisplayName] = useState('Admin');
  const [username, setUsername] = useState('@admin_nexus');
  const [email, setEmail] = useState('admin@nexusesports.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [role, setRole] = useState('Admin');
  const [region, setRegion] = useState('South Asia');
  const [bio, setBio] = useState('Platform administrator responsible for managing tournaments, resolving disputes, and maintaining fair play across all competitions.');
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Password fields
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);

  // Notification toggles
  const [notifTournaments, setNotifTournaments] = useState(true);
  const [notifDisputes, setNotifDisputes] = useState(true);
  const [notifTeams, setNotifTeams] = useState(false);

  // Stats
  const [stats, setStats] = useState({ managed: 24, disputes: 87, approvals: 142, lastLogin: 'Today, 09:14 IST' });
  const [activityList, setActivityList] = useState([]);

  useEffect(() => {
    const sess = NexusAuth.getSession();
    const userRole = String(sess?.role || sess?.adminType || '').toLowerCase();
    if (!sess || !userRole.includes('admin')) {
      navigate('/login');
      return;
    }
    setSession(sess);

    const name = sess.displayName || sess.username || 'Admin';
    setDisplayName(name);
    setEmail(sess.email || 'admin@nexusesports.com');
    const uName = sess.username || '';
    setUsername(uName.includes('@') ? uName : (uName ? '@' + uName : '@admin_nexus'));
    setRole(sess.role || sess.adminType || 'Admin');

    const loginTime = sess.lastLoginAt || sess.loggedInAt || Date.now();
    setStats(prev => ({
      ...prev,
      lastLogin: formatActivityTime(loginTime)
    }));

    // Dynamic stats
    try {
      const comps = NexusData.getCompetitions ? NexusData.getCompetitions() : (JSON.parse(localStorage.getItem('nexus_competitions') || '[]'));
      const disputes = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
      const managedCount = comps.length;
      const resolvedDisputesCount = disputes.filter(d => d.status === 'resolved').length;
      const processedCount = comps.filter(c => c.approvalStatus === 'approved' || c.approvalStatus === 'rejected').length;

      setStats({
        managed: managedCount,
        disputes: resolvedDisputesCount,
        approvals: processedCount,
        lastLogin: formatActivityTime(loginTime)
      });
    } catch (e) {}

    loadActivity();
  }, []);

  function formatActivityTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';
    if (diffDays === 0) return 'Today · ' + timeStr;
    if (diffDays === 1) return 'Yesterday · ' + timeStr;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + timeStr;
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

  function loadActivity() {
    const ADMIN_ACTIVITY_KEY = 'nexus.admin.activity';
    let manualLog = [];
    try {
      const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
      manualLog = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    const compLog = [];
    try {
      const comps = NexusData.getCompetitions ? NexusData.getCompetitions() : (JSON.parse(localStorage.getItem('nexus_competitions') || '[]'));
      if (Array.isArray(comps)) {
        comps.forEach(comp => {
          if (!comp) return;
          const status = (comp.approvalStatus || '').toLowerCase();
          if (status === 'approved' || status === 'rejected') {
            const name = comp.name || 'Competition';
            compLog.push({
              id: 'comp-act-' + comp.id,
              type: status,
              title: (status === 'approved' ? 'Approved tournament: ' : 'Rejected tournament: ') + name,
              time: comp.approvalUpdatedAt || comp.createdAt || new Date().toISOString()
            });
          } else if (status === 'pending') {
            const name = comp.name || 'Competition';
            const organizer = comp.createdBy || comp.organizerId || 'An organizer';
            compLog.push({
              id: 'comp-pend-' + comp.id,
              type: 'pending',
              title: organizer + ' submitted a tournament request: ' + name,
              time: comp.approvalUpdatedAt || comp.createdAt || new Date().toISOString()
            });
          }
        });
      }
    } catch (e) {}

    const combined = [...manualLog, ...compLog];
    combined.sort((a, b) => new Date(b.time) - new Date(a.time));
    setActivityList(combined.slice(0, 15));
  }

  function pushAdminActivity(entry) {
    const ADMIN_ACTIVITY_KEY = 'nexus.admin.activity';
    let list = [];
    try {
      const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
      list = raw ? JSON.parse(raw) : [];
    } catch (e) {}
    list.unshift({
      id: 'act-' + Math.random().toString(36).slice(2, 10),
      type: entry.type || 'info',
      title: entry.title || '',
      time: new Date().toISOString()
    });
    const trimmed = list.slice(0, 30);
    try {
      localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(trimmed));
    } catch (e) {}
    loadActivity();
  }

  function handleSaveAccountInfo() {
    if (!displayName.trim()) {
      alert('Name cannot be empty.');
      return;
    }
    try {
      const raw = localStorage.getItem('nexus.auth.session');
      if (raw) {
        const sess = JSON.parse(raw);
        sess.displayName = displayName.trim();
        localStorage.setItem('nexus.auth.session', JSON.stringify(sess));
      }
    } catch (e) {}
    alert('Account information saved!');
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setAvatarUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleUpdatePassword() {
    if (!pwdCurrent) {
      alert('Please enter your current password.');
      return;
    }
    if (!pwdNew || pwdNew.length < 6) {
      alert('New password must be at least 6 characters.');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      alert('New passwords do not match.');
      return;
    }

    try {
      const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
      const sess = NexusAuth.getSession();
      if (sess && accounts.length) {
        const u = (sess.username || '').toLowerCase();
        const acct = accounts.find(a => (a.username || '').toLowerCase() === u || (a.email || '').toLowerCase() === u);
        if (acct) {
          if (acct.password !== pwdCurrent) {
            alert('Current password is incorrect.');
            return;
          }
          acct.password = pwdNew;
          localStorage.setItem('nexus.auth.accounts', JSON.stringify(accounts));
        }
      }
    } catch (e) {}

    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
    pushAdminActivity({ type: 'password', title: 'Password updated successfully.' });
    alert('Password updated successfully!');
  }

  function handleLogout() {
    NexusAuth.clearSession();
    navigate('/login');
  }

  const roleLower = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = roleLower.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="profile">
      <main className="main-content">
        <div className="admin-header-block">
          <h1 className="admin-title-xl">Admin Profile</h1>
          <p className="admin-subtitle-muted">Manage your account information and settings.</p>
        </div>

        <div className="profile-layout">
          {/* Left: Avatar + Role card */}
          <div className="profile-sidebar-col">
            <div className="profile-avatar-card">
              <div className="avatar-wrap">
                <div className="avatar-circle" id="avatar-display">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'A'
                  )}
                </div>
                <button
                  type="button"
                  className="avatar-edit-btn"
                  onClick={() => document.getElementById('avatar-upload').click()}
                >
                  ✏️
                </button>
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  className="hidden-file-input"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="profile-name-lg" id="display-name">{displayName}</div>
              <div className="profile-role-badge">{role}</div>
              <div className="profile-since">Member since Jan 2024</div>
              <div className="profile-status-row">
                <span className="status-dot-green"></span>
                <span className="profile-status-txt">Active</span>
              </div>
            </div>

            <div className="comp-sidebar-block">
              <h3>Quick Stats</h3>
              <div className="info-row">
                <span className="key">Tournaments Managed</span>
                <span className="val stat-val-accent">{stats.managed}</span>
              </div>
              <div className="info-row">
                <span className="key">Disputes Resolved</span>
                <span className="val stat-val-accent">{stats.disputes}</span>
              </div>
              <div className="info-row">
                <span className="key">Approvals Processed</span>
                <span className="val stat-val-accent">{stats.approvals}</span>
              </div>
              <div className="info-row">
                <span className="key">Last Login</span>
                <span className="val" id="admin-last-login">{stats.lastLogin}</span>
              </div>
              <button
                type="button"
                className="btn-table-secondary quick-logout-btn"
                id="admin-profile-logout-btn"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          </div>

          {/* Right: Forms */}
          <div className="profile-main-col">
            {/* Account Info */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2 className="profile-card-title">Account Information</h2>
              </div>
              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    type="text"
                    id="field-name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <input className="form-input" type="text" value={role} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Region</label>
                  <select
                    className="form-input"
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                  >
                    <option>South Asia</option>
                    <option>Southeast Asia</option>
                    <option>Europe</option>
                    <option>North America</option>
                    <option>Global</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '4px' }}>
                <label className="form-label">Bio</label>
                <textarea
                  className="form-input notes-textarea-sm"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
              </div>
              <div className="profile-card-footer">
                <button className="btn-primary" onClick={handleSaveAccountInfo}>Save Changes</button>
              </div>
            </div>

            {/* Security */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2 className="profile-card-title">Security</h2>
              </div>
              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <div className="password-input-wrap">
                    <input
                      className="form-input"
                      type={showPwdCurrent ? 'text' : 'password'}
                      id="pwd-current"
                      placeholder="Enter current password"
                      value={pwdCurrent}
                      onChange={e => setPwdCurrent(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pwd-eye-btn"
                      onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                      aria-label="Show/hide password"
                    >
                      {showPwdCurrent ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div className="form-group"></div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="password-input-wrap">
                    <input
                      className="form-input"
                      type={showPwdNew ? 'text' : 'password'}
                      id="pwd-new"
                      placeholder="Enter new password"
                      value={pwdNew}
                      onChange={e => setPwdNew(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pwd-eye-btn"
                      onClick={() => setShowPwdNew(!showPwdNew)}
                      aria-label="Show/hide password"
                    >
                      {showPwdNew ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div className="password-input-wrap">
                    <input
                      className="form-input"
                      type={showPwdConfirm ? 'text' : 'password'}
                      id="pwd-confirm"
                      placeholder="Confirm new password"
                      value={pwdConfirm}
                      onChange={e => setPwdConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pwd-eye-btn"
                      onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                      aria-label="Show/hide password"
                    >
                      {showPwdConfirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="security-extras">
                <div className="security-row">
                  <div>
                    <div className="security-label">Two-Factor Authentication</div>
                    <div className="security-desc">Add an extra layer of security to your account.</div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div className="profile-card-footer">
                <button className="btn-primary" onClick={handleUpdatePassword}>Update Password</button>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2 className="profile-card-title">Notification Preferences</h2>
              </div>
              <div className="notif-list">
                <div className="security-row">
                  <div>
                    <div className="security-label">New Tournament Submission</div>
                    <div className="security-desc">Notify when an organizer submits a new tournament for approval.</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={notifTournaments}
                      onChange={e => setNotifTournaments(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="security-row">
                  <div>
                    <div className="security-label">Dispute Filed</div>
                    <div className="security-desc">Notify when a team files a new dispute.</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={notifDisputes}
                      onChange={e => setNotifDisputes(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="security-row">
                  <div>
                    <div className="security-label">Team Registration</div>
                    <div className="security-desc">Notify on new team registrations requiring approval.</div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={notifTeams}
                      onChange={e => setNotifTeams(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div className="profile-card-footer">
                <button className="btn-primary" onClick={() => alert('Notification preferences saved!')}>Save Preferences</button>
              </div>
            </div>

            {/* Activity Log */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2 className="profile-card-title">Recent Activity</h2>
              </div>
              <div className="activity-list" id="admin-activity-list">
                {activityList.length === 0 ? (
                  <div className="activity-item">
                    <span className="activity-icon">⏳</span>
                    <div className="activity-info">
                      <div className="activity-title" style={{ color: 'var(--text-muted)' }}>No recent activity yet.</div>
                    </div>
                  </div>
                ) : (
                  activityList.map((entry, idx) => {
                    const { icon, cls } = iconForType(entry.type);
                    return (
                      <div className="activity-item" key={entry.id || idx}>
                        <span className={`activity-icon ${cls}`}>{icon}</span>
                        <div className="activity-info">
                          <div className="activity-title">{entry.title}</div>
                          <div className="activity-time">{formatActivityTime(entry.time)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="danger-zone-block">
              <div className="danger-zone-title">Danger Zone</div>
              <div className="danger-zone-desc">These actions are irreversible. Proceed with caution.</div>
              <div className="danger-btns-row">
                <button
                  type="button"
                  className="btn-table-danger"
                  onClick={() => {
                    if (window.confirm('Deactivate your account?')) {
                      alert('Account deactivated.');
                    }
                  }}
                >
                  Deactivate Account
                </button>
                <button
                  type="button"
                  className="btn-table-secondary"
                  onClick={() => alert('Logged out from all sessions.')}
                >
                  Logout All Sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
