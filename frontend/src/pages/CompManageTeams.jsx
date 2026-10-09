/**
 * NEXUS ESPORTS — Manage Teams
 *
 * banner + stats,
 * search/status filter, paginated team table with approve/reject (row + bulk),
 * and the ended-competition lock.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/subpage.css';

const PAGE_SIZE = 10;
const STATUS_CLS = { approved: 'status-approved', pending: 'status-pending', rejected: 'status-rejected' };
const STATUS_LBL = { approved: 'APPROVED', pending: 'PENDING', rejected: 'REJECTED' };

function renderTeamAvatar(avatar, name) {
  const fallback = name ? String(name).charAt(0).toUpperCase() : 'T';
  if (!avatar) return fallback;
  const str = String(avatar).trim();
  if (str.startsWith('<svg') && str.endsWith('</svg>')) {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: str }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
      />
    );
  }
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/') || str.startsWith('data:image/')) {
    return <img src={str} alt={name || 'Team'} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />;
  }
  if (str.length <= 4) return str;
  return fallback;
}

export default function CompManageTeams() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const id = params.get('id') || '';

  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState([]);

  const comp = useMemo(() => {
    if (!id || !NexusData) return null;
    return NexusData.getCompetitionById(id) || { id, name: 'New Competition', game: '—', type: 'league', status: 'upcoming', teams: [], maxTeams: 16, format: '—', season: '—' };
  }, [id, version]);

  useEffect(() => {
    if (comp && NexusData.enforceNotEnded) {
      NexusData.enforceNotEnded(comp, '#btn-approve-selected,#btn-reject-selected,.btn-approve,.btn-reject,.btn-xs');
    }
    return () => {
      const b = document.getElementById('_ended_banner_');
      if (b) b.remove();
      document.body.style.marginTop = '';
    };
  }, [comp]);

  if (!comp) return <main className="sub-main"><h1 className="sub-page-title">Manage Teams</h1></main>;

  const teams = comp.teams || [];
  const filtered = teams.filter((t) => {
    const matchFilter = filter === 'all' || t.status === filter;
    const matchSearch = !searchQ || String(t.name || '').toLowerCase().includes(searchQ) || String(t.captain || '').toLowerCase().includes(searchQ);
    return matchFilter && matchSearch;
  });
  const total = filtered.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const approved = teams.filter((t) => t.status === 'approved').length;
  const pending = teams.filter((t) => t.status === 'pending').length;
  const rejected = teams.filter((t) => t.status === 'rejected').length;

  function decideTeam(teamId, decision) {
    const by = (session && session.username) || 'organizer';
    if (NexusData && typeof NexusData.setTeamRegistrationStatus === 'function' && comp.id) {
      const result = NexusData.setTeamRegistrationStatus(comp.id, teamId, decision, by);
      if (!result.ok) { showToast(result.error || 'Unable to update team status.', 'error'); return; }
      showToast(`Team ${decision === 'approved' ? 'approved' : 'rejected'}.`);
      setVersion((v) => v + 1);
      return;
    }
    const fresh = NexusData.getCompetitionById(comp.id);
    if (fresh) {
      const t = fresh.teams.find((x) => x.id === teamId);
      if (t) t.status = decision;
      NexusData.updateCompetition(fresh);
    }
    setVersion((v) => v + 1);
  }

  function bulk(decision) {
    selected.forEach((tid) => decideTeam(tid, decision));
    setSelected([]);
  }

  const allVisibleSelected = slice.length > 0 && slice.every((t) => selected.includes(t.id));

  return (
    <main className="sub-main">
      <div className="sub-page-header">
        <div className="sub-header-content">
          <h1 className="sub-page-title">Manage Teams</h1>
          <p className="sub-page-subtitle">Manage teams participating in this competition</p>
        </div>
        <Link className="btn-back" id="btn-back-to-comp" to={`/pages/competition-detail.html?id=${id}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="comp-banner" id="comp-banner">
        <div className="banner-img-placeholder">🎮</div>
        <div className="banner-info">
          <span className="banner-status-tag">{String(comp.status).toUpperCase()}</span>
          <span className="banner-created">• Created {comp.createdDaysAgo || 0} days ago</span>
          <h2 className="banner-title">{comp.name}</h2>
          <div className="banner-meta">
            <span>🎮 {comp.game}</span>
            <span>👥 {approved} / {comp.maxTeams} Teams Registered</span>
          </div>
        </div>
        <Link to={`/pages/competition-detail.html?id=${comp.id}`} className="btn-back">Edit Settings</Link>
      </div>

      <div className="teams-stats-row" id="teams-stats-row">
        <div className="stat-card"><div className="stat-label">Total Teams Registered</div><div className="stat-big">{teams.length} <span className="stat-delta">+5%</span></div></div>
        <div className="stat-card"><div className="stat-label">Approved Teams</div><div className="stat-big stat-green">{approved}</div></div>
        <div className="stat-card"><div className="stat-label">Pending Approval</div><div className="stat-big stat-yellow">{pending}</div></div>
        <div className="stat-card"><div className="stat-label">Rejected Teams</div><div className="stat-big stat-red">{rejected}</div></div>
      </div>

      <div className="sub-panel">
        <div className="sub-panel-toolbar">
          <div className="search-box-wrapper">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round"><circle cx="9" cy="9" r="6" /><line x1="14" y1="14" x2="18" y2="18" /></svg>
            <input type="text" className="sub-search" id="teams-search" placeholder="Search teams by name..." value={searchQ} onChange={(e) => { setSearchQ(e.target.value.toLowerCase().trim()); setPage(1); }} />
          </div>
          <select className="sub-select" id="teams-status-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="btn-action btn-approve-sel" id="btn-approve-selected" onClick={() => bulk('approved')}>Approve Selected</button>
          <button className="btn-action btn-reject-sel" id="btn-reject-selected" onClick={() => bulk('rejected')}>Reject Selected</button>
        </div>

        <div className="teams-table-wrap">
          <div className="teams-table-header">
            <label className="check-wrap">
              <input type="checkbox" id="check-all" checked={allVisibleSelected} onChange={(e) => setSelected(e.target.checked ? slice.map((t) => t.id) : [])} />
              <span className="checkmark"></span>
            </label>
            <span className="col-team">TEAM</span>
            <span className="col-captain">CAPTAIN</span>
            <span className="col-players">PLAYERS</span>
            <span className="col-regdate">REG. DATE</span>
            <span className="col-status">STATUS</span>
            <span className="col-actions">ACTIONS</span>
          </div>
          <div id="teams-rows">
            {slice.length === 0 ? (
              <div className="empty-state">No teams found.</div>
            ) : (
              slice.map((t) => (
                <div className="teams-table-row" data-id={t.id} key={t.id}>
                  <label className="check-wrap">
                    <input
                      type="checkbox"
                      className="row-check"
                      data-id={t.id}
                      checked={selected.includes(t.id)}
                      onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id)))}
                    />
                    <span className="checkmark"></span>
                  </label>
                  <div className="col-team" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pages/team/team-roster.html?compId=${comp.id}&teamId=${t.id}`)}>
                    <div className="team-avatar-sm">{renderTeamAvatar(t.avatar, t.name)}</div>
                    <span>{t.name}</span>
                  </div>
                  <span className="col-captain">{t.captain || '—'}</span>
                  <span className="col-players">{t.players || '—'}</span>
                  <span className="col-regdate">{t.regDate || '—'}</span>
                  <span className="col-status"><span className={`badge-status ${STATUS_CLS[t.status]}`}>{STATUS_LBL[t.status]}</span></span>
                  <span className="col-actions">
                    {t.status === 'pending' && (
                      <>
                        <button className="btn-xs btn-approve" onClick={() => decideTeam(t.id, 'approved')}>Approve</button>
                        <button className="btn-xs btn-reject" onClick={() => decideTeam(t.id, 'rejected')}>Reject</button>
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sub-pagination" id="teams-pagination">
          <span className="pg-info">Showing {Math.min(start + 1, total)}–{Math.min(start + PAGE_SIZE, total)} of {total} teams</span>
          <div className="pg-btns">
            {Array.from({ length: pages }).map((_, i) => (
              <button className={`pg-btn ${i + 1 === page ? 'active' : ''}`} key={i} onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}


