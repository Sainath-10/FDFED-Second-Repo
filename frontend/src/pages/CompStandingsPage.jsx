import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusData } from '../services/competitionService';
import '../styles/pages/subpage.css';
import '../styles/pages/comp-standings.css';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStatus(status) {
  const map = {
    ongoing: 'ONGOING',
    upcoming: 'UPCOMING',
    completed: 'COMPLETED',
    live: 'LIVE'
  };
  return map[status] || String(status || '—').toUpperCase();
}

export default function CompStandingsPage() {
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('id') || searchParams.get('compId') || 'comp-1';

  const [comp, setComp] = useState(null);

  useEffect(() => {
    const loaded = NexusData.getCompetitionById(compId) || {
      id: compId,
      name: 'Competition',
      game: '—',
      type: 'league',
      status: 'upcoming',
      teams: [],
      matches: [],
      customPoints: {}
    };
    setComp({ ...loaded });
  }, [compId]);

  const buildStandings = (compData) => {
    if (!compData) return [];
    const teamNames = (compData.teams || []).filter(t => t.status === 'approved').map(t => t.name);
    const table = {};

    teamNames.forEach(name => {
      table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    });

    const matches = (compData.matches || []).slice();

    matches.forEach(match => {
      if (match.status !== 'completed') return;
      if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
      if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };

      const t1 = table[match.team1];
      const t2 = table[match.team2];
      t1.mp += 1;
      t2.mp += 1;

      if (match.score1 > match.score2) {
        t1.w += 1; t2.l += 1; t1.points += 3;
        t1.last5.unshift('W'); t2.last5.unshift('L');
      } else if (match.score2 > match.score1) {
        t2.w += 1; t1.l += 1; t2.points += 3;
        t1.last5.unshift('L'); t2.last5.unshift('W');
      } else {
        t1.d += 1; t2.d += 1; t1.points += 1; t2.points += 1;
        t1.last5.unshift('D'); t2.last5.unshift('D');
      }
    });

    const custom = compData.customPoints || {};

    return Object.values(table)
      .map(row => {
        const extra = custom[row.team] || 0;
        row.points = Math.max(0, row.points + extra);
        return Object.assign({}, row, { last5: row.last5.slice(0, 5) });
      })
      .sort((a, b) => (b.points - a.points) || (b.w - a.w))
      .map((row, index) => Object.assign({}, row, { rank: index + 1 }));
  };

  const updatePoints = (teamName, delta) => {
    if (!comp) return;
    const nextComp = { ...comp };
    if (!nextComp.customPoints) nextComp.customPoints = {};
    nextComp.customPoints[teamName] = (nextComp.customPoints[teamName] || 0) + delta;

    NexusData.updateCompetition(nextComp);
    setComp(nextComp);
  };

  if (!comp) return null;

  const total = comp.matches ? comp.matches.length : 0;
  const completed = comp.matches ? comp.matches.filter(m => m.status === 'completed').length : 0;
  const live = comp.matches ? comp.matches.filter(m => m.status === 'live').length : 0;
  const scheduled = comp.matches ? comp.matches.filter(m => m.status === 'scheduled').length : 0;
  const rows = buildStandings(comp);

  return (
    <Shell activeTab="activity">
      <main className="sub-main">
          <div className="sub-page-header">
            <div className="sub-header-content">
              <h1 className="sub-page-title">Standings</h1>
              <p className="sub-page-subtitle">Live leaderboard and recent results</p>
            </div>
            <Link to={`/competition-detail?id=${comp.id}`} className="btn-back" id="btn-back-to-comp">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round">
                <line x1="10" y1="3" x2="4" y2="8" />
                <line x1="4" y1="8" x2="10" y2="13" />
              </svg>
              Back to Dashboard
            </Link>
          </div>

          <div className="comp-summary-card" id="standings-summary">
            <div className="summary-icon">🏆</div>
            <div className="summary-info">
              <div className="summary-header">
                <h2 className="summary-title">{comp.name || 'Competition'}</h2>
                <span className="badge-status status-approved">{formatStatus(comp.status)}</span>
              </div>
              <div className="summary-sub">{comp.game || '—'} • {comp.format || comp.type || '—'} • {comp.dates || formatDate(comp.startDate)}</div>
              <div className="summary-stats">
                <div><span className="stat-label">TOTAL MATCHES</span><span className="stat-val-sm">{total}</span></div>
                <div><span className="stat-label">COMPLETED</span><span className="stat-val-sm stat-green">{completed}</span></div>
                <div><span className="stat-label">LIVE</span><span className="stat-val-sm">{live}</span></div>
                <div><span className="stat-label">SCHEDULED</span><span className="stat-val-sm">{scheduled}</span></div>
              </div>
            </div>
          </div>

          <div className="sub-panel">
            <div className="standings-table-header">
              <span className="col-rank">RANK</span>
              <span className="col-team">TEAM</span>
              <span className="col-mp">MP</span>
              <span className="col-w">W</span>
              <span className="col-l">L</span>
              <span className="col-d">D</span>
              <span className="col-pts">POINTS</span>
              <span className="col-last5">LAST 5</span>
            </div>
            <div id="standings-rows">
              {rows.length === 0 ? (
                <div className="empty-state">No standings yet.</div>
              ) : (
                rows.map(row => {
                  const last = row.last5.length ? row.last5 : ['-', '-', '-', '-', '-'];
                  return (
                    <div className="standings-row" key={row.team}>
                      <span className="col-rank">
                        <span className={`rank-badge ${row.rank === 1 ? 'rank-1' : ''}`}>
                          {String(row.rank).padStart(2, '0')}
                        </span>
                      </span>
                      <span className="col-team">{row.team}</span>
                      <span className="col-mp">{row.mp}</span>
                      <span className="col-w stat-green">{row.w}</span>
                      <span className="col-l">{row.l}</span>
                      <span className="col-d">{row.d}</span>
                      <span className="col-pts">
                        <span className="pts-adjuster">
                          <button
                            type="button"
                            className="pts-btn pts-inc"
                            onClick={() => updatePoints(row.team, 1)}
                            title="Add 1 point"
                          >
                            &#9650;
                          </button>
                          <span className="pts-value stat-green">{row.points}</span>
                          <button
                            type="button"
                            className="pts-btn pts-dec"
                            onClick={() => updatePoints(row.team, -1)}
                            title="Remove 1 point"
                          >
                            &#9660;
                          </button>
                        </span>
                      </span>
                      <span className="col-last5">
                        <span className="last-five">
                          {last.map((result, idx) => {
                            if (result === 'W') return <span key={idx} className="last-chip last-win">✔</span>;
                            if (result === 'L') return <span key={idx} className="last-chip last-loss">X</span>;
                            return <span key={idx} className="last-chip last-draw">-</span>;
                          })}
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
    </Shell>
  );
}
