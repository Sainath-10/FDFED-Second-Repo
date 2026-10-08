/**
 * NEXUS ESPORTS — Competition Standings
 *
 * organizer standings view
 * with the summary card, computed table and manual ±1 point adjustments
 * (customPoints) that persist to the shared competition store.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import '../styles/pages/subpage.css';
import '../styles/pages/comp-standings.css';

const STATUS_MAP = { ongoing: 'ONGOING', upcoming: 'UPCOMING', completed: 'COMPLETED', live: 'LIVE' };

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatStatus = (status) => STATUS_MAP[status] || String(status || '—').toUpperCase();

function buildStandings(compData) {
  const teamNames = (compData.teams || []).filter((t) => t.status === 'approved').map((t) => t.name);
  const table = {};
  teamNames.forEach((name) => { table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] }; });

  (compData.matches || []).forEach((match) => {
    if (match.status !== 'completed') return;
    if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    const t1 = table[match.team1];
    const t2 = table[match.team2];
    t1.mp += 1; t2.mp += 1;
    if (match.score1 > match.score2) {
      t1.w += 1; t2.l += 1; t1.points += 3; t1.last5.unshift('W'); t2.last5.unshift('L');
    } else if (match.score2 > match.score1) {
      t2.w += 1; t1.l += 1; t2.points += 3; t1.last5.unshift('L'); t2.last5.unshift('W');
    } else {
      t1.d += 1; t2.d += 1; t1.points += 1; t2.points += 1; t1.last5.unshift('D'); t2.last5.unshift('D');
    }
  });

  const custom = compData.customPoints || {};
  return Object.values(table)
    .map((row) => {
      const extra = custom[row.team] || 0;
      row.points = Math.max(0, row.points + extra);
      return { ...row, last5: row.last5.slice(0, 5) };
    })
    .sort((a, b) => (b.points - a.points) || (b.w - a.w))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export default function CompStandings() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const [version, setVersion] = useState(0);

  const comp = useMemo(() => {
    if (!id || !NexusData) return null;
    return NexusData.getCompetitionById(id) || { id, name: 'Competition', game: '—', type: 'league', status: 'upcoming', teams: [], matches: [], customPoints: {} };
  }, [id, version]);

  if (!comp) return <main className="sub-main"><h1 className="sub-page-title">Standings</h1></main>;

  const matches = comp.matches || [];
  const total = matches.length;
  const completed = matches.filter((m) => m.status === 'completed').length;
  const live = matches.filter((m) => m.status === 'live').length;
  const scheduled = matches.filter((m) => m.status === 'scheduled').length;
  const rows = buildStandings(comp);

  function updatePoints(teamName, delta) {
    if (!NexusData) return;
    const fresh = NexusData.getCompetitionById(id);
    if (!fresh) return;
    if (!fresh.customPoints) fresh.customPoints = {};
    fresh.customPoints[teamName] = (fresh.customPoints[teamName] || 0) + delta;
    if (typeof NexusData.updateCompetition === 'function') NexusData.updateCompetition(fresh);
    setVersion((v) => v + 1);
  }

  return (
    <main className="sub-main">
      <div className="sub-page-header">
        <div className="sub-header-content">
          <h1 className="sub-page-title">Standings</h1>
          <p className="sub-page-subtitle">Live leaderboard and recent results</p>
        </div>
        <Link className="btn-back" id="btn-back-to-comp" to={`/pages/competition-detail.html?id=${id}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
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
          <span className="col-rank">RANK</span><span className="col-team">TEAM</span><span className="col-mp">MP</span>
          <span className="col-w">W</span><span className="col-l">L</span><span className="col-d">D</span>
          <span className="col-pts">POINTS</span><span className="col-last5">LAST 5</span>
        </div>
        <div id="standings-rows">
          {rows.length === 0 ? (
            <div className="empty-state">No standings yet.</div>
          ) : (
            rows.map((row) => {
              const last = row.last5.length ? row.last5 : ['-', '-', '-', '-', '-'];
              return (
                <div className="standings-row" key={row.team}>
                  <span className="col-rank"><span className={`rank-badge ${row.rank === 1 ? 'rank-1' : ''}`}>{String(row.rank).padStart(2, '0')}</span></span>
                  <span className="col-team">{row.team}</span>
                  <span className="col-mp">{row.mp}</span>
                  <span className="col-w stat-green">{row.w}</span>
                  <span className="col-l">{row.l}</span>
                  <span className="col-d">{row.d}</span>
                  <span className="col-pts">
                    <span className="pts-adjuster">
                      <button className="pts-btn pts-inc" title="Add 1 point" onClick={() => updatePoints(row.team, 1)}>▲</button>
                      <span className="pts-value stat-green">{row.points}</span>
                      <button className="pts-btn pts-dec" title="Remove 1 point" onClick={() => updatePoints(row.team, -1)}>▼</button>
                    </span>
                  </span>
                  <span className="col-last5">
                    <span className="last-five">
                      {last.map((r, i) => (
                        r === 'W' ? <span className="last-chip last-win" key={i}>✔</span>
                          : r === 'L' ? <span className="last-chip last-loss" key={i}>X</span>
                            : <span className="last-chip last-draw" key={i}>-</span>
                      ))}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}


