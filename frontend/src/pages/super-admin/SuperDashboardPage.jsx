import React, { useState, useEffect } from 'react';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import '../../styles/pages/super-admin/super-dashboard.css';

const DASHBOARD_STATE_KEY = 'nexus.superadmin.dashboard.state';

export default function SuperDashboardPage() {
  const [activeTab, setActiveTab] = useState('dash');
  const [stats, setStats] = useState({
    totalUsers: '12,842',
    activeCompetitions: '142',
    systemStatus: 'Active',
    uptimePercentage: '99.98%'
  });

  // Settings states
  const [platformName, setPlatformName] = useState('Nexus Esports Platform');
  const [platformDomain, setPlatformDomain] = useState('nexus-esports.gg');
  const [supportEmail, setSupportEmail] = useState('support@nexus.esports.gg');
  const [timeLanguage, setTimeLanguage] = useState('English');
  const [timeZone, setTimeZone] = useState('UTC (GMT + 0)');

  // Tournament config states
  const [knockoutsAllowed, setKnockoutsAllowed] = useState(true);
  const [roundRobinAllowed, setRoundRobinAllowed] = useState(true);
  const [maxTeams, setMaxTeams] = useState(40);

  // Security settings states
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);
  const [twoFactorRequired, setTwoFactorRequired] = useState(true);

  // Data management states
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [backupFreq, setBackupFreq] = useState('Daily');
  const [backupNow, setBackupNow] = useState(true);
  const [retentionPeriod, setRetentionPeriod] = useState(2);

  useEffect(() => {
    // Load persisted state
    try {
      const persisted = JSON.parse(localStorage.getItem(DASHBOARD_STATE_KEY) || 'null');
      if (persisted) {
        if (persisted.platformName !== undefined) setPlatformName(persisted.platformName);
        if (persisted.platformDomain !== undefined) setPlatformDomain(persisted.platformDomain);
        if (persisted.supportEmail !== undefined) setSupportEmail(persisted.supportEmail);
        if (persisted.timeLanguage !== undefined) setTimeLanguage(persisted.timeLanguage);
        if (persisted.timeZone !== undefined) setTimeZone(persisted.timeZone);
        if (persisted.knockoutsAllowed !== undefined) setKnockoutsAllowed(persisted.knockoutsAllowed);
        if (persisted.roundRobinAllowed !== undefined) setRoundRobinAllowed(persisted.roundRobinAllowed);
        if (persisted.maxTeams !== undefined) setMaxTeams(persisted.maxTeams);
        if (persisted.sessionTimeout !== undefined) setSessionTimeout(persisted.sessionTimeout);
        if (persisted.maxLoginAttempts !== undefined) setMaxLoginAttempts(persisted.maxLoginAttempts);
        if (persisted.twoFactorRequired !== undefined) setTwoFactorRequired(persisted.twoFactorRequired);
        if (persisted.maintenanceMode !== undefined) setMaintenanceMode(persisted.maintenanceMode);
        if (persisted.backupFreq !== undefined) setBackupFreq(persisted.backupFreq);
        if (persisted.backupNow !== undefined) setBackupNow(persisted.backupNow);
        if (persisted.retentionPeriod !== undefined) setRetentionPeriod(persisted.retentionPeriod);
      }
    } catch (_) {}

    // Fetch real-time system stats from backend /admin/stats endpoint
    try {
      fetch('http://localhost:3001/admin/stats')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return;
          setStats({
            totalUsers: data.totalUsers !== undefined ? data.totalUsers.toLocaleString() : '12,842',
            activeCompetitions: data.activeCompetitions !== undefined ? data.activeCompetitions.toLocaleString() : '142',
            systemStatus: data.systemStatus !== undefined ? data.systemStatus : 'Active',
            uptimePercentage: data.uptimePercentage !== undefined ? `${data.uptimePercentage}%` : '99.98%'
          });
        })
        .catch(() => {});
    } catch (_) {}
  }, []);

  function handleSave() {
    const state = {
      platformName, platformDomain, supportEmail, timeLanguage, timeZone,
      knockoutsAllowed, roundRobinAllowed, maxTeams,
      sessionTimeout, maxLoginAttempts, twoFactorRequired,
      maintenanceMode, backupFreq, backupNow, retentionPeriod
    };
    localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(state));
    alert('Dashboard changes saved.');
  }

  function handleReset() {
    setPlatformName('Nexus Esports Platform');
    setPlatformDomain('nexus-esports.gg');
    setSupportEmail('support@nexus.esports.gg');
    setTimeLanguage('English');
    setTimeZone('UTC (GMT + 0)');
    setKnockoutsAllowed(true);
    setRoundRobinAllowed(true);
    setMaxTeams(40);
    setSessionTimeout(30);
    setMaxLoginAttempts(5);
    setTwoFactorRequired(true);
    setMaintenanceMode(false);
    setBackupFreq('Daily');
    setBackupNow(true);
    setRetentionPeriod(2);
    localStorage.removeItem(DASHBOARD_STATE_KEY);
    alert('Dashboard reset to original defaults.');
  }

  return (
    <Shell sidebarVariant="super-admin" activePage="dashboard">
      <main className="sa-main-v2">
        <header className="sa-header-v2">
          <div className="sa-header-left">
            <h1 className="sa-title">Super Admin - <span className="accent-text">Dashboard</span></h1>
            <p className="sa-desc">
              Manage global platform settings, policies and security controls for the Nexus Esports ecosystem.
            </p>
          </div>
          <div className="sa-header-actions">
            <button type="button" className="sa-btn-rect" onClick={handleReset}>Reset Changes</button>
            <button type="button" className="sa-btn-rect sa-btn-icon" onClick={handleSave}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Save Changes
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="sa-tabs-bar">
          <button className={`sa-tab-btn ${activeTab === 'dash' ? 'active' : ''}`} onClick={() => setActiveTab('dash')}>
            Dashboard
          </button>
          <button className={`sa-tab-btn ${activeTab === 'tourney' ? 'active' : ''}`} onClick={() => setActiveTab('tourney')}>
            Tournament / League Configuration
          </button>
          <button className={`sa-tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
            Security Settings
          </button>
          <button className={`sa-tab-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
            Data Management & Maintenance
          </button>
        </div>

        {/* Tab Panels Container */}
        <div className="sa-tab-panels">
          {/* Panel 1: Dashboard */}
          {activeTab === 'dash' && (
            <div id="tab-dash" className="sa-tab-panel active">
              {/* System Monitoring */}
              <div className="sa-section-card">
                <div className="sa-section-header">System Monitoring</div>
                <div className="sa-monitoring-grid">
                  <div className="sa-mon-item">
                    <div className="sa-mon-label">ACTIVE USERS</div>
                    <div className="sa-mon-value">{stats.totalUsers}</div>
                  </div>
                  <div className="sa-mon-item">
                    <div className="sa-mon-label">RUNNING TOURNAMENTS</div>
                    <div className="sa-mon-value">{stats.activeCompetitions}</div>
                  </div>
                  <div className="sa-mon-item">
                    <div className="sa-mon-label">SERVER STATUS</div>
                    <div className="sa-mon-value"><span className="status-dot"></span> {stats.systemStatus}</div>
                  </div>
                  <div className="sa-mon-item">
                    <div className="sa-mon-label">SYSTEM UPTIME</div>
                    <div className="sa-mon-value">{stats.uptimePercentage}</div>
                  </div>
                </div>
              </div>

              {/* Platform Settings */}
              <div className="sa-section-card">
                <div className="sa-section-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '10px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  Platform Settings
                </div>
                <div className="sa-platform-settings">
                  <div className="sa-logo-upload">
                    <div className="sa-logo-preview">
                      <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus" style={{ width: '47px', height: '40px', objectFit: 'cover', borderRadius: '10px' }} />
                      <div className="sa-logo-brand">NXS</div>
                    </div>
                  </div>
                  <div className="sa-settings-form">
                    <div className="form-row-dual">
                      <div className="form-group-v2">
                        <label>PLATFORM NAME</label>
                        <input type="text" value={platformName} onChange={e => setPlatformName(e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label>PLATFORM DOMAIN</label>
                        <input type="text" value={platformDomain} onChange={e => setPlatformDomain(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row-dual">
                      <div className="form-group-v2">
                        <label>SUPPORT EMAIL</label>
                        <input type="text" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} />
                      </div>
                      <div className="form-group-v2">
                        <label>DEFAULT TIME LANGUAGE</label>
                        <select value={timeLanguage} onChange={e => setTimeLanguage(e.target.value)}>
                          <option>English</option>
                          <option>Spanish</option>
                          <option>French</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group-v2">
                      <label>DEFAULT TIME ZONE</label>
                      <select value={timeZone} onChange={e => setTimeZone(e.target.value)}>
                        <option>UTC (GMT + 0)</option>
                        <option>IST (GMT + 5:30)</option>
                        <option>EST (GMT - 5)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel 2: Tournament Config */}
          {activeTab === 'tourney' && (
            <div id="tab-tourney" className="sa-tab-panel active">
              <div className="sa-section-card">
                <div className="sa-section-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '10px' }}>
                    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                    <path d="M6 12h4"></path>
                    <path d="M8 10v4"></path>
                    <line x1="15" y1="13" x2="15.01" y2="13"></line>
                    <line x1="18" y1="11" x2="18.01" y2="11"></line>
                  </svg>
                  Tournament / League Configuration
                </div>
                <div className="sa-panel-content">
                  <div className="sa-checkbox-row">
                    <div className="sa-toggle-info">
                      <div className="sa-toggle-title">Allowed Tournament Formats</div>
                      <div className="sa-toggle-desc">Define which competition formats are permitted.</div>
                    </div>
                    <div className="sa-check-options">
                      <label className="sa-check-label">
                        <input type="checkbox" checked={knockoutsAllowed} onChange={e => setKnockoutsAllowed(e.target.checked)} />
                        <span>Knockouts</span>
                      </label>
                      <label className="sa-check-label">
                        <input type="checkbox" checked={roundRobinAllowed} onChange={e => setRoundRobinAllowed(e.target.checked)} />
                        <span>Round Robin</span>
                      </label>
                    </div>
                  </div>
                  <div className="sa-input-row">
                    <div className="sa-input-info">
                      <div className="sa-input-title">Maximum Teams per Tournament</div>
                      <div className="sa-input-desc">Set the maximum number of teams allowed to participate in a tournament.</div>
                    </div>
                    <input
                      type="number"
                      className="sa-num-field"
                      value={maxTeams}
                      onChange={e => setMaxTeams(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel 3: Security Settings */}
          {activeTab === 'security' && (
            <div id="tab-security" className="sa-tab-panel active">
              <div className="sa-section-card">
                <div className="sa-section-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '10px' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  Security Settings
                </div>
                <div className="sa-panel-content">
                  <div className="sa-input-row">
                    <div className="sa-input-info">
                      <div className="sa-input-title">Session Timeout Duration</div>
                      <div className="sa-input-desc">Define the period of inactivity after which a user session is automatically logged out.</div>
                    </div>
                    <div className="sa-input-with-unit">
                      <input
                        type="number"
                        className="sa-num-field"
                        value={sessionTimeout}
                        onChange={e => setSessionTimeout(e.target.value)}
                      />
                      <span>mins</span>
                    </div>
                  </div>
                  <div className="sa-input-row">
                    <div className="sa-input-info">
                      <div className="sa-input-title">Maximum Login Attempts</div>
                      <div className="sa-input-desc">Set the number of failed login attempts allowed before the account is temporarily locked.</div>
                    </div>
                    <input
                      type="number"
                      className="sa-num-field"
                      value={maxLoginAttempts}
                      onChange={e => setMaxLoginAttempts(e.target.value)}
                    />
                  </div>
                  <div className="sa-toggle-row">
                    <div className="sa-toggle-info">
                      <div className="sa-toggle-title">Two-Factor Authentication Requirement</div>
                      <div className="sa-toggle-desc">Require users to verify their identity using an additional authentication method.</div>
                    </div>
                    <label className="sa-switch">
                      <input
                        type="checkbox"
                        checked={twoFactorRequired}
                        onChange={e => setTwoFactorRequired(e.target.checked)}
                      />
                      <span className="sa-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel 4: Data Management */}
          {activeTab === 'data' && (
            <div id="tab-data" className="sa-tab-panel active">
              <div className="sa-section-card">
                <div className="sa-section-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '10px' }}>
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                  </svg>
                  Data Management & Maintenance
                </div>
                <div className="sa-panel-dual-grid">
                  <div className="sa-toggle-row">
                    <div className="sa-toggle-info">
                      <div className="sa-toggle-title">Maintenance Mode</div>
                      <div className="sa-toggle-desc">Temporarily disable platform access while performing system updates or maintenance.</div>
                    </div>
                    <label className="sa-switch">
                      <input
                        type="checkbox"
                        checked={maintenanceMode}
                        onChange={e => setMaintenanceMode(e.target.checked)}
                      />
                      <span className="sa-slider"></span>
                    </label>
                  </div>
                  <div className="sa-input-row">
                    <div className="sa-input-info">
                      <div className="sa-input-title">Backup Frequency</div>
                      <div className="sa-input-desc">Define how often system data backups are automatically performed.</div>
                    </div>
                    <select
                      className="sa-select-field"
                      value={backupFreq}
                      onChange={e => setBackupFreq(e.target.value)}
                    >
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </div>
                  <div className="sa-input-row">
                    <div className="sa-input-info">
                      <div className="sa-input-title">Server Health Status</div>
                      <div className="sa-input-desc">Display the current operational state of the platform server.</div>
                    </div>
                    <span className="status-pill active-glow">Active</span>
                  </div>
                  <div className="sa-toggle-row">
                    <div className="sa-toggle-info">
                      <div className="sa-toggle-title">Backup Now</div>
                      <div className="sa-toggle-desc">Manually initiate an immediate backup of platform data.</div>
                    </div>
                    <label className="sa-switch">
                      <input
                        type="checkbox"
                        checked={backupNow}
                        onChange={e => setBackupNow(e.target.checked)}
                      />
                      <span className="sa-slider"></span>
                    </label>
                  </div>
                  <div className="sa-input-row">
                    <div className="sa-input-info">
                      <div className="sa-input-title">Data Retention Period</div>
                      <div className="sa-input-desc">Specify how long system data is stored before being archived or removed.</div>
                    </div>
                    <div className="sa-input-with-unit">
                      <input
                        type="number"
                        className="sa-num-field"
                        value={retentionPeriod}
                        onChange={e => setRetentionPeriod(e.target.value)}
                      />
                      <span>months</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
