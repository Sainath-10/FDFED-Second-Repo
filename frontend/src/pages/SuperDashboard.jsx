/**
 * NEXUS ESPORTS — Super Admin Dashboard
 *
 * system
 * monitoring (live `/admin/stats`), platform settings, the tournament/security/data
 * settings tabs, and persisted dashboard state (nexus.superadmin.dashboard.state —
 * the same store create-competition reads for the cfg-format and cfg-max-teams keys).
 *
 * Deviation: the page embedded its own `.sa-sidebar-v2`; here the shared
 * classic sidebar (AppLayout) is used, matching every other super-admin page.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/super-admin/super-dashboard.css';

const DASHBOARD_STATE_KEY = 'nexus.superadmin.dashboard.state';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DEFAULTS = {
  platformName: 'Nexus Esports Platform',
  platformDomain: 'nexus-esports.gg',
  supportEmail: 'support@nexus.esports.gg',
  defaultLanguage: 'English',
  defaultTimezone: 'UTC (GMT + 0)',
  'cfg-format-knockouts': true,
  'cfg-format-roundrobin': true,
  'cfg-max-teams': 40,
  'cfg-session-timeout': 30,
  'cfg-max-login-attempts': 5,
  'cfg-2fa-required': true,
  maintenanceMode: true,
  backupFrequency: 'Daily',
  backupNow: true,
  dataRetention: 2,
};

export default function SuperDashboard() {
  const { session } = useAuth();
  const [tab, setTab] = useState('dash');
  const [state, setState] = useState(DEFAULTS);
  const [initial, setInitial] = useState(DEFAULTS);
  const [stats, setStats] = useState({ activeUsers: '12,842', tournaments: '142', status: 'Active', uptime: '99.98%' });

  useEffect(() => {
    let persisted = null;
    try { persisted = JSON.parse(localStorage.getItem(DASHBOARD_STATE_KEY) || 'null'); } catch (e) { persisted = null; }
    const merged = persisted ? { ...DEFAULTS, ...persisted } : DEFAULTS;
    setInitial(merged);
    setState(merged);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/admin/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => {
        if (!s || !alive) return;
        setStats((prev) => ({
          activeUsers: s.totalUsers !== undefined ? s.totalUsers.toLocaleString() : prev.activeUsers,
          tournaments: s.activeCompetitions !== undefined ? s.activeCompetitions.toLocaleString() : prev.tournaments,
          status: s.systemStatus !== undefined ? s.systemStatus : prev.status,
          uptime: s.uptimePercentage !== undefined ? `${s.uptimePercentage}%` : prev.uptime,
        }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const set = (key, value) => setState((prev) => ({ ...prev, [key]: value }));

  function saveChanges() {
    localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(state));
    showToast('Dashboard changes saved.');
  }
  function resetChanges() {
    setState(initial);
    localStorage.removeItem(DASHBOARD_STATE_KEY);
    showToast('Dashboard reset to original defaults.');
  }
  function backupNow() {
    showToast('System backup initiated... 0%', 'info');
    setTimeout(() => showToast('Backup completed successfully! 100%'), 1500);
  }

  return (
    <main className="sa-main-v2">
      <header className="sa-header-v2">
        <div className="sa-header-left">
          <h1 className="sa-title">Super Admin - <span className="accent-text">Dashboard</span></h1>
          <p className="sa-desc">Manage global platform settings, policies and security controls for the Nexus Esports ecosystem.</p>
        </div>
        <div className="sa-header-actions">
          <button className="sa-btn-rect" onClick={resetChanges}>Reset Changes</button>
          <button className="sa-btn-rect sa-btn-icon" onClick={saveChanges}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            Save Changes
          </button>
        </div>
      </header>

      <div className="sa-tabs-bar">
        {[['dash', 'Dashboard'], ['tourney', 'Tournament / League Configuration'], ['security', 'Security Settings'], ['data', 'Data Management & Maintenance']].map(([k, l]) => (
          <button key={k} className={`sa-tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div className="sa-tab-panels">
        {tab === 'dash' && (
          <div id="tab-dash" className="sa-tab-panel active">
            <div className="sa-section-card">
              <div className="sa-section-header">System Monitoring</div>
              <div className="sa-monitoring-grid">
                <div className="sa-mon-item"><div className="sa-mon-label">ACTIVE USERS</div><div className="sa-mon-value">{stats.activeUsers}</div></div>
                <div className="sa-mon-item"><div className="sa-mon-label">RUNNING TOURNAMENTS</div><div className="sa-mon-value">{stats.tournaments}</div></div>
                <div className="sa-mon-item"><div className="sa-mon-label">SERVER STATUS</div><div className="sa-mon-value"><span className="status-dot"></span> {stats.status}</div></div>
                <div className="sa-mon-item"><div className="sa-mon-label">SYSTEM UPTIME</div><div className="sa-mon-value">{stats.uptime}</div></div>
              </div>
            </div>

            <div className="sa-section-card">
              <div className="sa-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 10 }}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                Platform Settings
              </div>
              <div className="sa-platform-settings">
                <div className="sa-logo-upload">
                  <div className="sa-logo-preview">
                    <img src={assetUrl('f03e2b11537e425d8544ee3ca732bf73af5137c0.png')} alt="Nexus" style={{ width: 47, height: 40, objectFit: 'cover', borderRadius: 10 }} />
                    <div className="sa-logo-brand">NXS</div>
                  </div>
                </div>
                <div className="sa-settings-form">
                  <div className="form-row-dual">
                    <div className="form-group-v2"><label>PLATFORM NAME</label><input type="text" value={state.platformName} onChange={(e) => set('platformName', e.target.value)} /></div>
                    <div className="form-group-v2"><label>PLATFORM DOMAIN</label><input type="text" value={state.platformDomain} onChange={(e) => set('platformDomain', e.target.value)} /></div>
                  </div>
                  <div className="form-row-dual">
                    <div className="form-group-v2"><label>SUPPORT EMAIL</label><input type="text" value={state.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} /></div>
                    <div className="form-group-v2"><label>DEFAULT TIME LANGUAGE</label>
                      <select value={state.defaultLanguage} onChange={(e) => set('defaultLanguage', e.target.value)}>
                        <option>English</option><option>Spanish</option><option>French</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group-v2"><label>DEFAULT TIME ZONE</label>
                    <select value={state.defaultTimezone} onChange={(e) => set('defaultTimezone', e.target.value)}>
                      <option>UTC (GMT + 0)</option><option>IST (GMT + 5:30)</option><option>EST (GMT - 5)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'tourney' && (
          <div id="tab-tourney" className="sa-tab-panel active">
            <div className="sa-section-card">
              <div className="sa-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 10 }}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 12h4" /><path d="M8 10v4" /><line x1="15" y1="13" x2="15.01" y2="13" /><line x1="18" y1="11" x2="18.01" y2="11" /></svg>
                Tournament / League Configuration
              </div>
              <div className="sa-panel-content">
                <div className="sa-checkbox-row">
                  <div className="sa-toggle-info">
                    <div className="sa-toggle-title">Allowed Tournament Formats</div>
                    <div className="sa-toggle-desc">Define which competition formats are permitted.</div>
                  </div>
                  <div className="sa-check-options">
                    <label className="sa-check-label"><input type="checkbox" id="cfg-format-knockouts" checked={!!state['cfg-format-knockouts']} onChange={(e) => set('cfg-format-knockouts', e.target.checked)} /> <span>Knockouts</span></label>
                    <label className="sa-check-label"><input type="checkbox" id="cfg-format-roundrobin" checked={!!state['cfg-format-roundrobin']} onChange={(e) => set('cfg-format-roundrobin', e.target.checked)} /> <span>Round Robin</span></label>
                  </div>
                </div>
                <div className="sa-input-row">
                  <div className="sa-input-info">
                    <div className="sa-input-title">Maximum Teams per Tournament</div>
                    <div className="sa-input-desc">Set the maximum number of teams allowed to participate in a tournament.</div>
                  </div>
                  <input type="number" id="cfg-max-teams" className="sa-num-field" value={state['cfg-max-teams']} onChange={(e) => set('cfg-max-teams', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div id="tab-security" className="sa-tab-panel active">
            <div className="sa-section-card">
              <div className="sa-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 10 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                Security Settings
              </div>
              <div className="sa-panel-content">
                <div className="sa-input-row">
                  <div className="sa-input-info">
                    <div className="sa-input-title">Session Timeout Duration</div>
                    <div className="sa-input-desc">Define the period of inactivity after which a user session is automatically logged out.</div>
                  </div>
                  <div className="sa-input-with-unit"><input type="number" id="cfg-session-timeout" className="sa-num-field" value={state['cfg-session-timeout']} onChange={(e) => set('cfg-session-timeout', e.target.value)} /><span>mins</span></div>
                </div>
                <div className="sa-input-row">
                  <div className="sa-input-info">
                    <div className="sa-input-title">Maximum Login Attempts</div>
                    <div className="sa-input-desc">Set the number of failed login attempts allowed before the account is temporarily locked.</div>
                  </div>
                  <input type="number" id="cfg-max-login-attempts" className="sa-num-field" value={state['cfg-max-login-attempts']} onChange={(e) => set('cfg-max-login-attempts', e.target.value)} />
                </div>
                <div className="sa-toggle-row">
                  <div className="sa-toggle-info">
                    <div className="sa-toggle-title">Two-Factor Authentication Requirement</div>
                    <div className="sa-toggle-desc">Require users to verify their identity using an additional authentication method.</div>
                  </div>
                  <label className="sa-switch"><input type="checkbox" id="cfg-2fa-required" checked={!!state['cfg-2fa-required']} onChange={(e) => set('cfg-2fa-required', e.target.checked)} /><span className="sa-slider"></span></label>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div id="tab-data" className="sa-tab-panel active">
            <div className="sa-section-card">
              <div className="sa-section-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 10 }}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
                Data Management &amp; Maintenance
              </div>
              <div className="sa-panel-dual-grid">
                <div className="sa-toggle-row">
                  <div className="sa-toggle-info">
                    <div className="sa-toggle-title">Maintenance Mode</div>
                    <div className="sa-toggle-desc">Temporarily disable platform access while performing system updates or maintenance.</div>
                  </div>
                  <label className="sa-switch"><input type="checkbox" checked={!!state.maintenanceMode} onChange={(e) => set('maintenanceMode', e.target.checked)} /><span className="sa-slider"></span></label>
                </div>
                <div className="sa-input-row">
                  <div className="sa-input-info">
                    <div className="sa-input-title">Backup Frequency</div>
                    <div className="sa-input-desc">Define how often system data backups are automatically performed.</div>
                  </div>
                  <select className="sa-select-field" value={state.backupFrequency} onChange={(e) => set('backupFrequency', e.target.value)}><option>Daily</option><option>Weekly</option><option>Monthly</option></select>
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
                  <label className="sa-switch"><input type="checkbox" checked={!!state.backupNow} onChange={(e) => { set('backupNow', e.target.checked); if (e.target.checked) backupNow(); }} /><span className="sa-slider"></span></label>
                </div>
                <div className="sa-input-row">
                  <div className="sa-input-info">
                    <div className="sa-input-title">Data Retention Period</div>
                    <div className="sa-input-desc">Specify how long system data is stored before being archived or removed.</div>
                  </div>
                  <div className="sa-input-with-unit"><input type="number" className="sa-num-field" value={state.dataRetention} onChange={(e) => set('dataRetention', e.target.value)} /><span>months</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


