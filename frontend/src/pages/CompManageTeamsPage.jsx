import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import { NexusAuth } from '../services/authService';
import '../styles/pages/subpage.css';

const PAGE_SIZE = 10;

export default function CompManageTeamsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const id = searchParams.get('id');
  const [comp, setComp] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) {
      navigate('/competitions', { replace: true });
      return;
    }
    const found = NexusData.getCompetitionById(id);
    setComp(found || { id, name: 'Competition', game: '—', type: 'league', status: 'upcoming', teams: [], maxTeams: 16 });
  }, [id, navigate, tick]);

  if (!comp) {
    return (
      <Shell activeItem="activity">
        <main className="sub-main" style={{ padding: '40px' }}>
          <h2>Loading...</h2>
        </main>
      </Shell>
    );
  }

  const teams = comp.teams || [];
  const isEnded = !!(comp.ended || comp.status === 'completed');

  const total = teams.length;
  const approved = teams.filter(t => t.status === 'approved').length;
  const pending = teams.filter(t => t.status === 'pending').length;
  const rejected = teams.filter(t => t.status === 'rejected').length;

  const filtered = teams.filter(t => {
    const matchFilter = filter === 'all' || t.status === filter;
    const q = searchQ.toLowerCase().trim();
    const matchSearch = !q || (t.name || '').toLowerCase().includes(q) || (t.captain || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageTeams = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(pageTeams.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (teamId) => {
    setSelectedIds(prev =>
      prev.includes(teamId) ? prev.filter(x => x !== teamId) : [...prev, teamId]
    );
  };

  const decideTeam = (teamId, decision) => {
    const session = NexusAuth.getSession();
    const by = session?.username || 'organizer';

    const result = NexusData.setTeamRegistrationStatus(comp.id, teamId, decision, by);
    if (!result.ok) {
      showToast(result.error || 'Unable to update team status.', 'error');
      return;
    }

    showToast(`Team ${decision === 'approved' ? 'approved' : 'rejected'}.`);
    setSelectedIds(prev => prev.filter(x => x !== teamId));
    setTick(t => t + 1);
  };

  const handleBatchDecision = (decision) => {
    if (selectedIds.length === 0) {
      showToast('No teams selected.', 'error');
      return;
    }
    const session = NexusAuth.getSession();
    const by = session?.username || 'organizer';

    selectedIds.forEach(tId => {
      NexusData.setTeamRegistrationStatus(comp.id, tId, decision, by);
    });

    showToast(`Selected teams ${decision === 'approved' ? 'approved' : 'rejected'}.`);
    setSelectedIds([]);
    setTick(t => t + 1);
  };

  return (
    <Shell activeItem="activity">
      <main className="sub-main">
        {/* Header */}
        <div className="sub-page-header">
          <div className="sub-header-content">
            <h1 className="sub-page-title">Manage Teams</h1>
            <p className="sub-page-subtitle">Manage teams participating in this competition</p>
          </div>
          <Link to={`/competition-detail?id=${comp.id}`} className="btn-back" id="btn-back-to-comp">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="10" y1="3" x2="4" y2="8" />
              <line x1="4" y1="8" x2="10" y2="13" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Banner */}
        <div className="comp-banner" id="comp-banner">
          <div className="banner-img-placeholder">🎮</div>
          <div className="banner-info">
            <span className="banner-status-tag">{(comp.status || 'upcoming').toUpperCase()}</span>
            <span className="banner-created">• Created {comp.createdDaysAgo || 0} days ago</span>
            <h2 className="banner-title">{comp.name}</h2>
            <div className="banner-meta">
              <span>🎮 {comp.game}</span>
              <span>👥 {approved} / {comp.maxTeams || '—'} Teams Registered</span>
            </div>
          </div>
          <Link to={`/competition-detail?id=${comp.id}`} className="btn-back">
            Edit Settings
          </Link>
        </div>

        {/* Stats Row */}
        <div className="teams-stats-row" id="teams-stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Teams Registered</div>
            <div className="stat-big">{total} <span className="stat-delta">+5%</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Approved Teams</div>
            <div className="stat-big stat-green">{approved}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Approval</div>
            <div className="stat-big stat-yellow">{pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rejected Teams</div>
            <div className="stat-big stat-red">{rejected}</div>
          </div>
        </div>

        {/* Panel */}
        <div className="sub-panel">
          <div className="sub-panel-toolbar">
            <div className="search-box-wrapper">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round">
                <circle cx="9" cy="9" r="6" />
                <line x1="14" y1="14" x2="18" y2="18" />
              </svg>
              <input
                type="text"
                className="sub-search"
                id="teams-search"
                placeholder="Search teams by name..."
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <select
              className="sub-select"
              id="teams-status-filter"
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            {!isEnded && (
              <>
                <button
                  className="btn-action btn-approve-sel"
                  id="btn-approve-selected"
                  onClick={() => handleBatchDecision('approved')}
                >
                  Approve Selected
                </button>
                <button
                  className="btn-action btn-reject-sel"
                  id="btn-reject-selected"
                  onClick={() => handleBatchDecision('rejected')}
                >
                  Reject Selected
                </button>
              </>
            )}
          </div>

          <div className="teams-table-wrap">
            <div className="teams-table-header">
              <label className="check-wrap">
                <input
                  type="checkbox"
                  id="check-all"
                  checked={pageTeams.length > 0 && pageTeams.every(t => selectedIds.includes(t.id))}
                  onChange={handleSelectAll}
                />
                <span className="checkmark" />
              </label>
              <span className="col-team">TEAM</span>
              <span className="col-captain">CAPTAIN</span>
              <span className="col-players">PLAYERS</span>
              <span className="col-regdate">REG. DATE</span>
              <span className="col-status">STATUS</span>
              <span className="col-actions">ACTIONS</span>
            </div>

            <div id="teams-rows">
              {pageTeams.length === 0 ? (
                <div className="empty-state">No teams found.</div>
              ) : (
                pageTeams.map((t) => {
                  const stCls = t.status === 'approved' ? 'status-approved' : t.status === 'pending' ? 'status-pending' : 'status-rejected';
                  const stLabel = (t.status || 'PENDING').toUpperCase();

                  return (
                    <div className="teams-table-row" data-id={t.id} key={t.id}>
                      <label className="check-wrap">
                        <input
                          type="checkbox"
                          className="row-check"
                          data-id={t.id}
                          checked={selectedIds.includes(t.id)}
                          onChange={() => handleToggleSelect(t.id)}
                        />
                        <span className="checkmark" />
                      </label>
                      <div
                        className="col-team"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/team/team-roster?compId=${comp.id}&teamId=${t.id}`)}
                      >
                        <div className="team-avatar-sm">{t.avatar || t.name?.[0] || 'T'}</div>
                        <span>{t.name}</span>
                      </div>
                      <span className="col-captain">{t.captain || t.createdBy || '—'}</span>
                      <span className="col-players">{t.players || t.members?.length || '—'}</span>
                      <span className="col-regdate">{t.regDate || '—'}</span>
                      <span className="col-status">
                        <span className={`badge-status ${stCls}`}>{stLabel}</span>
                      </span>
                      <span className="col-actions">
                        {t.status === 'pending' && !isEnded && (
                          <>
                            <button className="btn-xs btn-approve" onClick={() => decideTeam(t.id, 'approved')}>
                              Approve
                            </button>
                            <button className="btn-xs btn-reject" onClick={() => decideTeam(t.id, 'rejected')}>
                              Reject
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pagination */}
          <div className="sub-pagination" id="teams-pagination">
            <span className="pg-info">
              Showing {filtered.length === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filtered.length)} of {filtered.length} teams
            </span>
            <div className="pg-btns">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  className={`pg-btn ${currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
