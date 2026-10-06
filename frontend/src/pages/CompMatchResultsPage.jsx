import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import '../styles/pages/subpage.css';

const PAGE_SIZE = 5;

export default function CompMatchResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const id = searchParams.get('id');
  const initialMatchId = searchParams.get('matchId');

  const [comp, setComp] = useState(null);
  const [resSearch, setResSearch] = useState('');
  const [roundFilter, setRoundFilter] = useState('all');
  const [resFilter, setResFilter] = useState('all');
  const [resPage, setResPage] = useState(1);

  // Result modal state
  const [modalMatch, setModalMatch] = useState(null);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) {
      navigate('/competitions', { replace: true });
      return;
    }
    const found = NexusData.getCompetitionById(id);
    if (found) {
      setComp(found);
      if (initialMatchId) {
        const target = found.matches?.find(m => String(m.id) === String(initialMatchId));
        if (target) {
          setModalMatch(target);
          setScore1(target.score1 || 0);
          setScore2(target.score2 || 0);
        }
      }
    } else {
      setComp({ id, name: 'Competition', game: '—', type: 'league', status: 'upcoming', teams: [], matches: [], totalMatches: 0, matchesCompleted: 0 });
    }
  }, [id, initialMatchId, navigate, tick]);

  if (!comp) {
    return (
      <Shell activeItem="activity">
        <main className="sub-main" style={{ padding: '40px' }}>
          <h2>Loading...</h2>
        </main>
      </Shell>
    );
  }

  const matches = comp.matches || [];
  const totalMatches = comp.totalMatches || matches.length;
  const matchesCompleted = comp.matchesCompleted || matches.filter(m => m.status === 'completed').length;
  const pct = totalMatches ? Math.round((matchesCompleted / totalMatches) * 100) : 0;

  const distinctRounds = Array.from(new Set(matches.map(m => m.round).filter(Boolean)));

  const filtered = matches.filter(m => {
    const ms = resFilter === 'all' || m.status === resFilter;
    const mr = roundFilter === 'all' || m.round === roundFilter;
    const q = resSearch.toLowerCase().trim();
    const mq = !q || (m.team1 || '').toLowerCase().includes(q) || (m.team2 || '').toLowerCase().includes(q) || (m.id || '').toLowerCase().includes(q);
    return ms && mr && mq;
  });

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const startIdx = (resPage - 1) * PAGE_SIZE;
  const pageMatches = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const canStartMatch = (match) => {
    if (!match || match.status !== 'scheduled') return false;
    const hasLive = matches.some(item => item.status === 'live');
    if (hasLive) return false;
    if (NexusData.isTeamBannedInComp(match.team1, comp) || NexusData.isTeamBannedInComp(match.team2, comp)) return false;
    if (!comp.startDate) return true;
    const start = new Date(comp.startDate);
    return !Number.isNaN(start.getTime()) && Date.now() >= start.getTime();
  };

  const handleStartLive = (matchId) => {
    const target = matches.find(x => String(x.id) === String(matchId));
    if (!target || !canStartMatch(target)) return;

    target.status = 'live';
    NexusData.updateCompetition(comp);
    showToast(`Match #${matchId} is now LIVE!`);
    setTick(t => t + 1);
  };

  const handleOpenResultModal = (match) => {
    setModalMatch(match);
    setScore1(match.score1 || 0);
    setScore2(match.score2 || 0);
  };

  const handleSubmitResult = (e) => {
    e.preventDefault();
    if (!modalMatch) return;

    const s1 = parseInt(score1) || 0;
    const s2 = parseInt(score2) || 0;

    const m = matches.find(x => String(x.id) === String(modalMatch.id));
    if (m) {
      m.score1 = s1;
      m.score2 = s2;
      m.status = 'completed';

      comp.matchesCompleted = matches.filter(x => x.status === 'completed').length;

      // Start next scheduled match if none are live
      const hasLive = matches.some(item => item.status === 'live');
      if (!hasLive) {
        const next = matches.find(item => item.status === 'scheduled');
        if (next) next.status = 'live';
      }

      NexusData.updateCompetition(comp);
      setModalMatch(null);
      showToast(`Match #${m.id} results saved!`, 'success');
      setTick(t => t + 1);
    }
  };

  return (
    <Shell activeItem="activity">
      <main className="sub-main">
        {/* Header */}
        <div className="sub-page-header">
          <div className="sub-header-content">
            <h1 className="sub-page-title">Match Results</h1>
            <p className="sub-page-subtitle">Enter and manage results for completed matches</p>
          </div>
          <Link to={`/competition-detail?id=${comp.id}`} className="btn-back" id="btn-back-to-comp">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="10" y1="3" x2="4" y2="8" />
              <line x1="4" y1="8" x2="10" y2="13" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Summary Card */}
        <div className="comp-summary-card" id="comp-summary">
          <div className="summary-icon">🎮</div>
          <div className="summary-info">
            <div className="summary-header">
              <h2 className="summary-title">{comp.name}</h2>
              <span className="badge-status status-approved">{(comp.status || 'UPCOMING').toUpperCase()}</span>
            </div>
            <div className="summary-sub">{comp.game} • {comp.format}</div>
            <div className="summary-stats">
              <div>
                <span className="stat-label">TOTAL MATCHES</span>
                <span className="stat-val-sm">{totalMatches}</span>
              </div>
              <div>
                <span className="stat-label">MATCHES COMPLETED</span>
                <span className="stat-val-sm stat-green">{matchesCompleted}</span>
              </div>
              <div className="summary-progress-wrap">
                <span className="stat-label">PROGRESS</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Toolbar */}
        <div className="results-toolbar">
          <div className="search-box-wrapper">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round">
              <circle cx="9" cy="9" r="6" />
              <line x1="14" y1="14" x2="18" y2="18" />
            </svg>
            <input
              type="text"
              className="sub-search"
              id="results-search"
              placeholder="Search match ID or team name..."
              value={resSearch}
              onChange={(e) => { setResSearch(e.target.value); setResPage(1); }}
            />
          </div>

          <select
            className="sub-select"
            id="results-round-filter"
            value={roundFilter}
            onChange={(e) => { setRoundFilter(e.target.value); setResPage(1); }}
          >
            <option value="all">All Rounds</option>
            {distinctRounds.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            className="sub-select"
            id="results-status-filter"
            value={resFilter}
            onChange={(e) => { setResFilter(e.target.value); setResPage(1); }}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>

        {/* Sub Panel */}
        <div className="sub-panel">
          <div className="results-table-header">
            <span className="rc-id">MATCH ID</span>
            <span className="rc-teams">TEAMS &amp; SCORE</span>
            <span className="rc-round">ROUND</span>
            <span className="rc-date">DATE &amp; TIME</span>
            <span className="rc-status">STATUS</span>
            <span className="rc-actions">ACTIONS</span>
          </div>

          <div id="results-rows">
            {pageMatches.length === 0 ? (
              <div className="empty-state">No matches found.</div>
            ) : (
              pageMatches.map((m) => {
                const isComp = m.status === 'completed';
                const isLive = m.status === 'live';
                const stLabel = { completed: 'COMPLETED', live: 'LIVE', scheduled: 'SCHEDULED' }[m.status] || m.status;
                const stCls = { completed: 'sm-completed', live: 'sm-live', scheduled: 'sm-scheduled' }[m.status] || '';
                const canGoLive = canStartMatch(m);

                return (
                  <div className="results-row" key={m.id}>
                    <span className="rc-id match-id-link">#{m.id}</span>
                    <span className="rc-teams">
                      {isComp ? (
                        <>
                          <span className="res-team res-team-win">{m.team1}</span>
                          <span className="res-score">{m.score1} – {m.score2}</span>
                          <span className="res-team">{m.team2}</span>
                        </>
                      ) : (
                        <>
                          <span className="res-team">{m.team1}</span>
                          <span className="res-vs">vs</span>
                          <span className="res-team">{m.team2}</span>
                        </>
                      )}
                    </span>
                    <span className="rc-round">{m.round}</span>
                    <span className="rc-date">
                      <span>{m.date}</span>
                      <span className={`match-time ${isLive ? 'time-live' : ''}`}>
                        {isLive ? 'In Progress' : m.time}
                      </span>
                    </span>
                    <span className="rc-status">
                      <span className={`sm-status-badge ${stCls}`}>{stLabel}</span>
                    </span>
                    <span className="rc-actions">
                      {isComp ? (
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() => handleOpenResultModal(m)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      ) : isLive ? (
                        <button
                          className="btn-xs btn-enter"
                          type="button"
                          onClick={() => handleOpenResultModal(m)}
                        >
                          ENTER RESULT
                        </button>
                      ) : (
                        <button
                          className="btn-xs btn-enter"
                          type="button"
                          disabled={!canGoLive}
                          onClick={() => handleStartLive(m.id)}
                        >
                          {canGoLive ? 'START LIVE' : 'PENDING'}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="sub-pagination" id="results-pagination">
            <span className="pg-info">
              Showing {totalFiltered === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, totalFiltered)} of {totalFiltered} matches
            </span>
            <div className="pg-btns">
              <button
                className="pg-btn"
                onClick={() => setResPage(p => Math.max(1, p - 1))}
                disabled={resPage === 1}
              >
                Previous
              </button>
              <button className="pg-btn active">{resPage}</button>
              <button
                className="pg-btn"
                onClick={() => setResPage(p => Math.min(totalPages, p + 1))}
                disabled={resPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Enter Result Modal */}
      {modalMatch && (
        <div
          className="modal-overlay active open"
          id="result-modal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target.id === 'result-modal') setModalMatch(null);
          }}
        >
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title">Enter Match Result</h3>
              <button className="modal-close" onClick={() => setModalMatch(null)}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </svg>
              </button>
            </div>
            <div id="result-modal-body">
              <div className="result-teams-display">
                <div className="result-team-block">
                  <div className="team-avatar-sm">{modalMatch.team1?.[0] || '1'}</div>
                  <span>{modalMatch.team1}</span>
                </div>
                <div className="result-score-inputs">
                  <input
                    type="number"
                    id="score1-input"
                    min="0"
                    max="99"
                    value={score1}
                    className="score-input"
                    onChange={(e) => setScore1(e.target.value)}
                  />
                  <span className="score-sep">–</span>
                  <input
                    type="number"
                    id="score2-input"
                    min="0"
                    max="99"
                    value={score2}
                    className="score-input"
                    onChange={(e) => setScore2(e.target.value)}
                  />
                </div>
                <div className="result-team-block">
                  <div className="team-avatar-sm">{modalMatch.team2?.[0] || '2'}</div>
                  <span>{modalMatch.team2}</span>
                </div>
              </div>
              <div className="result-modal-actions">
                <button className="btn-cancel" onClick={() => setModalMatch(null)}>
                  Cancel
                </button>
                <button className="btn-submit" onClick={handleSubmitResult}>
                  Save Result
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
