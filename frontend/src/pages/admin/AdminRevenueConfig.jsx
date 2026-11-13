/**
 * NEXUS ESPORTS — Platform fee settings
 *
 * The percentage of the prize pool (with a minimum) charged to organizers when
 * they publish. Saved on the server and applied to every new competition.
 */
import { useEffect, useState } from 'react';
import { AdminAPI, RevenueAPI } from '../../services/api.js';
import { calculatePlatformFee } from '../../services/competitions.js';
import { LoadingState, Notice, PageHeader, formatDate, formatINR } from '../../components/ui.jsx';
import { showToast } from '../../lib/toast.js';

export default function AdminRevenueConfig() {
  const [config, setConfig] = useState(null);
  const [percentage, setPercentage] = useState('');
  const [minCost, setMinCost] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await RevenueAPI.getConfig();
    if (!res.ok) { setError(res.error || 'Unable to load the configuration.'); return; }
    setConfig(res.data);
    setPercentage(String(res.data.percentage));
    setMinCost(String(res.data.minCost));
  }
  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const pct = Number(percentage);
    const cost = Number(minCost);
    if (!Number.isFinite(pct) || pct < 0 || pct >= 15) { setError('The percentage must be at least 0 and below 15.'); return; }
    if (!Number.isFinite(cost) || cost < 0 || cost >= 100) { setError('The minimum fee must be at least ₹0 and below ₹100.'); return; }
    setSaving(true);
    const res = await RevenueAPI.saveConfig({ percentage: pct, minCost: cost });
    setSaving(false);
    if (!res.ok) { setError(res.error || 'The configuration was not saved.'); return; }
    await AdminAPI.logActivity(null, 'REVENUE_CONFIG_CHANGE', `Platform fee changed from ${config.percentage}% (min ${formatINR(config.minCost)}) to ${pct}% (min ${formatINR(cost)}).`, {
      prevPercentage: config.percentage, newPercentage: pct, prevMinCost: config.minCost, newMinCost: cost,
    });
    showToast('Platform fee saved.');
    load();
  }

  if (!config && !error) return <main className="main-content"><LoadingState label="Loading configuration…" /></main>;
  const preview = { percentage: Number(percentage) || 0, minCost: Number(minCost) || 0 };

  return (
    <main className="main-content">
      <PageHeader title="Platform fee" subtitle="What organizers pay to publish a competition." />
      <form className="ui-card" style={{ maxWidth: 640 }} onSubmit={submit}>
        <div className="ui-field">
          <label htmlFor="fee-pct">Percentage of the prize pool (below 15%)</label>
          <input id="fee-pct" className="form-input" type="number" min={0} max={14.99} step="0.01" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
        </div>
        <div className="ui-field">
          <label htmlFor="fee-min">Minimum fee in ₹ (below ₹100)</label>
          <input id="fee-min" className="form-input" type="number" min={0} max={99.99} step="0.01" value={minCost} onChange={(e) => setMinCost(e.target.value)} />
        </div>
        <div className="ui-card" style={{ marginBottom: 16 }}>
          <div className="ui-row-meta" style={{ marginBottom: 6 }}>Examples with these values</div>
          {[0, 1000, 10000, 100000].map((prize) => (
            <div className="ui-kv" key={prize}><span className="k">Prize pool {formatINR(prize)}</span><span className="v">{formatINR(calculatePlatformFee(prize, preview))}</span></div>
          ))}
        </div>
        {config && <p className="ui-field-help">Last changed {formatDate(config.updatedAt, true)}{config.updatedBy ? ` by @${config.updatedBy}` : ''}.</p>}
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="ui-dialog-actions">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </main>
  );
}
