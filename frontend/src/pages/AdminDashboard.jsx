/**
 * NEXUS ESPORTS — Admin Dashboard
 *
 * stats, the tournament
 * directory with approval tabs + search, the approve/reject flow, and the
 * competition detail modal.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/admin/dashboard.css';

const normalize = (v) => String(v || '').trim().toLowerCase();

function formatPrizePool(prize) {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) return 'No Prize Pool';
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}
function getCompStatus(comp) {
  if (!comp) return 'upcoming';
  if (comp.ended || comp.status === 'completed') return 'completed';
  if (comp.status === 'ongoing' || comp.status === 'active') return 'active';
  return 'upcoming';
}
function statusBadge(status, comp) {
  const app = String((comp && comp.approvalStatus) || 'approved').toLowerCase();
  if (app === 'pending') return <span className="status-pill" style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid #fb923c' }}>⏳ Pending Admin Approval</span>;
  if (app === 'rejected') return <span className="status-pill" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444' }}>✖ Rejected</span>;
  if (status === 'active') return <span className="status-pill ongoing">Active &amp; Live</span>;
  if (status === 'completed') return <span className="status-pill completed">Completed</span>;
  return <span className="status-pill upcoming">Upcoming</span>;
}
const prizeAmount = (c) => c.prize || (c.prizePool ? parseInt(String(c.prizePool).replace(/[^0-9]/g, ''), 10) || 0 : 0);
const feeFor = (c) => (typeof c.platformFee === 'number' ? c.platformFee : (NexusData ? NexusData.calculatePlatformFee(prizeAmount(c)) : 0));

export default function AdminDashboard() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const f = normalize(params.get('filter'));
    if (['active', 'upcoming', 'completed', 'pending'].includes(f)) setFilter(f);
  }, [params]);

  useEffect(() => {
    if (!NexusData || !NexusData.fetchCompetitionsFromAPI) return;
    let alive = true;
    Promise.race([NexusData.fetchCompetitionsFromAPI(), new Promise((r) => setTimeout(r, 2000))])
      .then(() => { if (alive) setVersion((v) => v + 1); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const comps = useMemo(
    () => (NexusData ? NexusData.loadCompetitions().filter((c) => normalize(c.role) === 'organizer' || !!c.createdBy || !!c.organizerId) : []),
    [version],
  );

  const stats = useMemo(() => {
    const total = comps.length;
    const active = comps.filter((c) => getCompStatus(c) === 'active').length;
    const upcoming = comps.filter((c) => getCompStatus(c) === 'upcoming').length;
    const completed = comps.filter((c) => getCompStatus(c) === 'completed').length;
    const pending = comps.filter((c) => (c.approvalStatus || '').toLowerCase() === 'pending').length;
    const fees = comps.reduce((sum, c) => sum + feeFor(c), 0);
    return { total, active, upcoming, completed, pending, fees };
  }, [comps]);

  const filtered = comps.filter((comp) => {
    const status = getCompStatus(comp);
    const app = String(comp.approvalStatus || 'approved').toLowerCase();
    if (filter === 'pending' && app !== 'pending') return false;
    if (filter !== 'all' && filter !== 'pending' && status !== filter) return false;
    if (!search) return true;
    const organizersStr = Array.isArray(comp.organizers) ? comp.organizers.join(' ') : '';
    return [comp.name, comp.game, comp.location, comp.description, comp.createdBy || comp.organizerId, organizersStr].map(normalize).join(' ').includes(search);
  });

  function approve(compId, decision) {
    const adminUname = (session && session.username) || 'admin';
    const result = NexusData.setCompetitionApproval(compId, decision, adminUname);
    if (result && result.ok) {
      showToast(decision === 'approved' ? `Tournament "${result.competition.name}" has been APPROVED & published!` : `Tournament "${result.competition.name}" has been REJECTED.`, decision === 'approved' ? 'success' : 'error');
      setVersion((v) => v + 1);
      setSelectedId(null);
    } else {
      showToast((result && result.error) || 'Failed to update status.', 'error');
    }
  }

  const selected = selectedId && NexusData ? NexusData.getCompetitionById(selectedId) : null;

  return (
    <main className="admin-page">
      <div className="admin-header-block">
        <h1 className="admin-title-xl">Admin Dashboard</h1>
        <p className="admin-subtitle-muted">Manage tournaments and administrative tasks.</p>
      </div>

      <div className="dash-stats">
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-wrap">🏆</div><div><div className="dash-stat-num" id="stat-total">{stats.total}</div><div className="dash-stat-lbl">Total Tournaments</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#fb923c', background: 'rgba(251,146,60,0.15)' }}>💰</div><div><div className="dash-stat-num" id="stat-platform-fees" style={{ color: '#fb923c' }}>₹{stats.fees.toLocaleString('en-IN')}</div><div className="dash-stat-lbl">Platform Fees Collected</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.15)' }}>⏳</div><div><div className="dash-stat-num" id="stat-pending" style={{ color: '#f59e0b' }}>{stats.pending}</div><div className="dash-stat-lbl">Pending Approval</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-success">⚡</div><div><div className="dash-stat-num" id="stat-active">{stats.active}</div><div className="dash-stat-lbl">Active &amp; Live</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-info">📅</div><div><div className="dash-stat-num" id="stat-upcoming">{stats.upcoming}</div><div className="dash-stat-lbl">Upcoming</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn">🏁</div><div><div className="dash-stat-num" id="stat-completed">{stats.completed}</div><div className="dash-stat-lbl">Completed</div></div></div>
      </div>

      <div className="tournaments-section">
        <div className="tournaments-section-header">
          <h2 className="table-title-md">Tournament Directory &amp; Oversight</h2>
          <div className="search-bar table-search-wrap">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
            <input type="text" placeholder="Search tournaments by name, game, or organizer..." value={search} onChange={(e) => setSearch(normalize(e.target.value))} />
          </div>
        </div>

        <div className="approval-tabs" id="approval-tabs">
          {[['all', 'All'], ['pending', '⏳ Pending Approval'], ['active', 'Active / Live'], ['upcoming', 'Upcoming'], ['completed', 'Completed']].map(([k, l]) => (
            <button key={k} className={`approval-tab ${filter === k ? 'active' : ''}`} data-filter={k} onClick={() => setFilter(k)} style={k === 'pending' ? { color: '#fb923c' } : undefined}>{l}</button>
          ))}
        </div>

        <div className="tournament-cards-grid" id="tournament-cards">
          {filtered.length === 0 && <p className="act-empty" id="admin-empty" style={{ gridColumn: '1/-1' }}>No tournaments in this view.</p>}
          {filtered.map((comp) => {
            const status = getCompStatus(comp);
            const app = String(comp.approvalStatus || 'approved').toLowerCase();
            const orgList = Array.isArray(comp.organizers) && comp.organizers.length > 0 ? comp.organizers.join(', ') : (comp.createdBy || comp.organizerId || 'System');
            return (
              <div className="t-card" key={comp.id} data-search={`${normalize(comp.name)} ${normalize(comp.game)} ${normalize(comp.location)}`}>
                <div className="t-card-header">
                  <div className="t-card-title-row">
                    <h3 className="t-card-name">{comp.name || 'Competition'}</h3>
                    {statusBadge(status, comp)}
                  </div>
                  <div className="t-card-game">{comp.game || 'Unknown Game'}</div>
                </div>
                <div className="t-card-meta">
                  <div className="t-meta-item"><span>👥 Organizers: <strong>{orgList}</strong></span></div>
                  <div className="t-meta-item"><span>📅 {comp.dates || 'TBD'}</span></div>
                  <div className="t-meta-item"><span>📍 {comp.location || 'Online'}</span></div>
                  <div className="t-meta-item"><span>🛡️ {comp.participants || (comp.teams ? comp.teams.length : 0)} teams</span></div>
                  <div className="t-meta-item t-meta-prize"><span className="prize-text">{formatPrizePool(comp.prizePool)}</span></div>
                </div>
                <div className="t-card-actions">
                  {app === 'pending' ? (
                    <>
                      <button className="btn-table-primary" onClick={() => approve(comp.id, 'approved')} style={{ background: '#22c55e', border: 'none', color: '#fff', fontWeight: 700 }}>✔ Approve</button>
                      <button className="btn-table-secondary" onClick={() => approve(comp.id, 'rejected')} style={{ borderColor: '#ef4444', color: '#ef4444', fontWeight: 700 }}>✖ Reject</button>
                      <button className="btn-table-secondary" onClick={() => setSelectedId(comp.id)}>Details</button>
                    </>
                  ) : (
                    <>
                      <Link className="btn-table-primary t-btn-manage" to={`/pages/admin/competition-detail.html?id=${comp.id}`}>Overview</Link>
                      <button className="btn-table-secondary" onClick={() => setSelectedId(comp.id)}>Details</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div id="comp-detail-modal" className="admin-modal-overlay" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
          <div className="admin-modal-box">
            <button className="admin-modal-close" onClick={() => setSelectedId(null)}>×</button>
            <h3 id="admin-modal-title" className="table-title-md" style={{ fontSize: 20 }}>{selected.name || 'Competition Details'}</h3>
            <div id="admin-modal-body" className="admin-modal-content">
              <div className="admin-detail-grid">
                <p><strong>Game:</strong> {selected.game || '—'}</p>
                <p><strong>Primary Creator:</strong> {selected.createdBy || selected.organizerId || '—'}</p>
                <p><strong>All Organizers:</strong> {Array.isArray(selected.organizers) && selected.organizers.length > 0 ? selected.organizers.join(', ') : (selected.createdBy || selected.organizerId || '—')}</p>
                <p><strong>Type:</strong> {selected.type || '—'}</p>
                <p><strong>Format:</strong> {selected.format || '—'}</p>
                <p><strong>Dates:</strong> {selected.dates || '—'}</p>
                <p><strong>Registration Open:</strong> {(selected.registrationDates && selected.registrationDates.open) || '—'}</p>
                <p><strong>Registration Close:</strong> {(selected.registrationDates && selected.registrationDates.close) || '—'}</p>
                <p><strong>Entry Fee Model:</strong> {selected.entryFee || 'Free'}</p>
                <p><strong>Max Teams:</strong> {selected.maxTeams || '—'}</p>
                <p><strong>Prize Pool:</strong> {formatPrizePool(selected.prizePool)}</p>
                <p><strong>Platform Fee (Revenue):</strong> <span style={{ color: '#fb923c', fontWeight: 700 }}>₹{feeFor(selected).toLocaleString('en-IN')}</span></p>
                <p><strong>Location:</strong> {selected.location || 'Online'}</p>
                <p><strong>Approval Status:</strong> {String(selected.approvalStatus || 'approved').toLowerCase() === 'pending'
                  ? <span style={{ color: '#fb923c', fontWeight: 700 }}>⏳ Pending Admin Approval (&gt;₹50k Prize Pool)</span>
                  : (String(selected.approvalStatus || '').toLowerCase() === 'rejected'
                    ? <span style={{ color: '#ef4444', fontWeight: 700 }}>✖ Rejected</span>
                    : <span style={{ color: '#c6ff33', fontWeight: 700 }}>Active &amp; Live</span>)}</p>
              </div>
              <div className="admin-detail-desc"><strong>Description:</strong><br />{selected.description || 'No description provided.'}</div>
              {String(selected.approvalStatus || '').toLowerCase() === 'pending' && (
                <div style={{ marginTop: 20, display: 'flex', gap: 12, borderTop: '1px solid #1e293b', paddingTop: 16 }}>
                  <button onClick={() => approve(selected.id, 'approved')} style={{ flex: 1, padding: 12, background: '#22c55e', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>✔ Approve Tournament</button>
                  <button onClick={() => approve(selected.id, 'rejected')} style={{ flex: 1, padding: 12, background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>✖ Reject Tournament</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


