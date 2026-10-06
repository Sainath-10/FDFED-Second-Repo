import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/create-competition.css';
import '../../styles/pages/admin/dashboard.css';

export default function AdminRevenueConfigPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(NexusAuth.getSession());
  
  const [percentage, setPercentage] = useState(7);
  const [minCost, setMinCost] = useState(50);
  const [currentConfig, setCurrentConfig] = useState({ percentage: 7, minCost: 50, updatedAt: null });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const sess = NexusAuth.getSession();
    const role = String(sess?.role || sess?.adminType || '').toLowerCase();
    const allowed = ['admin', 'comp_admin', 'dispute_admin', 'revenue_admin', 'super_admin', 'super-admin'];
    if (!sess || !allowed.includes(role)) {
      alert('Access Denied: Only Admin can access Revenue Configuration.');
      navigate('/admin/revenue-transactions');
      return;
    }
    setSession(sess);

    const config = NexusData.getRevenueConfig ? NexusData.getRevenueConfig() : { percentage: 7, minCost: 50 };
    setPercentage(config.percentage);
    setMinCost(config.minCost);
    setCurrentConfig(config);
  }, []);

  const role = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = role.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';

  function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    const percNum = parseFloat(percentage);
    const costNum = parseFloat(minCost);

    if (isNaN(percNum) || percNum < 0) {
      setErrorMsg('Please enter a valid positive percentage.');
      return;
    }
    if (percNum >= 15) {
      setErrorMsg('Percentage from Prize Pool must be strictly less than 15% (< 15%).');
      return;
    }

    if (isNaN(costNum) || costNum < 0) {
      setErrorMsg('Please enter a valid positive minimum cost.');
      return;
    }
    if (costNum >= 100) {
      setErrorMsg('Minimum Cost to host a Competition must be strictly less than 100 (< 100).');
      return;
    }

    const prevConfig = NexusData.getRevenueConfig ? NexusData.getRevenueConfig() : { percentage: 7, minCost: 50 };

    if (NexusData && typeof NexusData.saveRevenueConfig === 'function') {
      const res = NexusData.saveRevenueConfig({ percentage: percNum, minCost: costNum });
      if (res && !res.ok) {
        setErrorMsg(res.error || 'Failed to save revenue configuration.');
        return;
      }
    }

    try {
      const adminName = session?.username || session?.email || 'admin@nexus.gg';
      const details = `Changed Revenue Configuration: Prize Pool Fee (${prevConfig.percentage}% → ${percNum}%), Minimum Cost to Host (₹${prevConfig.minCost} → ₹${costNum})`;
      if (NexusData && typeof NexusData.logAdminActivity === 'function') {
        NexusData.logAdminActivity(adminName, 'REVENUE_CONFIG_CHANGE', details, {
          prevPercentage: prevConfig.percentage,
          newPercentage: percNum,
          prevMinCost: prevConfig.minCost,
          newMinCost: costNum
        });
      }
    } catch (e) {}

    alert('Revenue configuration updated successfully!');
    navigate('/admin/revenue-transactions');
  }

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="revenue">
      <main className="create-comp-page">
        <Link to="/admin/revenue-transactions" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4" />
          </svg>
          Back to Revenue Transactions
        </Link>

        <h1 className="page-title">Change Revenue Configuration</h1>
        <p className="page-subtitle">Configure global platform fee percentage rates and minimum tournament hosting cost.</p>

        {/* Security Banner for Admin */}
        <div style={{ background: 'rgba(198,255,51,0.08)', border: '1px solid rgba(198,255,51,0.3)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '26px' }}>🛡️</span>
          <div>
            <h4 style={{ margin: '0 0 2px', color: '#c6ff33', fontSize: '15px', fontWeight: 700 }}>Admin Privileged Configuration Control</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
              Only Admin users can modify these global platform revenue thresholds. Changes will immediately take effect for all tournament creation logic.
            </p>
          </div>
        </div>

        <div className="create-layout">
          {/* Form Card */}
          <div className="form-card">
            <form id="revenue-config-form" onSubmit={handleSubmit} noValidate>
              <div className="form-section-title">Platform Revenue Parameters</div>

              {/* Field 1: Percentage from Prize Pool */}
              <div className="form-group">
                <label className="form-label" htmlFor="prize-percentage">
                  Percentage from Prize Pool (%) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className="form-input"
                  type="number"
                  id="prize-percentage"
                  step="0.1"
                  min="0"
                  max="14.99"
                  placeholder="e.g. 7"
                  value={percentage}
                  onChange={e => setPercentage(e.target.value)}
                  required
                />
                <div style={{ fontSize: '12px', color: '#fb923c', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️ Admin Restriction:</span> Must be strictly less than 15% (&lt; 15%)
                </div>
              </div>

              {/* Field 2: Minimum Cost to host a Competition */}
              <div className="form-group" style={{ marginTop: '24px' }}>
                <label className="form-label" htmlFor="min-cost">
                  Minimum Cost to host a Competition (₹) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className="form-input"
                  type="number"
                  id="min-cost"
                  step="1"
                  min="0"
                  max="99.99"
                  placeholder="e.g. 50"
                  value={minCost}
                  onChange={e => setMinCost(e.target.value)}
                  required
                />
                <div style={{ fontSize: '12px', color: '#fb923c', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️ Admin Restriction:</span> Must be strictly less than ₹100 (&lt; 100) (Default: 50)
                </div>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', marginTop: '20px', fontWeight: 600 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button type="submit" className="btn-submit" style={{ flex: 1 }}>Save Revenue Configuration</button>
                <Link
                  to="/admin/revenue-transactions"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '14px 28px',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>

          {/* Summary Sidebar */}
          <div className="summary-card">
            <h3>Current Configuration</h3>

            <div className="summary-row">
              <span className="k">Prize Pool Percentage</span>
              <span className="v" style={{ color: '#c6ff33', fontWeight: 800 }}>{currentConfig.percentage}%</span>
            </div>
            <div className="summary-row">
              <span className="k">Min Hosting Cost</span>
              <span className="v" style={{ color: '#fb923c', fontWeight: 800 }}>₹{currentConfig.minCost}</span>
            </div>
            <div className="summary-row">
              <span className="k">Access Scope</span>
              <span className="v" style={{ color: '#60a5fa', fontWeight: 700 }}>Admin Only</span>
            </div>
            <div className="summary-row">
              <span className="k">Last Modified</span>
              <span className="v" style={{ fontSize: '11px' }}>
                {currentConfig.updatedAt ? new Date(currentConfig.updatedAt).toLocaleString() : 'Default Settings'}
              </span>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3>Enforcement Rules</h3>
              <div className="steps-list">
                <div className="step-item">
                  <div className="step-num done">✓</div>
                  <span className="step-text">Calculates higher of Min Cost or Prize Pool %</span>
                </div>
                <div className="step-item">
                  <div className="step-num done">✓</div>
                  <span className="step-text">Updates competition creation platform fees live</span>
                </div>
                <div className="step-item">
                  <div className="step-num done">✓</div>
                  <span className="step-text">Enforces Admin-only restriction bounds (&lt;15% &amp; &lt;₹100)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
