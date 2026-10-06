import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import { NexusData } from '../../services/competitionService';
import { useToast } from '../../components/Common/Toast';
import '../../styles/pages/admin/dashboard.css';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function formatPrizePool(prize) {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) {
    return 'No Prize Pool';
  }
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

function getCompStatus(comp) {
  if (!comp) return 'upcoming';
  if (comp.ended || comp.status === 'completed') return 'completed';
  if (comp.status === 'ongoing' || comp.status === 'active') return 'active';
  return 'upcoming';
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [activeCompFilter, setActiveCompFilter] = useState('all');
  const [activeSearch, setActiveSearch] = useState('');
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompModal, setSelectedCompModal] = useState(null);

  const loadData = () => {
    if (!NexusData || !NexusData.loadCompetitions) return;
    const comps = NexusData.loadCompetitions().filter(comp => {
      return normalize(comp.role) === 'organizer' || !!comp.createdBy || !!comp.organizerId;
    });
    setCompetitions(comps);
  };

  useEffect(() => {
    const filter = normalize(searchParams.get('filter'));
    if (['active', 'upcoming', 'completed', 'pending'].includes(filter)) {
      setActiveCompFilter(filter);
    }
    loadData();

    if (NexusData && typeof NexusData.fetchCompetitionsFromAPI === 'function') {
      Promise.race([
        NexusData.fetchCompetitionsFromAPI(),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]).then(() => loadData()).catch(() => {});
    }
  }, [searchParams]);

  // Statistics calculation
  const total = competitions.length;
  const activeCount = competitions.filter(c => getCompStatus(c) === 'active').length;
  const upcomingCount = competitions.filter(c => getCompStatus(c) === 'upcoming').length;
  const completedCount = competitions.filter(c => getCompStatus(c) === 'completed').length;
  const pendingCount = competitions.filter(c => (c.approvalStatus || '').toLowerCase() === 'pending').length;

  let totalFees = 0;
  competitions.forEach(c => {
    if (typeof c.platformFee === 'number') {
      totalFees += c.platformFee;
    } else {
      const prizeAmt = c.prize || (c.prizePool ? parseInt(String(c.prizePool).replace(/[^0-9]/g, '')) || 0 : 0);
      if (prizeAmt > 0 && NexusData && typeof NexusData.calculatePlatformFee === 'function') {
        totalFees += NexusData.calculatePlatformFee(prizeAmt);
      }
    }
  });

  const handleApprove = (compId, decision) => {
    const sessionRaw = localStorage.getItem('nexus.auth.session');
    let adminUname = 'admin';
    try {
      const s = JSON.parse(sessionRaw);
      adminUname = s?.username || 'admin';
    } catch (e) {}

    const result = NexusData.setCompetitionApproval(compId, decision, adminUname);
    if (result && result.ok) {
      showToast(
        decision === 'approved'
          ? `Tournament "${result.competition.name}" has been APPROVED & published!`
          : `Tournament "${result.competition.name}" has been REJECTED.`,
        decision === 'approved' ? 'success' : 'error'
      );
      loadData();
      setSelectedCompModal(null);
    } else {
      showToast(result?.error || 'Failed to update status.', 'error');
    }
  };

  const filteredCompetitions = competitions.filter(comp => {
    const status = getCompStatus(comp);
    const appStatus = String((comp && comp.approvalStatus) || 'approved').toLowerCase();

    if (activeCompFilter === 'pending' && appStatus !== 'pending') return false;
    if (activeCompFilter !== 'all' && activeCompFilter !== 'pending' && status !== activeCompFilter) return false;
    if (!activeSearch) return true;

    const organizersStr = Array.isArray(comp.organizers) ? comp.organizers.join(' ') : '';
    const haystack = [
      comp.name,
      comp.game,
      comp.location,
      comp.description,
      (comp.createdBy || comp.organizerId),
      organizersStr
    ].map(v => normalize(v)).join(' ');

    return haystack.includes(normalize(activeSearch));
  });

  const renderStatusBadge = (status, comp) => {
    const appStatus = String((comp && comp.approvalStatus) || 'approved').toLowerCase();
    if (appStatus === 'pending') {
      return <span className="status-pill" style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid #fb923c' }}>⏳ Pending Admin Approval</span>;
    }
    if (appStatus === 'rejected') {
      return <span className="status-pill" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444' }}>✖ Rejected</span>;
    }
    if (status === 'active') return <span className="status-pill ongoing">Active &amp; Live</span>;
    if (status === 'upcoming') return <span className="status-pill upcoming">Upcoming</span>;
    if (status === 'completed') return <span className="status-pill completed">Completed</span>;
    return <span className="status-pill ongoing">Active</span>;
  };

  return (
    <Shell sidebarVariant="admin" activePage="home">
      <main className="admin-page">
        <div className="admin-header-block">
          <h1 className="admin-title-xl">Admin Dashboard</h1>
          <p className="admin-subtitle-muted">Manage tournaments and administrative tasks.</p>
        </div>

        <div className="dash-stats">
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-wrap">🏆</div>
            <div>
              <div className="dash-stat-num" id="stat-total">{total}</div>
              <div className="dash-stat-lbl">Total Tournaments</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#fb923c', background: 'rgba(251,146,60,0.15)' }}>💰</div>
            <div>
              <div className="dash-stat-num" id="stat-platform-fees" style={{ color: '#fb923c' }}>
                ₹{totalFees.toLocaleString('en-IN')}
              </div>
              <div className="dash-stat-lbl">Platform Fees Collected</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.15)' }}>⏳</div>
            <div>
              <div className="dash-stat-num" id="stat-pending" style={{ color: '#f59e0b' }}>{pendingCount}</div>
              <div className="dash-stat-lbl">Pending Approval</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-success">⚡</div>
            <div>
              <div className="dash-stat-num" id="stat-active">{activeCount}</div>
              <div className="dash-stat-lbl">Active &amp; Live</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-info">📅</div>
            <div>
              <div className="dash-stat-num" id="stat-upcoming">{upcomingCount}</div>
              <div className="dash-stat-lbl">Upcoming</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon-warn">🏁</div>
            <div>
              <div className="dash-stat-num" id="stat-completed">{completedCount}</div>
              <div className="dash-stat-lbl">Completed</div>
            </div>
          </div>
        </div>

        {/* All Tournaments as Cards */}
        <div className="tournaments-section">
          <div className="tournaments-section-header">
            <h2 className="table-title-md">Tournament Directory &amp; Oversight</h2>
            <div className="search-bar table-search-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" />
              </svg>
              <input
                type="text"
                placeholder="Search tournaments by name, game, or organizer..."
                value={activeSearch}
                onChange={(e) => setActiveSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="approval-tabs" id="approval-tabs">
            <button
              type="button"
              className={`approval-tab ${activeCompFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCompFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`approval-tab ${activeCompFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveCompFilter('pending')}
              style={{ color: '#fb923c' }}
            >
              ⏳ Pending Approval
            </button>
            <button
              type="button"
              className={`approval-tab ${activeCompFilter === 'active' ? 'active' : ''}`}
              onClick={() => setActiveCompFilter('active')}
            >
              Active / Live
            </button>
            <button
              type="button"
              className={`approval-tab ${activeCompFilter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveCompFilter('upcoming')}
            >
              Upcoming
            </button>
            <button
              type="button"
              className={`approval-tab ${activeCompFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveCompFilter('completed')}
            >
              Completed
            </button>
          </div>

          <div className="tournament-cards-grid" id="tournament-cards">
            {filteredCompetitions.length === 0 ? (
              <p className="act-empty" id="admin-empty" style={{ gridColumn: '1/-1' }}>
                No tournaments in this view.
              </p>
            ) : (
              filteredCompetitions.map(comp => {
                const status = getCompStatus(comp);
                const appStatus = String((comp && comp.approvalStatus) || 'approved').toLowerCase();
                const orgList = Array.isArray(comp.organizers) && comp.organizers.length > 0
                  ? comp.organizers.join(', ')
                  : (comp.createdBy || comp.organizerId || 'System');

                return (
                  <div key={comp.id} className="t-card">
                    <div className="t-card-header">
                      <div className="t-card-title-row">
                        <h3 className="t-card-name">{comp.name || 'Competition'}</h3>
                        {renderStatusBadge(status, comp)}
                      </div>
                      <div className="t-card-game">{comp.game || 'Unknown Game'}</div>
                    </div>
                    <div className="t-card-meta">
                      <div className="t-meta-item">
                        <span>👥 Organizers: <strong>{orgList}</strong></span>
                      </div>
                      <div className="t-meta-item">
                        <span>📅 {comp.dates || 'TBD'}</span>
                      </div>
                      <div className="t-meta-item">
                        <span>📍 {comp.location || 'Online'}</span>
                      </div>
                      <div className="t-meta-item">
                        <span>🛡️ {comp.participants || (comp.teams ? comp.teams.length : 0)} teams</span>
                      </div>
                      <div className="t-meta-item t-meta-prize">
                        <span className="prize-text">{formatPrizePool(comp.prizePool)}</span>
                      </div>
                    </div>
                    <div className="t-card-actions">
                      {appStatus === 'pending' ? (
                        <>
                          <button
                            type="button"
                            className="btn-table-primary"
                            onClick={() => handleApprove(comp.id, 'approved')}
                            style={{ background: '#22c55e', border: 'none', color: '#fff', fontWeight: 700 }}
                          >
                            ✔ Approve
                          </button>
                          <button
                            type="button"
                            className="btn-table-secondary"
                            onClick={() => handleApprove(comp.id, 'rejected')}
                            style={{ borderColor: '#ef4444', color: '#ef4444', fontWeight: 700 }}
                          >
                            ✖ Reject
                          </button>
                          <button
                            type="button"
                            className="btn-table-secondary"
                            onClick={() => setSelectedCompModal(comp)}
                          >
                            Details
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            to={`/admin/competition-detail?id=${comp.id}`}
                            className="btn-table-primary t-btn-manage"
                          >
                            Overview
                          </Link>
                          <button
                            type="button"
                            className="btn-table-secondary"
                            onClick={() => setSelectedCompModal(comp)}
                          >
                            Details
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Comp Details Modal */}
        {selectedCompModal && (
          <div
            id="comp-detail-modal"
            className="admin-modal-overlay"
            style={{ display: 'flex' }}
            onClick={(e) => e.target.id === 'comp-detail-modal' && setSelectedCompModal(null)}
          >
            <div className="admin-modal-box">
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedCompModal(null)}
              >
                ×
              </button>
              <h3 id="admin-modal-title" className="table-title-md" style={{ fontSize: '20px' }}>
                {selectedCompModal.name || 'Competition Details'}
              </h3>
              <div id="admin-modal-body" className="admin-modal-content">
                <div className="admin-detail-grid">
                  <p><strong>Game:</strong> {selectedCompModal.game || '—'}</p>
                  <p><strong>Primary Creator:</strong> {selectedCompModal.createdBy || selectedCompModal.organizerId || '—'}</p>
                  <p><strong>All Organizers:</strong> {Array.isArray(selectedCompModal.organizers) ? selectedCompModal.organizers.join(', ') : '—'}</p>
                  <p><strong>Type:</strong> {selectedCompModal.type || '—'}</p>
                  <p><strong>Format:</strong> {selectedCompModal.format || '—'}</p>
                  <p><strong>Dates:</strong> {selectedCompModal.dates || '—'}</p>
                  <p><strong>Registration Open:</strong> {(selectedCompModal.registrationDates && selectedCompModal.registrationDates.open) || '—'}</p>
                  <p><strong>Registration Close:</strong> {(selectedCompModal.registrationDates && selectedCompModal.registrationDates.close) || '—'}</p>
                  <p><strong>Entry Fee Model:</strong> {selectedCompModal.entryFee || 'Free'}</p>
                  <p><strong>Max Teams:</strong> {selectedCompModal.maxTeams || '—'}</p>
                  <p><strong>Prize Pool:</strong> {formatPrizePool(selectedCompModal.prizePool)}</p>
                  <p><strong>Location:</strong> {selectedCompModal.location || 'Online'}</p>
                  <p><strong>Approval Status:</strong> {selectedCompModal.approvalStatus || 'approved'}</p>
                </div>
                <div className="admin-detail-desc" style={{ marginTop: '16px' }}>
                  <strong>Description:</strong><br />
                  {selectedCompModal.description || 'No description provided.'}
                </div>

                {String(selectedCompModal.approvalStatus || '').toLowerCase() === 'pending' && (
                  <div style={{ marginTop: '20px', display: 'flex', gap: '12px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedCompModal.id, 'approved')}
                      style={{ flex: 1, padding: '12px', background: '#22c55e', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}
                    >
                      ✔ Approve Tournament
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedCompModal.id, 'rejected')}
                      style={{ flex: 1, padding: '12px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}
                    >
                      ✖ Reject Tournament
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
