/**
 * NEXUS ESPORTS — Super Admin · Profile
 *
 * session-driven hero card,
 * account settings, preferences (persisted toggles + language), the password and
 * email popups, and logout.
 *
 * Deviation: the page carried its own `.sa-sidebar-v2` and `.profile-v2-footer`;
 * here the shared classic sidebar and AppLayout footer are used (consistent with the
 * other ported super-admin pages).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/super-profile.css';

const STORAGE_EMAIL = 'nexus.profile.email';
const STORAGE_LANG = 'nexus.profile.language';
const TOGGLE_PREFIX = 'nexus.profile.toggle.';

const readStorage = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
const writeStorage = (key, value) => { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } };

const PREF_KEYS = ['pref-email-alerts', 'pref-push', 'pref-marketing', 'pref-messages'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuperProfile() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = (session && (session.displayName || session.username)) || 'Super Admin';
  const sessionEmail = (session && session.email) || '';

  const [email, setEmail] = useState(sessionEmail);
  const [language, setLanguage] = useState('English (US)');
  const [twoFactor, setTwoFactor] = useState(true);
  const [prefs, setPrefs] = useState({ 'pref-email-alerts': true, 'pref-push': true, 'pref-marketing': true, 'pref-messages': true });
  const [saveFeedback, setSaveFeedback] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState({ text: '', ok: false });
  const [emailDraft, setEmailDraft] = useState('');
  const [emailMsg, setEmailMsg] = useState({ text: '', ok: false });

  useEffect(() => {
    const savedEmail = readStorage(STORAGE_EMAIL);
    if (savedEmail) setEmail(savedEmail);
    else if (sessionEmail) setEmail(sessionEmail);

    const savedLang = readStorage(STORAGE_LANG);
    if (savedLang) setLanguage(savedLang);

    const tf = readStorage(`${TOGGLE_PREFIX}two-factor`);
    if (tf !== null) setTwoFactor(tf === '1');

    const nextPrefs = {};
    PREF_KEYS.forEach((k) => {
      const v = readStorage(TOGGLE_PREFIX + k);
      nextPrefs[k] = v === null ? true : v === '1';
    });
    setPrefs(nextPrefs);

    if (sessionEmail) writeStorage(STORAGE_EMAIL, sessionEmail);
  }, [sessionEmail]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setPasswordOpen(false); setEmailOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const lastLogin = (() => {
    const t = (session && (session.lastLoginAt || session.loggedInAt)) || Date.now();
    const d = new Date(t);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  })();
  const joined = (() => {
    const j = session && session.joinedAt ? new Date(session.joinedAt) : null;
    return j && !Number.isNaN(j.getTime()) ? j.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jan 2, 2026';
  })();
  const userId = (() => {
    const uname = (session && session.username) || 'SA-01';
    return uname.includes('@') ? uname : `@${uname}`;
  })();

  function togglePref(key) {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      writeStorage(TOGGLE_PREFIX + key, next[key] ? '1' : '0');
      return next;
    });
  }
  function toggleTwoFactor() {
    setTwoFactor((v) => { writeStorage(`${TOGGLE_PREFIX}two-factor`, !v ? '1' : '0'); return !v; });
  }
  function setLanguageAndStore(v) { setLanguage(v); writeStorage(STORAGE_LANG, v); }

  function saveProfileSettings() {
    if (email) writeStorage(STORAGE_EMAIL, email);
    writeStorage(STORAGE_LANG, language);
    writeStorage(`${TOGGLE_PREFIX}two-factor`, twoFactor ? '1' : '0');
    PREF_KEYS.forEach((k) => writeStorage(TOGGLE_PREFIX + k, prefs[k] ? '1' : '0'));
    showToast('Profile settings saved successfully!');
    setSaveFeedback('Saved just now');
    window.setTimeout(() => setSaveFeedback(''), 1800);
  }

  function openPassword() {
    setPwd({ current: '', next: '', confirm: '' });
    setPwdMsg({ text: '', ok: false });
    setPasswordOpen(true);
  }
  function saveNewPassword() {
    if (!pwd.current || !pwd.next || !pwd.confirm) { setPwdMsg({ text: 'Please fill all password fields.', ok: false }); return; }
    if (pwd.next.length < 8) { setPwdMsg({ text: 'New password must be at least 8 characters.', ok: false }); return; }
    if (pwd.next !== pwd.confirm) { setPwdMsg({ text: 'New password and confirmation do not match.', ok: false }); return; }
    setPwdMsg({ text: 'Password updated successfully.', ok: true });
    window.setTimeout(() => { setPasswordOpen(false); showToast('Password updated successfully!'); }, 550);
  }

  function openEmail() {
    setEmailDraft(email);
    setEmailMsg({ text: '', ok: false });
    setEmailOpen(true);
  }
  function saveEmail() {
    const next = emailDraft.trim();
    if (!EMAIL_RE.test(next)) { setEmailMsg({ text: 'Please enter a valid email address.', ok: false }); return; }
    setEmail(next);
    writeStorage(STORAGE_EMAIL, next);
    setEmailMsg({ text: 'Email updated.', ok: true });
    window.setTimeout(() => { setEmailOpen(false); showToast('Email address updated successfully!'); }, 450);
  }

  function doLogout() { logout(); navigate('/pages/login.html'); }

  return (
    <div className="sa-main-v2 sa-profile-main">
      <main className="profile-v2-page">
        <header className="profile-v2-head">
          <div>
            <h1>Profile <span>Page</span></h1>
            <p>Manage your super admin account settings and preferences.</p>
          </div>
          <div className="save-wrap">
            <Link to="/pages/super-admin/super-dashboard.html" className="profile-dashboard-btn">Go to Dashboard</Link>
            <button type="button" className="profile-logout-btn" id="logout-btn" onClick={doLogout}>Log Out</button>
            <button type="button" className="profile-save-btn" id="save-profile-btn" onClick={saveProfileSettings}>Save Changes</button>
            <span id="save-feedback" className="save-feedback" aria-live="polite">{saveFeedback}</span>
          </div>
        </header>

        <section className="profile-card cut-card profile-hero-card">
          <div className="hero-top-row">
            <div className="avatar-wrap">
              <img src={assetUrl('88bb61dd411e2e781af6284e0036a9672ba8ef32.png')} alt="Profile avatar" />
              <span className="avatar-online" aria-hidden="true"></span>
            </div>
            <div className="hero-identity">
              <div className="hero-title-row">
                <h2 id="sa-hero-username">{displayName}</h2>
                <span className="pill">Super Admin</span>
              </div>
              <p id="hero-email">{email || 'Loading...'}</p>
            </div>
          </div>

          <div className="hero-stats-grid">
            <div className="hero-stat-box"><span>Username</span><strong id="sa-user-id">{userId}</strong></div>
            <div className="hero-stat-box"><span>Last Login</span><strong id="sa-last-login">{lastLogin}</strong></div>
            <div className="hero-stat-box"><span>Joined Date</span><strong id="sa-joined-date">{joined}</strong></div>
            <div className="hero-stat-box"><span>Max Privilege</span><strong id="sa-max-privilege">Super Admin</strong></div>
          </div>
        </section>

        <section className="profile-grid-two section-gap-md">
          <article className="profile-card cut-card">
            <div className="card-head"><h3>Account Settings</h3></div>

            <div className="setting-row">
              <div>
                <h4>Email Address</h4>
                <p>The email address associated with your admin account.</p>
              </div>
              <button type="button" className="outline-control email-edit-btn" id="email-edit-btn" aria-label="Edit account email" onClick={openEmail}>
                <span id="account-email-value">{email || 'Loading...'}</span>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.75 3.75L16.25 7.25M4.25 15.75L7.25 15.5L15.5 7.25C16 6.75 16 5.75 15.5 5.25L14.75 4.5C14.25 4 13.25 4 12.75 4.5L4.5 12.75L4.25 15.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>

            <div className="setting-row">
              <div>
                <h4>Password</h4>
                <p>Last changed 3 months ago. Strong password recommended.</p>
              </div>
              <button type="button" className="outline-control" id="update-password-btn" onClick={openPassword}>Update Password</button>
            </div>

            <div className="setting-row">
              <div>
                <h4>Two Factor Authentication</h4>
                <p>Secure your account with 2FA using Google Authenticator.</p>
              </div>
              <div className="toggle-line">
                <label className="switch" htmlFor="two-factor">
                  <input type="checkbox" id="two-factor" checked={twoFactor} onChange={toggleTwoFactor} />
                  <span className="slider"></span>
                </label>
                <span className="toggle-text" id="two-factor-label">{twoFactor ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </article>

          <article className="profile-card cut-card">
            <div className="card-head"><h3>Preferences</h3></div>

            <div className="prefs-block">
              <label htmlFor="language">Language</label>
              <select id="language" className="select-control" value={language} onChange={(e) => setLanguageAndStore(e.target.value)}>
                <option>English (US)</option><option>English (UK)</option><option>Hindi</option>
              </select>
            </div>

            <div className="prefs-list">
              {[['pref-email-alerts', 'Email Alerts'], ['pref-push', 'Push Notifications'], ['pref-marketing', 'Marketing'], ['pref-messages', 'Messages']].map(([key, label]) => (
                <div className="pref-item" key={key}>
                  <span>{label}</span>
                  <label className="switch" htmlFor={key}>
                    <input type="checkbox" id={key} checked={prefs[key]} onChange={() => togglePref(key)} />
                    <span className="slider"></span>
                  </label>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="profile-grid-two section-gap-sm">
          <article className="profile-card cut-card">
            <div className="card-head between">
              <h3>Recent Activity</h3>
              <a href="#">View all logs</a>
            </div>
            <div className="activity-list">
              <div className="activity-item"><div className="activity-icon">✦</div><div><h4>Edited tournament Spring Cup 2026</h4><p>Updated prize pool distribution and schedule.</p></div><time dateTime="2026-03-30T12:00">2 hours ago</time></div>
              <div className="activity-item"><div className="activity-icon activity-ok">✓</div><div><h4>Successful login from 192.168.1.42</h4><p>MacOS - Chrome</p></div><time dateTime="2026-03-30T09:00">5 hours ago</time></div>
              <div className="activity-item"><div className="activity-icon">✦</div><div><h4>Updated player eligibility rules</h4><p>Global rule changes applied to all ranked tournaments.</p></div><time dateTime="2026-03-30T06:00">8 hours ago</time></div>
              <div className="activity-item"><div className="activity-icon">✦</div><div><h4>Security Audit Completed</h4><p>Automated system check passed successfully.</p></div><time dateTime="2026-03-30T04:00">10 hours ago</time></div>
            </div>
            <div className="activity-foot">
              <div>
                <span>Recent Login History</span>
                <p>Chrome on Laptop - Sricity, India</p>
              </div>
              <span className="pill">Active</span>
            </div>
          </article>

          <article className="profile-card cut-card">
            <div className="card-head"><h3>Active Sessions</h3></div>
            <div className="sessions-list">
              <div className="session-item"><div className="session-icon">🖥</div><div><h4>Laptop - Sricity, India</h4><p>Current Session</p></div></div>
              <div className="session-item"><div className="session-icon">📱</div><div><h4>iPhone 15 Pro - Chennai, India</h4><p className="logout-link">Logged Out</p></div></div>
            </div>
          </article>
        </section>
      </main>

      {passwordOpen && (
        <div className="popup-overlay open" id="password-modal" aria-hidden="false" onClick={(e) => { if (e.target === e.currentTarget) setPasswordOpen(false); }}>
          <div className="popup-card" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
            <button type="button" className="popup-close" onClick={() => setPasswordOpen(false)} aria-label="Close password dialog">×</button>
            <h3 id="password-modal-title">Update Password</h3>
            <p>Set a new secure password for your account.</p>
            <div className="popup-form-group"><label htmlFor="current-password">Current Password</label><input type="password" id="current-password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd((s) => ({ ...s, current: e.target.value }))} /></div>
            <div className="popup-form-group"><label htmlFor="new-password">New Password</label><input type="password" id="new-password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd((s) => ({ ...s, next: e.target.value }))} /></div>
            <div className="popup-form-group"><label htmlFor="confirm-password">Confirm New Password</label><input type="password" id="confirm-password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd((s) => ({ ...s, confirm: e.target.value }))} /></div>
            <div className={`popup-message${pwdMsg.ok ? ' success' : ''}`} id="password-popup-message" aria-live="polite">{pwdMsg.text}</div>
            <div className="popup-actions">
              <button type="button" className="popup-btn ghost" onClick={() => setPasswordOpen(false)}>Cancel</button>
              <button type="button" className="popup-btn solid" id="save-password-btn" onClick={saveNewPassword}>Update Password</button>
            </div>
          </div>
        </div>
      )}

      {emailOpen && (
        <div className="popup-overlay open" id="email-modal" aria-hidden="false" onClick={(e) => { if (e.target === e.currentTarget) setEmailOpen(false); }}>
          <div className="popup-card" role="dialog" aria-modal="true" aria-labelledby="email-modal-title">
            <button type="button" className="popup-close" onClick={() => setEmailOpen(false)} aria-label="Close email dialog">×</button>
            <h3 id="email-modal-title">Update Email Address</h3>
            <p>Enter a new email address for your account.</p>
            <div className="popup-form-group"><label htmlFor="new-email">Email Address</label><input type="email" id="new-email" autoComplete="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} /></div>
            <div className={`popup-message${emailMsg.ok ? ' success' : ''}`} id="email-popup-message" aria-live="polite">{emailMsg.text}</div>
            <div className="popup-actions">
              <button type="button" className="popup-btn ghost" onClick={() => setEmailOpen(false)}>Cancel</button>
              <button type="button" className="popup-btn solid" id="save-email-btn" onClick={saveEmail}>Save Email</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


