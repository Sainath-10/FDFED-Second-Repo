import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import '../styles/pages/subpage.css';

const PAGE_SIZE = 5;

const ROUND_OPTIONS = {
  league: ['Group Stage', 'Eliminations', 'Quarterfinals', 'Semifinals', 'Finals'],
  tournament: ['Eliminations', 'Quarterfinals', 'Semifinals', 'Finals'],
};

export default function CompManageMatchesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const id = searchParams.get('id');
  const [comp, setComp] = useState(null);

  // Form states
  const [sfTeam1, setSfTeam1] = useState('');
  const [sfTeam2, setSfTeam2] = useState('');
  const [sfDate, setSfDate] = useState('');
  const [sfTime, setSfTime] = useState('');
  const [sfRound, setSfRound] = useState('Quarterfinals');

  // Filter & Pagination states
  const [matchSearch, setMatchSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState('all');
  const [matchPage, setMatchPage] = useState(1);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) {
      navigate('/competitions', { replace: true });
      return;
    }
    const found = NexusData.getCompetitionById(id);
    if (found) {
      setComp(found);
      const isLeague = String(found.type || found.format || '').toLowerCase().includes('league') ||
        String(found.type || found.format || '').toLowerCase().includes('robin');
      const rounds = isLeague ? ROUND_OPTIONS.league : ROUND_OPTIONS.tournament;
      setSfRound(rounds[0]);
    } else {
      setComp({ id, name: 'Competition', game: '—', type: 'league', status: 'upcoming', teams: [], matches: [], maxTeams: 16, totalMatches: 0 });
    }
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

  const isEnded = !!(comp.ended || comp.status === 'completed');
  const approvedTeams = (comp.teams || []).filter(t => t.status === 'approved' && t.status !== 'banned');
  const matches = comp.matches || [];

  const isLeague = String(comp.type || comp.format || '').toLowerCase().includes('league') ||
    String(comp.type || comp.format || '').toLowerCase().includes('robin');
  const roundOptions = isLeague ? ROUND_OPTIONS.league : ROUND_OPTIONS.tournament;

  // Schedule Match
  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    if (isEnded) {
      showToast('Competition has ended — cannot schedule new matches.', 'error');
      return;
    }
    if (!sfTeam1 || !sfTeam2 || sfTeam1 === sfTeam2) {
      showToast('Please select two different teams.', 'error');
      return;
    }

    const formattedDate = sfDate
      ? new Date(sfDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';

    const newMatch = {
      id: `M${Date.now().toString().slice(-6)}`,
      team1: sfTeam1,
      team2: sfTeam2,
      round: sfRound,
      status: 'scheduled',
      date: formattedDate,
      time: sfTime || '—',
    };

    const updatedMatches = [newMatch, ...matches];
    const updatedComp = {
      ...comp,
      matches: updatedMatches,
      totalMatches: updatedMatches.length,
    };

    NexusData.updateCompetition(updatedComp);
    setComp(updatedComp);
    setSfTeam1('');
    setSfTeam2('');
    setSfDate('');
    setSfTime('');
    showToast('Match scheduled successfully!');
    setTick(t => t + 1);
  };

  // Filter matches
  const filteredMatches = matches.filter(m => {
    const ms = matchFilter === 'all' || m.status === matchFilter;
    const q = matchSearch.toLowerCase().trim();
    const mq = !q || (m.team1 || '').toLowerCase().includes(q) || (m.team2 || '').toLowerCase().includes(q) || (m.id || '').toLowerCase().includes(q);
    return ms && mq;
  });

  const totalFiltered = filteredMatches.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const startIdx = (matchPage - 1) * PAGE_SIZE;
  const pageMatches = filteredMatches.slice(startIdx, startIdx + PAGE_SIZE);

  const statusMap = {
    scheduled: ['Scheduled', 'sm-scheduled'],
    live: ['Live Now', 'sm-live'],
    completed: ['Completed', 'sm-completed'],
  };

  return (
    <Shell activeItem="activity">
      <main className="sub-main">
        {/* Header */}
        <div className="sub-page-header">
          <div className="sub-header-content">
            <h1 className="sub-page-title">Manage Matches</h1>
            <p className="sub-page-subtitle">Schedule and manage scheduled matches for this competition</p>
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
        <div className="comp-banner comp-banner-lg" id="comp-banner">
          <div className="banner-img-placeholder banner-img-lg">🎮</div>
          <div className="banner-info">
            <span className="banner-status-tag">
              {comp.status === 'ongoing' ? 'ACTIVE COMPETITION' : (comp.status || 'UPCOMING').toUpperCase()}
            </span>
            <h2 className="banner-title banner-title-lg">{comp.name}</h2>
            <div className="banner-meta">
              <span className="banner-tag">🎮 {comp.game}</span>
              <span className="banner-tag">🔄 {comp.format}</span>
            </div>
          </div>
          <div className="banner-stats">
            <div>
              <span className="banner-stat-label">TEAMS</span>
              <span className="banner-stat-val">{approvedTeams.length}</span>
            </div>
            <div>
              <span className="banner-stat-label">MATCHES</span>
              <span className="banner-stat-val">{matches.length}</span>
            </div>
          </div>
        </div>

        <div className="matches-body">
          {/* Schedule Form Panel */}
          <div className="sub-panel">
            <div className="panel-section-title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="6" />
                <line x1="8" y1="5" x2="8" y2="8" />
                <line x1="10" y1="10" x2="8" y2="8" />
              </svg>
              Schedule New Match
            </div>
            <form id="schedule-form" className="schedule-form" onSubmit={handleScheduleSubmit}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>TEAM 1</label>
                  <select
                    id="sf-team1"
                    value={sfTeam1}
                    disabled={isEnded}
                    onChange={(e) => setSfTeam1(e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {approvedTeams
                      .filter(t => t.name !== sfTeam2)
                      .map(t => (
                        <option key={t.id || t.name} value={t.name}>{t.name}</option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>TEAM 2</label>
                  <select
                    id="sf-team2"
                    value={sfTeam2}
                    disabled={isEnded}
                    onChange={(e) => setSfTeam2(e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {approvedTeams
                      .filter(t => t.name !== sfTeam1)
                      .map(t => (
                        <option key={t.id || t.name} value={t.name}>{t.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>MATCH DATE</label>
                  <input
                    type="date"
                    id="sf-date"
                    value={sfDate}
                    disabled={isEnded}
                    onChange={(e) => setSfDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>MATCH TIME</label>
                  <input
                    type="time"
                    id="sf-time"
                    value={sfTime}
                    disabled={isEnded}
                    onChange={(e) => setSfTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>ROUND</label>
                <select
                  id="sf-round"
                  value={sfRound}
                  disabled={isEnded}
                  onChange={(e) => setSfRound(e.target.value)}
                >
                  {roundOptions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn-schedule" disabled={isEnded}>
                SCHEDULE MATCH
              </button>
            </form>
          </div>

          {/* Scheduled Matches Panel */}
          <div className="sub-panel">
            <div className="panel-section-title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.5" strokeLinecap="round">
                <rect x="1" y="2" width="14" height="13" rx="2" />
                <line x1="1" y1="6" x2="15" y2="6" />
              </svg>
              Scheduled Matches
            </div>

            <div className="matches-toolbar">
              <div className="search-box-wrapper">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round">
                  <circle cx="9" cy="9" r="6" />
                  <line x1="14" y1="14" x2="18" y2="18" />
                </svg>
                <input
                  type="text"
                  className="sub-search sub-search-sm"
                  id="matches-search"
                  placeholder="Search matches..."
                  value={matchSearch}
                  onChange={(e) => { setMatchSearch(e.target.value); setMatchPage(1); }}
                />
              </div>

              <select
                className="sub-select sub-select-sm"
                id="matches-status-filter"
                value={matchFilter}
                onChange={(e) => { setMatchFilter(e.target.value); setMatchPage(1); }}
              >
                <option value="all">Status: All</option>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="scheduled-matches-table">
              <div className="sm-header">
                <span className="sm-col-id">MATCH ID</span>
                <span className="sm-col-teams">TEAMS</span>
                <span className="sm-col-round">ROUND</span>
                <span className="sm-col-date">DATE &amp; TIME</span>
                <span className="sm-col-status">STATUS</span>
              </div>

              <div id="matches-rows">
                {pageMatches.length === 0 ? (
                  <div className="empty-state">No matches found. Schedule one!</div>
                ) : (
                  pageMatches.map((m) => {
                    const [label, cls] = statusMap[m.status] || ['—', ''];
                    const isLive = m.status === 'live';
                    const scoreHtml = m.status === 'completed' ? `${m.score1}–${m.score2}` : 'vs';

                    return (
                      <div className="sm-row" key={m.id}>
                        <span className="sm-col-id match-id-link">#{m.id}</span>
                        <span className="sm-col-teams">
                          {m.team1} <span className="vs-sep">{scoreHtml}</span> {m.team2}
                        </span>
                        <span className="sm-col-round">{m.round}</span>
                        <span className="sm-col-date">
                          <span>{m.date}</span>
                          <span className={`match-time ${isLive ? 'time-live' : ''}`}>
                            {isLive ? 'In Progress' : m.time}
                          </span>
                        </span>
                        <span className="sm-col-status">
                          <span className={`sm-status-badge ${cls}`}>{label}</span>
                          {m.status !== 'completed' && !isEnded && (
                            <Link
                              to={`/comp-match-results?id=${comp.id}&matchId=${encodeURIComponent(m.id)}`}
                              className="btn-xs btn-enter"
                              style={{ marginLeft: '8px', textDecoration: 'none' }}
                            >
                              ENTER RESULT
                            </Link>
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="sub-pagination" id="matches-pagination">
              <span className="pg-info">
                Showing {totalFiltered === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, totalFiltered)} of {totalFiltered} matches
              </span>
              <div className="pg-btns">
                <button
                  className="pg-btn"
                  onClick={() => setMatchPage(p => Math.max(1, p - 1))}
                  disabled={matchPage === 1}
                >
                  Previous
                </button>
                <button
                  className="pg-btn"
                  onClick={() => setMatchPage(p => Math.min(totalPages, p + 1))}
                  disabled={matchPage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
