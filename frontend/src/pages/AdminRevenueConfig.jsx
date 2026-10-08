/**
 * NEXUS ESPORTS — Admin Revenue Configuration
 *
 * the platform fee % and
 * min hosting cost form with the admin bounds (<15% and <₹100), the current-config
 * summary, revenue-config save, and the admin activity log entry.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/create-competition.css';
import '../styles/pages/admin/dashboard.css';

export default function AdminRevenueConfig() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const initial = (NexusData && NexusData.getRevenueConfig) ? NexusData.getRevenueConfig() : { percentage: 7, minCost: 50 };
  const [percentage, setPercentage] = useState(String(initial.percentage));
  const [minCost, setMinCost] = useState(String(initial.minCost));
  const [error, setError] = useState('');
  const [config, setConfig] = useState(initial);

  function submit(e) {
    e.preventDefault();
    setError('');
    const pct = parseFloat(percentage);
    const cost = parseFloat(minCost);

    if (Number.isNaN(pct) || pct < 0) { setError('⚠️ Please enter a valid positive percentage.'); return; }
    if (pct >= 15) { setError('⚠️ Percentage from Prize Pool must be strictly less than 15% (< 15%).'); return; }
    if (Number.isNaN(cost) || cost < 0) { setError('⚠️ Please enter a valid positive minimum cost.'); return; }
    if (cost >= 100) { setError('⚠️ Minimum Cost to host a Competition must be strictly less than 100 (< 100).'); return; }

    const prevConfig = (NexusData && NexusData.getRevenueConfig) ? NexusData.getRevenueConfig() : { percentage: 7, minCost: 50 };

    if (NexusData && typeof NexusData.saveRevenueConfig === 'function') {
      const res = NexusData.saveRevenueConfig({ percentage: pct, minCost: cost });
      if (!res.ok) { setError(`⚠️ ${res.error || 'Failed to save revenue configuration.'}`); return; }
    }

    try {
      const adminName = (session && (session.username || session.email)) || 'admin@nexus.gg';
      const details = `Changed Revenue Configuration: Prize Pool Fee (${prevConfig.percentage}% → ${pct}%), Minimum Cost to Host (₹${prevConfig.minCost} → ₹${cost})`;
      if (NexusData && typeof NexusData.logAdminActivity === 'function') {
        NexusData.logAdminActivity(adminName, 'REVENUE_CONFIG_CHANGE', details, { prevPercentage: prevConfig.percentage, newPercentage: pct, prevMinCost: prevConfig.minCost, newMinCost: cost });
      }
    } catch (e) {
      console.error('Error logging revenue config activity:', e);
    }

    const refreshed = (NexusData && NexusData.getRevenueConfig) ? NexusData.getRevenueConfig() : { percentage: pct, minCost: cost };
    setConfig(refreshed);
    showToast('Revenue configuration updated successfully!', 'success');
    setTimeout(() => navigate('/pages/admin/revenue-transactions.html'), 500);
  }

  return (
    <main className="create-comp-page">
      <Link to="/pages/admin/revenue-transactions.html" className="back-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Revenue Transactions
      </Link>

      <h1 className="page-title">Change Revenue Configuration</h1>
      <p className="page-subtitle">Configure global platform fee percentage rates and minimum tournament hosting cost.</p>

      <div style={{ background: 'rgba(198,255,51,0.08)', border: '1px solid rgba(198,255,51,0.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 26 }}>🛡️</span>
        <div>
          <h4 style={{ margin: '0 0 2px', color: '#c6ff33', fontSize: 15, fontWeight: 700 }}>Admin Privileged Configuration Control</h4>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Only Admin users can modify these global platform revenue thresholds. Changes will immediately take effect for all tournament creation logic.</p>
        </div>
      </div>

      <div className="create-layout">
        <div className="form-card">
          <form id="revenue-config-form" noValidate onSubmit={submit}>
            <div className="form-section-title">Platform Revenue Parameters</div>

            <div className="form-group">
              <label className="form-label" htmlFor="prize-percentage">Percentage from Prize Pool (%) <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-input" type="number" id="prize-percentage" step="0.1" min="0" max="14.99" placeholder="e.g. 7" required value={percentage} onChange={(e) => setPercentage(e.target.value)} />
              <div style={{ fontSize: 12, color: '#fb923c', fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠️ Admin Restriction:</span> Must be strictly less than 15% (&lt; 15%)
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 24 }}>
              <label className="form-label" htmlFor="min-cost">Minimum Cost to host a Competition (₹) <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-input" type="number" id="min-cost" step="1" min="0" max="99.99" placeholder="e.g. 50" required value={minCost} onChange={(e) => setMinCost(e.target.value)} />
              <div style={{ fontSize: 12, color: '#fb923c', fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠️ Admin Restriction:</span> Must be strictly less than ₹100 (&lt; 100) (Default: 50)
              </div>
            </div>

            {error && <div id="config-error-msg" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginTop: 20, fontWeight: 600 }}>{error}</div>}

            <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="btn-submit" style={{ flex: 1 }}>Save Revenue Configuration</button>
              <Link to="/pages/admin/revenue-transactions.html" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '14px 28px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Cancel</Link>
            </div>
          </form>
        </div>

        <div className="summary-card">
          <h3>Current Configuration</h3>
          <div className="summary-row"><span className="k">Prize Pool Percentage</span><span className="v" id="curr-percentage" style={{ color: '#c6ff33', fontWeight: 800 }}>{config.percentage}%</span></div>
          <div className="summary-row"><span className="k">Min Hosting Cost</span><span className="v" id="curr-min-cost" style={{ color: '#fb923c', fontWeight: 800 }}>₹{config.minCost}</span></div>
          <div className="summary-row"><span className="k">Access Scope</span><span className="v" style={{ color: '#60a5fa', fontWeight: 700 }}>Admin Only</span></div>
          <div className="summary-row"><span className="k">Last Modified</span><span className="v" id="curr-last-modified" style={{ fontSize: 11 }}>{config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'Default Settings'}</span></div>

          <div style={{ marginTop: 24 }}>
            <h3>Enforcement Rules</h3>
            <div className="steps-list">
              <div className="step-item"><div className="step-num done">✓</div><span className="step-text">Calculates higher of Min Cost or Prize Pool %</span></div>
              <div className="step-item"><div className="step-num done">✓</div><span className="step-text">Updates competition creation platform fees live</span></div>
              <div className="step-item"><div className="step-num done">✓</div><span className="step-text">Enforces Admin-only restriction bounds (&lt;15% &amp; &lt;₹100)</span></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


