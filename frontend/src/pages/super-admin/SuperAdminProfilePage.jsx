import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/super-profile.css';

export default function SuperAdminProfilePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(NexusAuth.getSession());

  const [displayName, setDisplayName] = useState('Super Admin');
  const [username, setUsername] = useState('superadmin');
  const [email, setEmail] = useState('superadmin@nexus.gg');
  const [language, setLanguage] = useState('English');
  const [twoFactor, setTwoFactor] = useState(true);
  const [notifSecurity, setNotifSecurity] = useState(true);
  const [notifMaintenance, setNotifMaintenance] = useState(true);
  const [notifRequests, setNotifRequests] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const [lastLogin, setLastLogin] = useState('Today, 10:00 AM');
  const [joinedDate, setJoinedDate] = useState('Jan 2, 2026');

  useEffect(() => {
    const sess = NexusAuth.getSession();
    const role = String(sess?.role || sess?.adminType || '').toLowerCase();
    const isSuper = role.includes('super');
    if (!sess || !isSuper) {
      navigate('/login');
      return;
    }
    setSession(sess);

    setDisplayName(sess.displayName || sess.username || 'Super Admin');
    setUsername(sess.username || 'superadmin');
    setEmail(sess.email || 'superadmin@nexus.gg');

    if (sess.lastLoginAt || sess.loggedInAt) {
      const d = new Date(sess.lastLoginAt || sess.loggedInAt);
      setLastLogin(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
    if (sess.joinedAt) {
      const d = new Date(sess.joinedAt);
      setJoinedDate(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    }
  }, []);

  function handleSaveProfile() {
    try {
      const sess = NexusAuth.getSession() || {};
      sess.displayName = displayName;
      sess.email = email;
      localStorage.setItem('nexus.auth.session', JSON.stringify(sess));
      setSession(sess);
    } catch (_) {}
    alert('Super Admin profile changes saved successfully.');
  }

  function handleLogout() {
    NexusAuth.clearSession();
    navigate('/login');
  }

  function handleUpdatePassword() {
    if (!currentPassword) {
      alert('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      alert('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match.');
      return;
    }

    try {
      const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
      const norm = (username || '').toLowerCase();
      const acct = accounts.find(a => (a.username || '').toLowerCase() === norm || (a.email || '').toLowerCase() === norm);
      if (acct) {
        if (acct.password && acct.password !== currentPassword) {
          alert('Current password is incorrect.');
          return;
        }
        acct.password = newPassword;
        localStorage.setItem('nexus.auth.accounts', JSON.stringify(accounts));
      }
    } catch (_) {}

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordSection(false);
    alert('Password updated successfully!');
  }

  return (
    <Shell sidebarVariant="super-admin" activePage="profile">
      <div className="sa-main-v2 sa-profile-main">
        <main className="profile-v2-page">
          <header className="profile-v2-head">
            <div>
              <h1 className="sa-title">Profile <span className="accent-text">Page</span></h1>
              <p className="sa-desc">Manage your super admin account settings and preferences.</p>
            </div>
            <div className="save-wrap" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Link to="/super-dashboard" className="profile-dashboard-btn" style={{ textDecoration: 'none' }}>
                Go to Dashboard
              </Link>
              <button type="button" className="profile-logout-btn" onClick={handleLogout}>
                Log Out
              </button>
              <button type="button" className="profile-save-btn" onClick={handleSaveProfile}>
                Save Changes
              </button>
            </div>
          </header>

          {/* Hero Card */}
          <section className="profile-card cut-card profile-hero-card" style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '16px', padding: '28px', marginBottom: '28px' }}>
            <div className="hero-top-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div className="avatar-wrap" style={{ position: 'relative', width: '70px', height: '70px' }}>
                <img
                  src="/assets/88bb61dd411e2e781af6284e0036a9672ba8ef32.png"
                  alt="Profile avatar"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="avatar-online" style={{ position: 'absolute', bottom: '2px', right: '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#22c55e', border: '2px solid #000' }}></span>
              </div>

              <div className="hero-identity">
                <div className="hero-title-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 id="sa-hero-username" style={{ margin: 0, color: '#fff', fontSize: '22px', fontWeight: 800 }}>{displayName}</h2>
                  <span className="pill" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)' }}>
                    Super Admin
                  </span>
                </div>
                <p id="hero-email" style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>{email}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '24px', borderTop: '1px solid #262626', paddingTop: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>USER ID</span>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>@{username}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>LAST LOGIN</span>
                <div style={{ color: '#fff', fontSize: '14px' }}>{lastLogin}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>MEMBER SINCE</span>
                <div style={{ color: '#fff', fontSize: '14px' }}>{joinedDate}</div>
              </div>
            </div>
          </section>

          {/* Settings Section */}
          <section className="profile-card" style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '16px', padding: '28px', marginBottom: '28px' }}>
            <h3 style={{ margin: '0 0 20px', color: '#fff', fontSize: '17px', fontWeight: 800 }}>Account & Preferences</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>DISPLAY NAME</label>
                <input
                  type="text"
                  className="pf-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  className="pf-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>LANGUAGE</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                >
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#141414', border: '1px solid #262626', borderRadius: '8px' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>Two-Factor Authentication</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Require 2FA verification on login</div>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={e => setTwoFactor(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#c6ff33' }}
                />
              </div>
            </div>

            {/* Notification Preferences */}
            <h4 style={{ margin: '28px 0 16px', color: '#fff', fontSize: '15px', fontWeight: 800 }}>Notification Alerts</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e5e5e5', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifSecurity} onChange={e => setNotifSecurity(e.target.checked)} style={{ accentColor: '#c6ff33' }} />
                <span>Security Alerts and Unauthorized Attempt Warnings</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e5e5e5', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifMaintenance} onChange={e => setNotifMaintenance(e.target.checked)} style={{ accentColor: '#c6ff33' }} />
                <span>Scheduled System Maintenance & Downtime Broadcasts</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e5e5e5', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifRequests} onChange={e => setNotifRequests(e.target.checked)} style={{ accentColor: '#c6ff33' }} />
                <span>New Administrator Access Requests & Role Changes</span>
              </label>
            </div>
          </section>

          {/* Security & Password */}
          <section className="profile-card" style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '16px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '17px', fontWeight: 800 }}>Security & Credentials</h3>
              <button
                type="button"
                className="btn-table-secondary"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                style={{ padding: '8px 16px' }}
              >
                {showPasswordSection ? 'Hide Password Form' : 'Change Password'}
              </button>
            </div>

            {showPasswordSection && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>CURRENT PASSWORD</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>NEW PASSWORD</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>CONFIRM NEW PASSWORD</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleUpdatePassword}
                    style={{ padding: '12px 24px', width: '100%' }}
                  >
                    Update Password
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </Shell>
  );
}
