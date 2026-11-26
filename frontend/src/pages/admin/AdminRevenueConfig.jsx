/**
 * NEXUS ESPORTS — Platform fee settings
 *
 * The percentage of the prize pool (with a minimum) charged to organizers when
 * they publish. Saved on the server and applied to every new competition.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRevenueConfig, saveRevenueConfig } from '../../store/platformSlice.js';
import { calculatePlatformFee } from '../../services/competitions.js';
import { LoadingState, Notice, PageHeader, formatDate, formatINR } from '../../components/ui.jsx';
import { showToast } from '../../lib/toast.js';

export default function AdminRevenueConfig() {
  const dispatch = useDispatch();
  // The saved configuration lives in the platform slice (shared with Create competition).
  const loaded = useSelector((state) => state.platform.revenueLoaded);
  const config = useSelector((state) => (state.platform.revenueLoaded ? state.platform.revenueConfig : null));
  const loadError = useSelector((state) => state.platform.revenueError);
  // The form fields stay local React state: they are only "drafts" until saved.
  const [percentage, setPercentage] = useState('');
  const [minCost, setMinCost] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const error = formError || (!config ? loadError : '');

  // Always fetch fresh on this page (force skips the "already loaded" check).
  useEffect(() => { dispatch(fetchRevenueConfig({ force: true })); }, [dispatch]);
  // Whenever the stored config changes (loaded or saved), show it in the form.
  useEffect(() => {
    if (!config) return;
    setPercentage(String(config.percentage));
    setMinCost(String(config.minCost));
  }, [config]);

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    const pct = Number(percentage);
    const cost = Number(minCost);
    if (!Number.isFinite(pct) || pct < 0 || pct >= 15) { setFormError('The percentage must be at least 0 and below 15.'); return; }
    if (!Number.isFinite(cost) || cost < 0 || cost >= 100) { setFormError('The minimum fee must be at least ₹0 and below ₹100.'); return; }
    setSaving(true);
    try {
      // The thunk saves, logs the change and updates the store.
      await dispatch(saveRevenueConfig({ percentage: pct, minCost: cost })).unwrap();
    } catch (err) {
      setFormError((typeof err === 'string' ? err : err?.message) || 'The configuration was not saved.');
      return;
    } finally {
      setSaving(false);
    }
    showToast('Platform fee saved.');
    dispatch(fetchRevenueConfig({ force: true })); // picks up "last changed" from the server
  }

  if (!loaded && !error) return <main className="main-content"><LoadingState label="Loading configuration…" /></main>;
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
