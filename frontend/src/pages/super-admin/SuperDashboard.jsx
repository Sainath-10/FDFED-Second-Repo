/**
 * NEXUS ESPORTS — Super Admin dashboard
 *
 * Live platform numbers from /admin/stats, and the settings that the backend
 * actually enforces for every organizer: which formats can be created, the
 * team limit, and the platform-wide prize-pool ceiling.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI, ReputationAPI } from '../../services/api.js';
import { ErrorState, LoadingState, Notice, PageHeader, formatINR } from '../../components/ui.jsx';
import { showToast } from '../../lib/toast.js';

function Stat({ label, value }) {
  return (
    <div className="ui-card">
      <div className="ui-row-meta">{label}</div>
      <div className="page-title" style={{ fontSize: 28, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function SuperDashboard() {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [settings, setSettings] = useState(null);
  const [ceiling, setCeiling] = useState('');
  const [savedCeiling, setSavedCeiling] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, p, r] = await Promise.all([AdminAPI.getStats(), AdminAPI.getSettings(), ReputationAPI.config()]);
    if (s.ok) { setStats(s.data); setStatsError(''); } else setStatsError(s.error || 'Statistics are unavailable.');
    if (p.ok) setSettings(p.data);
    if (r.ok) { const max = r.data?.maxPrizePool ?? r.data?.globalMax; setCeiling(String(max ?? '')); setSavedCeiling(max ?? null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveSettings(event) {
    event.preventDefault();
    const maxTeams = Number(settings.maxTeams);
    if (!Number.isInteger(maxTeams) || maxTeams < 2 || maxTeams > 256) { showToast('Max teams must be a whole number from 2 to 256.', 'error'); return; }
    if (!settings.allowKnockout && !settings.allowRoundRobin) { showToast('Keep at least one format enabled.', 'error'); return; }
    const value = Number(ceiling);
    if (!Number.isInteger(value) || value < 0) { showToast('The prize ceiling must be a whole number of rupees.', 'error'); return; }
    setSaving(true);
    const [a, b] = await Promise.all([
      AdminAPI.saveSettings({ allowKnockout: !!settings.allowKnockout, allowRoundRobin: !!settings.allowRoundRobin, maxTeams }),
      value !== savedCeiling ? ReputationAPI.setCeiling(value) : Promise.resolve({ ok: true }),
    ]);
    setSaving(false);
    if (!a.ok || !b.ok) { showToast(a.error || b.error || 'Settings were not saved.', 'error'); return; }
    showToast('Platform settings saved. They apply to every new competition.');
    load();
  }

  return (
    <main className="main-content">
      <PageHeader title="Super Admin dashboard" subtitle="Live platform figures and the rules every organizer works within." />

      {statsError && <ErrorState message={statsError} onRetry={load} />}
      {!stats && !statsError && <LoadingState label="Loading statistics…" />}
      {stats && (
        <div className="ui-grid" style={{ marginBottom: 28 }}>
          <Stat label="Registered users" value={stats.totalUsers.toLocaleString('en-IN')} />
          <Stat label="Staff accounts" value={stats.adminUsers} />
          <Stat label="Banned accounts" value={stats.bannedUsers} />
          <Stat label="Published competitions" value={stats.totalCompetitions} />
          <Stat label="Running now" value={stats.activeCompetitions} />
          <Stat label="Registered teams" value={stats.totalTeams} />
          <Stat label="Open disputes" value={stats.openDisputes} />
          <Stat label="Total prize pools" value={formatINR(stats.totalPrizePool)} />
        </div>
      )}

      {settings && (
        <form className="ui-card" style={{ maxWidth: 720 }} onSubmit={saveSettings}>
          <h2 className="ui-card-title">Competition rules</h2>
          <Notice tone="info">These are checked by the server when a competition is created, so they apply to every organizer and browser.</Notice>
          <label className="ui-row" style={{ cursor: 'pointer', marginBottom: 10 }}>
            <input type="checkbox" checked={!!settings.allowKnockout} onChange={(e) => setSettings((s) => ({ ...s, allowKnockout: e.target.checked }))} />
            <div className="ui-row-main"><div className="ui-row-title">Single-elimination (knockout) competitions</div></div>
          </label>
          <label className="ui-row" style={{ cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={!!settings.allowRoundRobin} onChange={(e) => setSettings((s) => ({ ...s, allowRoundRobin: e.target.checked }))} />
            <div className="ui-row-main"><div className="ui-row-title">Round-robin (league) competitions</div></div>
          </label>
          <div className="ui-field">
            <label htmlFor="sa-max-teams">Maximum teams per competition</label>
            <input id="sa-max-teams" className="form-input" type="number" min={2} max={256} step={1} value={settings.maxTeams} onChange={(e) => setSettings((s) => ({ ...s, maxTeams: e.target.value }))} />
          </div>
          <div className="ui-field">
            <label htmlFor="sa-ceiling">Platform prize-pool ceiling (₹)</label>
            <input id="sa-ceiling" className="form-input" type="number" min={0} step={1} value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
            <span className="ui-field-help">No competition can exceed this, even with an approved exception.</span>
          </div>
          <div className="ui-dialog-actions">
            <Link className="btn-cancel" to="/pages/admin/revenue-config.html">Platform fee settings</Link>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </form>
      )}
    </main>
  );
}
