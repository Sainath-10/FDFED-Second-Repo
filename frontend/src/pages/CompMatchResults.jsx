/**
 * NEXUS ESPORTS — Match Results
 *
 * summary + progress,
 * filters, paginated results table with START LIVE / ENTER RESULT / Edit actions, the
 * enter-result modal, and the league standings rebuild.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import '../styles/pages/subpage.css';

const PAGE_SIZE = 5;
const ST_LABEL = { completed: 'COMPLETED', live: 'LIVE', scheduled: 'SCHEDULED' };
const ST_CLS = { completed: 'sm-completed', live: 'sm-live', scheduled: 'sm-scheduled' };

function buildStandings(compData) {
  const teamNames = (compData.teams || []).filter((t) => t.status === 'approved').map((t) => t.name);
  const table = {};
  teamNames.forEach((name) => { table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0 }; });
  (compData.matches || []).forEach((match) => {
    if (match.status !== 'completed') return;
    if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0 };
    if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0 };
    const t1 = table[match.team1];
    const t2 = table[match.team2];
    t1.mp += 1; t2.mp += 1;
    if (match.score1 > match.score2) { t1.w += 1; t2.l += 1; t1.points += 3; }
    else if (match.score2 > match.score1) { t2.w += 1; t1.l += 1; t2.points += 3; }
    else { t1.d += 1; t2.d += 1; t1.points += 1; t2.points += 1; }
  });
  return Object.values(table).sort((a, b) => (b.points - a.points) || (b.w - a.w)).map((row, i) => ({ ...row, rank: i + 1 }));
}

export default function CompMatchResults() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const initialMatchId = params.get('matchId');

  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [roundFilter, setRoundFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [editMatchId, setEditMatchId] = useState(null);
  const [score1, setScore1] = useState('0');
  const [score2, setScore2] = useState('0');

  const comp = useMemo(() => {
    if (!id || !NexusData) return null;
    return NexusData.getCompetitionById(id) || { id, name: 'Competition', game: '—', type: 'league', status: 'upcoming', teams: [], matches: [], totalMatches: 0, matchesCompleted: 0, format: '—', season: '—' };
  }, [id, version]);

 // Auto-open the modal when ?matchId= is present.
  useEffect(() => {
    if (!comp || !initialMatchId) return;
    const target = (comp.matches || []).find((m) => String(m.id) === String(initialMatchId));
    if (target) openEnter(target);
 // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp, initialMatchId]);

  if (!comp) return <main className="sub-main"><h1 className="sub-page-title">Match Results</h1></main>;

  const matches = comp.matches || [];
  const rounds = [...new Set(matches.map((m) => m.round))];
  const pct = comp.totalMatches ? Math.round((comp.matchesCompleted / comp.totalMatches) * 100) : 0;

  function canStartMatch(match) {
    if (!match || match.status !== 'scheduled') return false;
    if (matches.some((item) => item.status === 'live')) return false;
    if (NexusData.isTeamBannedInComp && (NexusData.isTeamBannedInComp(match.team1, comp) || NexusData.isTeamBannedInComp(match.team2, comp))) return false;
    if (!comp.startDate) return true;
    const start = new Date(comp.startDate);
    return !Number.isNaN(start.getTime()) && Date.now() >= start.getTime();
  }

  function openEnter(match) {
    setEditMatchId(match.id);
    setScore1(String(match.status === 'completed' ? match.score1 : 0));
    setScore2(String(match.status === 'completed' ? match.score2 : 0));
  }

  function startMatchLive(matchId) {
    const fresh = NexusData.getCompetitionById(id) || comp;
    const m = fresh.matches.find((x) => String(x.id) === String(matchId));
    if (!m) return;
    const hasLive = fresh.matches.some((item) => item.status === 'live');
    if (hasLive || m.status !== 'scheduled') return;
    if (NexusData.isTeamBannedInComp && (NexusData.isTeamBannedInComp(m.team1, fresh) || NexusData.isTeamBannedInComp(m.team2, fresh))) return;
    m.status = 'live';
    NexusData.updateCompetition(fresh);
    setVersion((v) => v + 1);
  }

  function submitResult() {
    const s1 = parseInt(score1, 10) || 0;
    const s2 = parseInt(score2, 10) || 0;
    const fresh = NexusData.getCompetitionById(id) || comp;
    const m = fresh.matches.find((x) => String(x.id) === String(editMatchId));
    if (!m) return;
    m.score1 = s1;
    m.score2 = s2;
    m.status = 'completed';
    fresh.matchesCompleted = fresh.matches.filter((x) => x.status === 'completed').length;
    // Auto-start the next scheduled match (auto-advance).
    if (!fresh.matches.some((item) => item.status === 'live')) {
      const next = fresh.matches.find((item) => item.status === 'scheduled');
      if (next) next.status = 'live';
    }
    if (fresh.type === 'league') fresh.standings = buildStandings(fresh);
    NexusData.updateCompetition(fresh);
    setEditMatchId(null);
    setVersion((v) => v + 1);
  }

  const filtered = matches.filter((m) => {
    const ms = filter === 'all' || m.status === filter;
    const mr = roundFilter === 'all' || m.round === roundFilter;
    const mq = !searchQ || String(m.team1 || '').toLowerCase().includes(searchQ) || String(m.team2 || '').toLowerCase().includes(searchQ) || String(m.id || '').toLowerCase().includes(searchQ);
    return ms && mr && mq;
  });
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const modalMatch = editMatchId ? matches.find((x) => String(x.id) === String(editMatchId)) : null;

  return (
    <main className="sub-main">
      <div className="sub-page-header">
        <div className="sub-header-content">
          <h1 className="sub-page-title">Match Results</h1>
          <p className="sub-page-subtitle">Enter and manage results for completed matches</p>
        </div>
        <Link className="btn-back" id="btn-back-to-comp" to={`/pages/competition-detail.html?id=${id}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="comp-summary-card" id="comp-summary">
        <div className="summary-icon">🎮</div>
        <div className="summary-info">
          <div className="summary-header">
            <h2 className="summary-title">{comp.name}</h2>
            <span className="badge-status status-approved">{String(comp.status).toUpperCase()}</span>
          </div>
          <div className="summary-sub">{comp.game} • {comp.format}</div>
          <div className="summary-stats">
            <div><span className="stat-label">TOTAL MATCHES</span><span className="stat-val-sm">{comp.totalMatches}</span></div>
            <div><span className="stat-label">MATCHES COMPLETED</span><span className="stat-val-sm stat-green">{comp.matchesCompleted}</span></div>
            <div className="summary-progress-wrap">
              <span className="stat-label">PROGRESS</span>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }}></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="results-toolbar">
        <div className="search-box-wrapper">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa4b2" strokeWidth="1.67" strokeLinecap="round"><circle cx="9" cy="9" r="6" /><line x1="14" y1="14" x2="18" y2="18" /></svg>
          <input type="text" className="sub-search" id="results-search" placeholder="Search match ID or team name..." value={searchQ} onChange={(e) => { setSearchQ(e.target.value.toLowerCase().trim()); setPage(1); }} />
        </div>
        <select className="sub-select" id="results-round-filter" value={roundFilter} onChange={(e) => { setRoundFilter(e.target.value); setPage(1); }}>
          <option value="all">All Rounds</option>
          {rounds.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="sub-select" id="results-status-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="live">Live</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>

      <div className="sub-panel">
        <div className="results-table-header">
          <span className="rc-id">MATCH ID</span><span className="rc-teams">TEAMS &amp; SCORE</span><span className="rc-round">ROUND</span>
          <span className="rc-date">DATE &amp; TIME</span><span className="rc-status">STATUS</span><span className="rc-actions">ACTIONS</span>
        </div>
        <div id="results-rows">
          {slice.length === 0 ? (
            <div className="empty-state">No matches found.</div>
          ) : (
            slice.map((m) => {
              const isComp = m.status === 'completed';
              const isLive = m.status === 'live';
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
                        <span className="res-team">{m.team1}</span><span className="res-vs">vs</span><span className="res-team">{m.team2}</span>
                      </>
                    )}
                  </span>
                  <span className="rc-round">{m.round}</span>
                  <span className="rc-date">
                    <span>{m.date}</span>
                    <span className={`match-time ${isLive ? 'time-live' : ''}`}>{isLive ? 'In Progress' : m.time}</span>
                  </span>
                  <span className="rc-status"><span className={`sm-status-badge ${ST_CLS[m.status] || ''}`}>{ST_LABEL[m.status] || m.status}</span></span>
                  <span className="rc-actions">
                    {isComp ? (
                      <>
                        <button className="icon-btn" title="Edit" onClick={() => openEnter(m)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="icon-btn" title="View">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                      </>
                    ) : isLive ? (
                      <button className="btn-xs btn-enter" type="button" data-match-id={m.id} onClick={() => openEnter(m)}>ENTER RESULT</button>
                    ) : (
                      <button className="btn-xs btn-enter" type="button" data-match-id={m.id} disabled={!canStartMatch(m)} onClick={() => startMatchLive(m.id)}>
                        {canStartMatch(m) ? 'START LIVE' : 'PENDING'}
                      </button>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="sub-pagination" id="results-pagination">
          <span className="pg-info">Showing {Math.min(start + 1, total)}–{Math.min(start + PAGE_SIZE, total)} of {total} matches</span>
          <div className="pg-btns">
            <button className="pg-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
            <button className="pg-btn active" onClick={() => setPage(page)}>{page}</button>
            <button className="pg-btn" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Next</button>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${modalMatch ? ' open' : ''}`} id="result-modal" style={{ display: modalMatch ? 'flex' : 'none' }}>
        <div className="modal-box">
          <div className="modal-header">
            <h3 className="modal-title">Enter Match Result</h3>
            <button className="modal-close" onClick={() => setEditMatchId(null)}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" /></svg>
            </button>
          </div>
          <div id="result-modal-body">
            {modalMatch && (
              <>
                <div className="result-teams-display">
                  <div className="result-team-block"><div className="team-avatar-sm">{modalMatch.team1[0]}</div><span>{modalMatch.team1}</span></div>
                  <div className="result-score-inputs">
                    <input type="number" id="score1-input" min="0" max="99" className="score-input" value={score1} onChange={(e) => setScore1(e.target.value)} />
                    <span className="score-sep">–</span>
                    <input type="number" id="score2-input" min="0" max="99" className="score-input" value={score2} onChange={(e) => setScore2(e.target.value)} />
                  </div>
                  <div className="result-team-block"><div className="team-avatar-sm">{modalMatch.team2[0]}</div><span>{modalMatch.team2}</span></div>
                </div>
                <div className="result-modal-actions">
                  <button className="btn-cancel" onClick={() => setEditMatchId(null)}>Cancel</button>
                  <button className="btn-submit" onClick={submitResult}>Save Result</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}


