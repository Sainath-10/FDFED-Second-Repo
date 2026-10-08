/**
 * NEXUS ESPORTS — Profile
 *
 * header + bio, 5 tabs (match history,
 * stats, sessions, account, preferences), the live my-teams / upcoming-matches
 * sidebar computed from competition data, and the edit-profile / email / password
 * modals. Auth is handled by ProtectedRoute (the had a blocking guard).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/profile.css';

const PTABS = [
  { id: 'history', label: 'Match History' },
  { id: 'stats', label: 'Statistics' },
  { id: 'sessions', label: 'Active Sessions' },
  { id: 'account', label: 'Account Settings' },
  { id: 'preferences', label: 'Preferences' },
];

const ROLE_MAP = {
  regular: 'User', participant: 'User', team_lead: 'Team Lead', admin: 'Comp Admin',
  comp_admin: 'Comp Admin', dispute_admin: 'Dispute Admin', revenue_admin: 'Revenue Admin',
  'super-admin': 'Super Admin', super_admin: 'Super Admin',
};

const normalize = (v) => String(v || '').trim().toLowerCase();
const formatRole = (role) => ROLE_MAP[normalize(role)] || 'User';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Profile() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('history');
  const [editOpen, setEditOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const username = session ? session.username : '';
  const displayName = session
    ? (session.displayName || (session.firstName && session.lastName ? `${session.firstName} ${session.lastName}` : session.username))
    : '—';

  const bioKey = `nexus.profile.bio.${normalize(username)}`;
  const [bio, setBio] = useState(() => {
    try { return localStorage.getItem(bioKey) || ''; } catch (e) { return ''; }
  });
  const [bioInput, setBioInput] = useState(bio);
  const [email, setEmail] = useState(session ? (session.email || session.emailAddress || '') : '');
  const [emailInput, setEmailInput] = useState(session ? (session.email || '') : '');
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });

  const derived = useMemo(() => {
    const myTeams = [];
    const upcoming = [];
    const history = [];
    let wins = 0;
    let losses = 0;
    const userKey = normalize(username);
    if (!NexusData || typeof NexusData.loadCompetitions !== 'function' || !userKey) {
      return { myTeams, upcoming, history, wins, losses };
    }
    (NexusData.loadCompetitions() || []).forEach((comp) => {
      if (!Array.isArray(comp.teams)) return;
      comp.teams.forEach((team) => {
        const isLeader = normalize(team.createdBy) === userKey;
        const isMember = Array.isArray(team.members) && team.members.some((m) => normalize(m.username) === userKey);
        if (!isLeader && !isMember) return;
        myTeams.push({ name: team.name, game: comp.game, role: isLeader ? 'Captain' : 'Player', icon: isLeader ? '⚡' : '🎮' });
        if (Array.isArray(comp.matches)) {
          comp.matches.forEach((m) => {
            const inMatch = normalize(m.team1) === normalize(team.name) || normalize(m.team2) === normalize(team.name);
            if (!inMatch) return;
            if (m.status === 'scheduled' || m.status === 'live') {
              upcoming.push({ game: comp.game, event: `${m.team1} vs ${m.team2}${m.round ? ` — ${m.round}` : ''}`, dateTime: `${m.date}${m.time ? ` • ${m.time}` : ''}` });
            }
            if (m.status === 'completed') {
              const t1won = Number(m.score1) > Number(m.score2);
              const t2won = Number(m.score2) > Number(m.score1);
              const isT1 = normalize(m.team1) === normalize(team.name);
              const won = (isT1 && t1won) || (!isT1 && t2won);
              history.push({ game: comp.game, event: `${m.round ? `${m.round} — ` : ''}${m.team1} vs ${m.team2}`, date: m.date || '', result: won ? 'WIN' : 'LOSS' });
              if (won) wins += 1; else losses += 1;
            }
          });
        }
      });
    });
    return { myTeams, upcoming, history, wins, losses };
  }, [username]);

  function handleLogout() {
    logout();
    navigate('/pages/login.html', { replace: true });
  }

  function saveProfile() {
    const next = bioInput.trim();
    setBio(next);
    try { localStorage.setItem(bioKey, next); } catch (e) { /* ignore */ }
    setEditOpen(false);
    showToast('Profile updated successfully!');
  }

  function updateEmail() {
    const newEmail = emailInput.trim();
    if (!EMAIL_RE.test(newEmail)) { showToast('Please enter a valid email address.', 'error'); return; }
    try {
      const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
      const idx = accounts.findIndex((a) => normalize(a.username) === normalize(username));
      if (idx !== -1) {
        accounts[idx].email = newEmail;
        localStorage.setItem('nexus.auth.accounts', JSON.stringify(accounts));
        const nextSession = { ...session, email: newEmail };
        localStorage.setItem('nexus.auth.session', JSON.stringify(nextSession));
        setEmail(newEmail);
        setEmailOpen(false);
        showToast('Email address updated successfully!');
      }
    } catch (err) {
      console.error('Failed to update email:', err);
    }
  }

  function updatePassword() {
    if (!pwd.current || !pwd.next || !pwd.confirm) { showToast('Please fill all password fields.', 'error'); return; }
    if (pwd.next !== pwd.confirm) { showToast('New passwords do not match.', 'error'); return; }
    if (pwd.next.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    try {
      const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
      const idx = accounts.findIndex((a) => normalize(a.username) === normalize(username));
      if (idx !== -1) {
        if (accounts[idx].password !== pwd.current) { showToast('Current password is incorrect.', 'error'); return; }
        accounts[idx].password = pwd.next;
        localStorage.setItem('nexus.auth.accounts', JSON.stringify(accounts));
        setPasswordOpen(false);
        setPwd({ current: '', next: '', confirm: '' });
        showToast('Password updated successfully!');
      }
    } catch (err) {
      console.error('Failed to update password:', err);
    }
  }

  const total = derived.wins + derived.losses;
  const winRate = total ? Math.round((derived.wins / total) * 100) : 0;

  return (
    <>
      <main className="profile-page">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            <img
              className="profile-avatar"
              src={assetUrl('88bb61dd411e2e781af6284e0036a9672ba8ef32.png')}
              alt="Avatar"
              onError={(e) => { e.currentTarget.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><rect width=%22120%22 height=%22120%22 rx=%2260%22 fill=%22%23222%22/><text x=%2260%22 y=%2274%22 text-anchor=%22middle%22 fill=%22%23c6ff33%22 font-size=%2248%22>A</text></svg>'; }}
            />
            <div className="profile-online"></div>
          </div>

          <div className="profile-info">
            <div className="profile-header-meta">
              <h1 id="profile-displayName">{displayName || '—'}</h1>
              <div className="rank-badge" id="profile-rank-badge" style={{ display: 'none' }}></div>
            </div>
            <div className="username" id="profile-username">@{username || '—'}</div>
            <p className="bio" id="profile-bio">{bio}</p>
            <div className="profile-badges" id="profile-badges-container"></div>
            <div className="profile-stats-row">
              <div className="profile-stat"><div className="l">USER - ID</div><div className="n" id="profile-user-id">{username || '—'}</div></div>
              <div className="profile-stat"><div className="l">LAST LOGIN</div><div className="n" id="profile-last-login">{formatDate(session && (session.lastLoginAt || session.loggedInAt))}</div></div>
              <div className="profile-stat"><div className="l">JOINED DATE</div><div className="n" id="profile-joined-date">{formatDate(session && session.joinedAt)}</div></div>
              <div className="profile-stat"><div className="l">MAX PRIVILEGE</div><div className="n stat-val-accent" id="profile-max-priv">{formatRole(session && session.role)}</div></div>
            </div>
          </div>

          <div className="header-actions-col">
            <button className="edit-profile-btn" onClick={() => { setBioInput(bio); setEditOpen(true); }}>Edit Profile</button>
            <button className="btn-primary header-btn-primary btn-logout" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        <div className="profile-body">
          <div className="profile-main">
            <div className="profile-tabs">
              {PTABS.map((t) => (
                <button key={t.id} className={`ptab${tab === t.id ? ' active' : ''}`} data-ptab={t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            <div className={`ptab-panel${tab === 'history' ? ' active' : ''}`} id="ptab-history">
              <div className="profile-section panel-section-wrapper">
                <div className="match-history" id="match-history-list">
                  {derived.history.length === 0 ? (
                    <p className="empty-state-text" style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>No match history yet. Join a competition to get started!</p>
                  ) : (
                    derived.history.map((m, i) => (
                      <div className="match-item" key={i}>
                        <div>
                          <div className="game">{m.game}</div>
                          <div className="event">{m.event}</div>
                          <div className="date match-date-alt">{m.date}</div>
                        </div>
                        <div className={m.result === 'WIN' ? 'result-win' : 'result-loss'}>{m.result}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className={`ptab-panel${tab === 'stats' ? ' active' : ''}`} id="ptab-stats">
              <div className="profile-section panel-section-wrapper">
                <div className="stat-bars" id="stat-bars">
                  {total === 0 ? (
                    <p className="empty-state-text" style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>No statistics yet. Complete matches to build your stats.</p>
                  ) : (
                    <>
                      <div className="stat-bar-item">
                        <div className="stat-bar-label"><span className="name">Win Rate</span><span className="val">{winRate}%</span></div>
                        <div className="stat-bar-track"><div className="stat-bar-fill" data-w={winRate} style={{ width: `${winRate}%` }}></div></div>
                      </div>
                      <div className="stat-bar-item">
                        <div className="stat-bar-label"><span className="name">Matches Played</span><span className="val">{total}</span></div>
                        <div className="stat-bar-track"><div className="stat-bar-fill" data-w={Math.min(100, total * 10)} style={{ width: `${Math.min(100, total * 10)}%` }}></div></div>
                      </div>
                      <div className="stat-bar-item">
                        <div className="stat-bar-label"><span className="name">Wins</span><span className="val">{derived.wins}</span></div>
                        <div className="stat-bar-track"><div className="stat-bar-fill" data-w={Math.min(100, derived.wins * 12)} style={{ width: `${Math.min(100, derived.wins * 12)}%` }}></div></div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className={`ptab-panel${tab === 'sessions' ? ' active' : ''}`} id="ptab-sessions">
              <div className="profile-section panel-section-wrapper">
                <div className="active-sessions-list">
                  <div className="session-item">
                    <div className="session-device-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></div>
                    <div className="session-info"><div className="session-name">Laptop • Sricity, India</div><div className="session-status current">Current Session</div></div>
                  </div>
                  <div className="session-item">
                    <div className="session-device-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg></div>
                    <div className="session-info"><div className="session-name">iPhone 15 Pro • Chennai, India</div><div className="session-status">Logged Out</div></div>
                  </div>
                  <div className="session-item">
                    <div className="session-device-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></div>
                    <div className="session-info"><div className="session-name">Desktop • Bangalore, India</div><div className="session-status">Logged Out</div></div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`ptab-panel${tab === 'account' ? ' active' : ''}`} id="ptab-account">
              <div className="profile-section panel-section-wrapper">
                <div className="settings-full-card">
                  <div className="settings-header">
                    <div className="settings-title">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      Account Settings
                    </div>
                  </div>
                  <div className="settings-content">
                    <div className="settings-item-row">
                      <div className="settings-label-info">
                        <h3>Email Address</h3>
                        <p>The email address associated with your account.</p>
                      </div>
                      <div className="settings-action-input-wrap">
                        <div className="input-display-pill">
                          <span id="account-email-display">{email || '—'}</span>
                          <button className="btn-change-inline" onClick={() => { setEmailInput(email); setEmailOpen(true); }}>Change</button>
                        </div>
                      </div>
                    </div>
                    <div className="settings-divider"></div>
                    <div className="settings-item-row">
                      <div className="settings-label-info">
                        <h3>Password</h3>
                        <p>Last changed 3 months ago. Strong password recommended.</p>
                      </div>
                      <div className="settings-action-input-wrap">
                        <button className="btn-update-pill" onClick={() => { setPwd({ current: '', next: '', confirm: '' }); setPasswordOpen(true); }}>Update Password</button>
                      </div>
                    </div>
                    <div className="settings-divider"></div>
                    <div className="settings-item-row">
                      <div className="settings-label-info">
                        <h3>Two factor Authentication</h3>
                        <p>Secure your account with 2FA using Google Authenticator</p>
                      </div>
                      <div className="settings-action-input-wrap">
                        <div className="toggle-control-group">
                          <label className="nexus-switch"><input type="checkbox" defaultChecked /><span className="nexus-slider round"></span></label>
                          <span className="status-label">Enabled</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`ptab-panel${tab === 'preferences' ? ' active' : ''}`} id="ptab-preferences">
              <div className="profile-section panel-section-wrapper">
                <div className="settings-full-card pref-card">
                  <div className="settings-header">
                    <div className="settings-title">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                      Preferences
                    </div>
                  </div>
                  <div className="settings-content">
                    <div className="pref-detail-section">
                      <h3>Language</h3>
                      <div className="pref-select-wrap">
                        <select className="nexus-select"><option>English (US)</option><option>Spanish</option><option>Portuguese</option></select>
                        <svg className="chevron-down" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"></path></svg>
                      </div>
                    </div>
                    <div className="pref-detail-section notif-section">
                      <h3>Notifications</h3>
                      <div className="notif-toggle-list">
                        {['Email Alerts', 'Push Notifications', 'Marketing', 'Messages'].map((label) => (
                          <div className="notif-toggle-item" key={label}>
                            <span>{label}</span>
                            <label className="nexus-switch"><input type="checkbox" defaultChecked /><span className="nexus-slider round"></span></label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="profile-sidebar">
            <div className="comp-sidebar-block">
              <h3>My Teams</h3>
              <div className="teams-list" id="profile-teams-list">
                {derived.myTeams.length === 0 ? (
                  <p className="empty-state-text" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Not part of any team yet.</p>
                ) : (
                  derived.myTeams.map((t, i) => (
                    <div className="team-row" key={i}>
                      <div className="t-icon">{t.icon}</div>
                      <div><div className="t-name">{t.name}</div><div className="t-game">{t.game}</div></div>
                      <div className="t-role">{t.role}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="comp-sidebar-block">
              <h3>Upcoming Matches</h3>
              <div className="match-stack" id="profile-upcoming-matches">
                {derived.upcoming.length === 0 ? (
                  <p className="empty-state-text" style={{ color: 'var(--text-muted)', fontSize: 13 }}>No upcoming matches scheduled.</p>
                ) : (
                  derived.upcoming.slice(0, 3).map((m, i) => (
                    <div className="match-card-mini" key={i}>
                      <div className="match-game-label">{m.game}</div>
                      <div className="match-title-sm">{m.event}</div>
                      <div className="match-schedule-sm">{m.dateTime}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className={`modal-overlay${editOpen ? ' open' : ''}`} id="edit-modal" onClick={(e) => { if (e.target.id === 'edit-modal') setEditOpen(false); }}>
        <div className="modal modal-relative">
          <h2>Edit Profile</h2>
          <p>Update your profile information below.</p>
          <button className="modal-close" onClick={() => setEditOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" /></svg>
          </button>
          <div className="modal-body-stack">
            <div className="form-group"><label className="form-label">Display Name</label><input className="form-input" type="text" id="profile-displayname-input" defaultValue={displayName} /></div>
            <div className="form-group"><label className="form-label">Username</label><input className="form-input" type="text" id="profile-username-input" defaultValue={`@${username}`} readOnly /></div>
            <div className="form-group"><label className="form-label">Bio</label><textarea className="form-textarea modal-textarea-sm" id="profile-bio-input" value={bioInput} onChange={(e) => setBioInput(e.target.value)} /></div>
            <button className="btn-auth-submit modal-submit-btn" onClick={saveProfile}>Save Changes</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${emailOpen ? ' open' : ''}`} id="email-modal" onClick={(e) => { if (e.target.id === 'email-modal') setEmailOpen(false); }}>
        <div className="modal modal-relative">
          <h2>Change Email Address</h2>
          <p>Update your account email address below.</p>
          <button className="modal-close" onClick={() => setEmailOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" /></svg>
          </button>
          <div className="modal-body-stack">
            <div className="form-group"><label className="form-label">New Email Address</label><input className="form-input" type="email" id="new-email-input" placeholder="name@example.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} /></div>
            <button className="btn-auth-submit modal-submit-btn" onClick={updateEmail}>Update Email</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${passwordOpen ? ' open' : ''}`} id="password-modal" onClick={(e) => { if (e.target.id === 'password-modal') setPasswordOpen(false); }}>
        <div className="modal modal-relative">
          <h2>Update Password</h2>
          <p>Ensure your account stays secure with a strong password.</p>
          <button className="modal-close" onClick={() => setPasswordOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" /></svg>
          </button>
          <div className="modal-body-stack">
            <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" id="current-password-input" placeholder="••••••••" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" id="new-password-input" placeholder="••••••••" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" id="confirm-password-input" placeholder="••••••••" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} /></div>
            <button className="btn-auth-submit modal-submit-btn" onClick={updatePassword}>Change Password</button>
          </div>
        </div>
      </div>
    </>
  );
}


