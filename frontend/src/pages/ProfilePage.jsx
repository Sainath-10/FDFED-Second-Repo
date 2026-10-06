import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusAuth } from '../services/authService';
import { NexusData } from '../services/competitionService';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/profile.css';

const AUTH_SESSION_KEY = 'nexus.auth.session';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRole(role) {
  const map = {
    regular: 'User',
    participant: 'User',
    team_lead: 'Team Lead',
    admin: 'Comp Admin',
    comp_admin: 'Comp Admin',
    dispute_admin: 'Dispute Admin',
    revenue_admin: 'Revenue Admin',
    'super-admin': 'Super Admin',
    super_admin: 'Super Admin'
  };
  const key = String(role || '').trim().toLowerCase();
  return map[key] || 'User';
}

function getBioStorageKey(username) {
  return 'nexus.profile.bio.' + String(username || '').trim().toLowerCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [session, setSession] = useState(() => {
    if (NexusAuth && typeof NexusAuth.getSession === 'function') {
      const s = NexusAuth.getSession();
      if (s && s.username) return s;
    }
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  });

  const [activeTab, setActiveTab] = useState('history');
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // User competitions & teams data
  const [myTeams, setMyTeams] = useState([]);
  const [myUpcomingMatches, setMyUpcomingMatches] = useState([]);
  const [myMatchHistory, setMyMatchHistory] = useState([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0, total: 0, winRate: 0 });

  useEffect(() => {
    if (!session || !session.username) {
      navigate('/login', { replace: true });
      return;
    }

    const dName = session.displayName
      || (session.firstName && session.lastName
        ? session.firstName + ' ' + session.lastName
        : session.username);
    setDisplayName(dName || '—');
    setUsername(session.username || '—');

    try {
      const storedBio = localStorage.getItem(getBioStorageKey(session.username));
      setBio(storedBio || '');
    } catch (e) {}

    // Load matches and teams
    const allComps = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    const uName = String(session.username || '').toLowerCase();

    const teams = [];
    const upcoming = [];
    const history = [];
    let w = 0, l = 0;

    allComps.forEach(comp => {
      if (!Array.isArray(comp.teams)) return;
      comp.teams.forEach(team => {
        const isLeader = String(team.createdBy || '').toLowerCase() === uName;
        const isMember = Array.isArray(team.members) &&
          team.members.some(m => String(m.username || '').toLowerCase() === uName);
        if (!isLeader && !isMember) return;

        const role = isLeader ? 'Captain' : 'Player';
        const icon = isLeader ? '⚡' : '🎮';
        teams.push({ name: team.name, game: comp.game, role, icon });

        if (Array.isArray(comp.matches)) {
          comp.matches.forEach(m => {
            const inMatch = String(m.team1 || '').toLowerCase() === String(team.name || '').toLowerCase()
              || String(m.team2 || '').toLowerCase() === String(team.name || '').toLowerCase();
            if (!inMatch) return;

            if (m.status === 'scheduled' || m.status === 'live') {
              upcoming.push({
                game: comp.game,
                event: m.team1 + ' vs ' + m.team2 + (m.round ? ' — ' + m.round : ''),
                dateTime: (m.date || '') + (m.time ? ' • ' + m.time : '')
              });
            }

            if (m.status === 'completed') {
              const t1won = Number(m.score1) > Number(m.score2);
              const t2won = Number(m.score2) > Number(m.score1);
              const isT1 = String(m.team1 || '').toLowerCase() === String(team.name || '').toLowerCase();
              const won = (isT1 && t1won) || (!isT1 && t2won);
              history.push({
                game: comp.game,
                event: (m.round ? m.round + ' — ' : '') + m.team1 + ' vs ' + m.team2,
                date: m.date || '',
                result: won ? 'WIN' : 'LOSS'
              });
              if (won) w++; else l++;
            }
          });
        }
      });
    });

    setMyTeams(teams);
    setMyUpcomingMatches(upcoming);
    setMyMatchHistory(history);
    const tot = w + l;
    setStats({
      wins: w,
      losses: l,
      total: tot,
      winRate: tot > 0 ? Math.round((w / tot) * 100) : 0
    });
  }, [session, navigate]);

  if (!session) return null;

  const handleOpenEdit = () => {
    setEditDisplayName(displayName);
    setEditUsername(username);
    setEditBio(bio);
    setShowEditModal(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (session) {
      const nextBio = editBio.trim();
      setBio(nextBio);
      try {
        localStorage.setItem(getBioStorageKey(session.username), nextBio);
      } catch (err) {}

      if (editDisplayName.trim()) {
        setDisplayName(editDisplayName.trim());
        const updatedSession = { ...session, displayName: editDisplayName.trim() };
        setSession(updatedSession);
        try {
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updatedSession));
        } catch (err) {}
      }
    }
    setShowEditModal(false);
    showToast('Profile updated successfully!');
  };

  const handleUpdateEmail = (e) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    const accountsKey = 'nexus.auth.accounts';
    try {
      const accounts = JSON.parse(localStorage.getItem(accountsKey) || '[]');
      const idx = accounts.findIndex(a => a.username.toLowerCase() === session.username.toLowerCase());
      if (idx !== -1) {
        accounts[idx].email = cleanEmail;
        localStorage.setItem(accountsKey, JSON.stringify(accounts));
      }
      const updated = { ...session, email: cleanEmail };
      setSession(updated);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updated));
      setShowEmailModal(false);
      showToast('Email address updated successfully!');
    } catch (err) {
      showToast('Failed to update email.', 'error');
    }
  };

  const handleUpdatePassword = (e) => {
    e.preventDefault();
    if (!currPassword || !newPassword || !confirmPassword) {
      showToast('Please fill all password fields.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    const accountsKey = 'nexus.auth.accounts';
    try {
      const accounts = JSON.parse(localStorage.getItem(accountsKey) || '[]');
      const idx = accounts.findIndex(a => a.username.toLowerCase() === session.username.toLowerCase());
      if (idx !== -1) {
        if (accounts[idx].password !== currPassword) {
          showToast('Current password is incorrect.', 'error');
          return;
        }
        accounts[idx].password = newPassword;
        localStorage.setItem(accountsKey, JSON.stringify(accounts));
        setShowPasswordModal(false);
        setCurrPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast('Password updated successfully!');
      }
    } catch (err) {
      showToast('Failed to update password.', 'error');
    }
  };

  const handleLogout = () => {
    if (NexusAuth && typeof NexusAuth.clearSession === 'function') {
      NexusAuth.clearSession();
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
    navigate('/login');
  };

  return (
    <Shell activeTab="profile">
      <main className="profile-page">
          {/* Profile Header Card */}
          <div className="profile-header">
            <div className="profile-avatar-wrap">
              <img
                className="profile-avatar"
                src="/assets/88bb61dd411e2e781af6284e0036a9672ba8ef32.png"
                alt="Avatar"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="60" fill="%23222"/><text x="60" y="74" text-anchor="middle" fill="%23c6ff33" font-size="48">A</text></svg>';
                }}
              />
              <div className="profile-online"></div>
            </div>

            <div className="profile-info">
              <div className="profile-header-meta">
                <h1 id="profile-displayName">{displayName}</h1>
                <div className="rank-badge" id="profile-rank-badge" style={{ display: 'none' }}></div>
              </div>
              <div className="username" id="profile-username">@{username}</div>
              <p className="bio" id="profile-bio">{bio || 'No bio added yet.'}</p>
              <div className="profile-badges" id="profile-badges-container"></div>
              <div className="profile-stats-row">
                <div className="profile-stat">
                  <div className="l">USER - ID</div>
                  <div className="n" id="profile-user-id">{username}</div>
                </div>
                <div className="profile-stat">
                  <div className="l">LAST LOGIN</div>
                  <div className="n" id="profile-last-login">
                    {formatDate(session.lastLoginAt || session.loggedInAt || new Date())}
                  </div>
                </div>
                <div className="profile-stat">
                  <div className="l">JOINED DATE</div>
                  <div className="n" id="profile-joined-date">
                    {formatDate(session.joinedAt || '2026-01-02')}
                  </div>
                </div>
                <div className="profile-stat">
                  <div className="l">MAX PRIVILEGE</div>
                  <div className="n stat-val-accent" id="profile-max-priv">
                    {formatRole(session.role)}
                  </div>
                </div>
              </div>
            </div>

            <div className="header-actions-col">
              <button
                type="button"
                className="edit-profile-btn"
                onClick={handleOpenEdit}
              >
                Edit Profile
              </button>
              <button
                type="button"
                className="btn-primary header-btn-primary btn-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Profile Body */}
          <div className="profile-body">
            {/* Left Main Column */}
            <div className="profile-main">
              {/* Tabs */}
              <div className="profile-tabs">
                <button
                  type="button"
                  className={`ptab ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  Match History
                </button>
                <button
                  type="button"
                  className={`ptab ${activeTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stats')}
                >
                  Statistics
                </button>
                <button
                  type="button"
                  className={`ptab ${activeTab === 'sessions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sessions')}
                >
                  Active Sessions
                </button>
                <button
                  type="button"
                  className={`ptab ${activeTab === 'account' ? 'active' : ''}`}
                  onClick={() => setActiveTab('account')}
                >
                  Account Settings
                </button>
                <button
                  type="button"
                  className={`ptab ${activeTab === 'preferences' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preferences')}
                >
                  Preferences
                </button>
              </div>

              {/* Match History Tab */}
              {activeTab === 'history' && (
                <div className="ptab-panel active" id="ptab-history">
                  <div className="profile-section panel-section-wrapper">
                    <div className="match-history" id="match-history-list">
                      {myMatchHistory.length === 0 ? (
                        <p className="empty-state-text" id="match-history-empty" style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '24px 0' }}>
                          No match history yet. Join a competition to get started!
                        </p>
                      ) : (
                        myMatchHistory.map((m, idx) => (
                          <div className="match-item" key={idx}>
                            <div>
                              <div className="game">{m.game}</div>
                              <div className="event">{m.event}</div>
                              <div className="date match-date-alt">{m.date}</div>
                            </div>
                            <div className={m.result === 'WIN' ? 'result-win' : 'result-loss'}>
                              {m.result}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics Tab */}
              {activeTab === 'stats' && (
                <div className="ptab-panel active" id="ptab-stats">
                  <div className="profile-section panel-section-wrapper">
                    <div className="stat-bars" id="stat-bars">
                      {stats.total === 0 ? (
                        <p className="empty-state-text" id="stats-empty" style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '24px 0' }}>
                          No statistics yet. Complete matches to build your stats.
                        </p>
                      ) : (
                        <>
                          <div className="stat-bar-item">
                            <div className="stat-bar-label">
                              <span className="name">Win Rate</span>
                              <span className="val">{stats.winRate}%</span>
                            </div>
                            <div className="stat-bar-track">
                              <div className="stat-bar-fill" style={{ width: `${stats.winRate}%` }}></div>
                            </div>
                          </div>
                          <div className="stat-bar-item">
                            <div className="stat-bar-label">
                              <span className="name">Matches Played</span>
                              <span className="val">{stats.total}</span>
                            </div>
                            <div className="stat-bar-track">
                              <div className="stat-bar-fill" style={{ width: `${Math.min(100, stats.total * 10)}%` }}></div>
                            </div>
                          </div>
                          <div className="stat-bar-item">
                            <div className="stat-bar-label">
                              <span className="name">Wins</span>
                              <span className="val">{stats.wins}</span>
                            </div>
                            <div className="stat-bar-track">
                              <div className="stat-bar-fill" style={{ width: `${Math.min(100, stats.wins * 12)}%` }}></div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Active Sessions Tab */}
              {activeTab === 'sessions' && (
                <div className="ptab-panel active" id="ptab-sessions">
                  <div className="profile-section panel-section-wrapper">
                    <div className="active-sessions-list">
                      <div className="session-item">
                        <div className="session-device-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                          </svg>
                        </div>
                        <div className="session-info">
                          <div className="session-name">Laptop • Sricity, India</div>
                          <div className="session-status current">Current Session</div>
                        </div>
                      </div>
                      <div className="session-item">
                        <div className="session-device-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                          </svg>
                        </div>
                        <div className="session-info">
                          <div className="session-name">iPhone 15 Pro • Chennai, India</div>
                          <div className="session-status">Logged Out</div>
                        </div>
                      </div>
                      <div className="session-item">
                        <div className="session-device-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                          </svg>
                        </div>
                        <div className="session-info">
                          <div className="session-name">Desktop • Bangalore, India</div>
                          <div className="session-status">Logged Out</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Settings Tab */}
              {activeTab === 'account' && (
                <div className="ptab-panel active" id="ptab-account">
                  <div className="profile-section panel-section-wrapper">
                    <div className="settings-full-card">
                      <div className="settings-header">
                        <div className="settings-title">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                          </svg>
                          Account Settings
                        </div>
                      </div>

                      <div className="settings-content">
                        {/* Email Address */}
                        <div className="settings-item-row">
                          <div className="settings-label-info">
                            <h3>Email Address</h3>
                            <p>The email address associated with your account.</p>
                          </div>
                          <div className="settings-action-input-wrap">
                            <div className="input-display-pill">
                              <span id="account-email-display">{session.email || '—'}</span>
                              <button
                                type="button"
                                className="btn-change-inline"
                                onClick={() => {
                                  setNewEmail(session.email || '');
                                  setShowEmailModal(true);
                                }}
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="settings-divider"></div>

                        {/* Password */}
                        <div className="settings-item-row">
                          <div className="settings-label-info">
                            <h3>Password</h3>
                            <p>Last changed 3 months ago. Strong password recommended.</p>
                          </div>
                          <div className="settings-action-input-wrap">
                            <button
                              type="button"
                              className="btn-update-pill"
                              onClick={() => {
                                setCurrPassword('');
                                setNewPassword('');
                                setConfirmPassword('');
                                setShowPasswordModal(true);
                              }}
                            >
                              Update Password
                            </button>
                          </div>
                        </div>

                        <div className="settings-divider"></div>

                        {/* Two factor Authentication */}
                        <div className="settings-item-row">
                          <div className="settings-label-info">
                            <h3>Two factor Authentication</h3>
                            <p>Secure your account with 2FA using Google Authenticator</p>
                          </div>
                          <div className="settings-action-input-wrap">
                            <div className="toggle-control-group">
                              <label className="nexus-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="nexus-slider round"></span>
                              </label>
                              <span className="status-label">Enabled</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="ptab-panel active" id="ptab-preferences">
                  <div className="profile-section panel-section-wrapper">
                    <div className="settings-full-card pref-card">
                      <div className="settings-header">
                        <div className="settings-title">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="4" y1="21" x2="4" y2="14"></line>
                            <line x1="4" y1="10" x2="4" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12" y2="3"></line>
                            <line x1="20" y1="21" x2="20" y2="16"></line>
                            <line x1="20" y1="12" x2="20" y2="3"></line>
                            <line x1="1" y1="14" x2="7" y2="14"></line>
                            <line x1="9" y1="8" x2="15" y2="8"></line>
                            <line x1="17" y1="16" x2="23" y2="16"></line>
                          </svg>
                          Preferences
                        </div>
                      </div>

                      <div className="settings-content">
                        {/* Language */}
                        <div className="pref-detail-section">
                          <h3>Language</h3>
                          <div className="pref-select-wrap">
                            <select className="nexus-select" defaultValue="English (US)">
                              <option>English (US)</option>
                              <option>Spanish</option>
                              <option>Portuguese</option>
                            </select>
                            <svg className="chevron-down" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 9l6 6 6-6"></path>
                            </svg>
                          </div>
                        </div>

                        {/* Notifications */}
                        <div className="pref-detail-section notif-section">
                          <h3>Notifications</h3>
                          <div className="notif-toggle-list">
                            <div className="notif-toggle-item">
                              <span>Email Alerts</span>
                              <label className="nexus-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="nexus-slider round"></span>
                              </label>
                            </div>
                            <div className="notif-toggle-item">
                              <span>Push Notifications</span>
                              <label className="nexus-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="nexus-slider round"></span>
                              </label>
                            </div>
                            <div className="notif-toggle-item">
                              <span>Marketing</span>
                              <label className="nexus-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="nexus-slider round"></span>
                              </label>
                            </div>
                            <div className="notif-toggle-item">
                              <span>Messages</span>
                              <label className="nexus-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="nexus-slider round"></span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <aside className="profile-sidebar">
              {/* Current Teams */}
              <div className="comp-sidebar-block">
                <h3>My Teams</h3>
                <div className="teams-list" id="profile-teams-list">
                  {myTeams.length === 0 ? (
                    <p className="empty-state-text" id="teams-empty" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      Not part of any team yet.
                    </p>
                  ) : (
                    myTeams.map((t, idx) => (
                      <div className="team-row" key={idx}>
                        <div className="t-icon">{t.icon}</div>
                        <div>
                          <div className="t-name">{t.name}</div>
                          <div className="t-game">{t.game}</div>
                        </div>
                        <div className="t-role">{t.role}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Upcoming Matches */}
              <div className="comp-sidebar-block">
                <h3>Upcoming Matches</h3>
                <div className="match-stack" id="profile-upcoming-matches">
                  {myUpcomingMatches.length === 0 ? (
                    <p className="empty-state-text" id="upcoming-empty" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      No upcoming matches scheduled.
                    </p>
                  ) : (
                    myUpcomingMatches.slice(0, 3).map((m, idx) => (
                      <div className="match-card-mini" key={idx}>
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

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay open" id="edit-modal" onClick={(e) => e.target.id === 'edit-modal' && setShowEditModal(false)}>
          <div className="modal modal-relative">
            <h2>Edit Profile</h2>
            <p>Update your profile information below.</p>
            <button type="button" className="modal-close" onClick={() => setShowEditModal(false)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="14" y2="14" />
                <line x1="14" y1="2" x2="2" y2="14" />
              </svg>
            </button>
            <form onSubmit={handleSaveProfile} className="modal-body-stack">
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  className="form-input"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  type="text"
                  value={editUsername}
                  disabled
                />
              </div>
              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea
                  className="form-textarea modal-textarea-sm"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-auth-submit modal-submit-btn">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* Update Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay open" id="email-modal" onClick={(e) => e.target.id === 'email-modal' && setShowEmailModal(false)}>
          <div className="modal modal-relative">
            <h2>Change Email Address</h2>
            <p>Update your account email address below.</p>
            <button type="button" className="modal-close" onClick={() => setShowEmailModal(false)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="14" y2="14" />
                <line x1="14" y1="2" x2="2" y2="14" />
              </svg>
            </button>
            <form onSubmit={handleUpdateEmail} className="modal-body-stack">
              <div className="form-group">
                <label className="form-label">New Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <button type="submit" className="btn-auth-submit modal-submit-btn">Update Email</button>
            </form>
          </div>
        </div>
      )}

      {/* Update Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay open" id="password-modal" onClick={(e) => e.target.id === 'password-modal' && setShowPasswordModal(false)}>
          <div className="modal modal-relative">
            <h2>Update Password</h2>
            <p>Ensure your account stays secure with a strong password.</p>
            <button type="button" className="modal-close" onClick={() => setShowPasswordModal(false)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="14" y2="14" />
                <line x1="14" y1="2" x2="2" y2="14" />
              </svg>
            </button>
            <form onSubmit={handleUpdatePassword} className="modal-body-stack">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="btn-auth-submit modal-submit-btn">Change Password</button>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
