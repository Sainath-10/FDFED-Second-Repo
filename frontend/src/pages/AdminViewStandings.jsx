/**
 * NEXUS ESPORTS — Admin View Standings
 *
 * resolves the current
 * competition and renders a standings table from its approved teams.
 */
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import '../styles/pages/admin/view-standings.css';

function resolveComp(id) {
  const all = NexusData ? NexusData.loadCompetitions() : [];
  let comp = null;
  if (id && all.length) comp = all.find((c) => String(c.id) === String(id));
  const stored = sessionStorage.getItem('last_admin_comp_id');
  if (!comp && !id && stored && all.length) comp = all.find((c) => String(c.id) === String(stored));
  if (!comp && all.length) comp = all[0];
  return comp;
}

export default function AdminViewStandings() {
  const [params] = useSearchParams();
  const comp = useMemo(() => resolveComp(params.get('id')), [params]);

  useEffect(() => {
    if (comp) sessionStorage.setItem('last_admin_comp_id', comp.id);
  }, [comp]);

  const teams = (comp && comp.teams ? comp.teams : []).filter((t) => !t.status || t.status === 'approved');
  const suffix = comp ? `?id=${encodeURIComponent(comp.id)}` : '';

  const rows = teams.map((t, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'rank-num gold' : (rank === 2 ? 'rank-num silver' : (rank === 3 ? 'rank-num bronze' : 'rank-num'));
    const wins = t.wins !== undefined ? t.wins : (idx === 0 ? 3 : (idx === 1 ? 2 : 1));
    const losses = t.losses !== undefined ? t.losses : (idx === 0 ? 0 : (idx === 1 ? 1 : 2));
    return { rank, rankClass, name: t.name || `Team ${rank}`, wins, losses, pts: wins * 3 };
  });

  return (
    <main className="main-content">
      <Link to="/pages/admin/dashboard.html" className="back-btn-alt">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Dashboard
      </Link>

      <h1 className="admin-title-lg">Standings</h1>
      <p className="admin-subtitle-accent" id="standings-subtitle">{comp ? `${comp.name} · Current Tournament Rankings` : 'Loading rankings...'}</p>

      <div className="admin-comp-tabs">
        <Link id="tab-overview" to={`/pages/admin/competition-detail.html${suffix}`} className="admin-tab">Overview</Link>
        <Link id="tab-teams" to={`/pages/admin/manage-teams.html${suffix}`} className="admin-tab">Teams</Link>
        <Link id="tab-matches" to={`/pages/admin/manage-matches.html${suffix}`} className="admin-tab">Matches</Link>
        <Link id="tab-results" to={`/pages/admin/match-results.html${suffix}`} className="admin-tab">Results</Link>
        <Link id="tab-standings" to={`/pages/admin/view-standings.html${suffix}`} className="admin-tab active">Standings</Link>
      </div>

      <div id="standings-container">
        {!comp && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Competition not found.</p>}
        {comp && rows.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted,#9aa4b2)', padding: '40px 20px', background: '#0d1117', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ margin: '0 0 8px' }}>No approved teams registered for <strong>{comp.name}</strong>.</p>
            <span style={{ fontSize: 13 }}>Rankings and standings will be generated once teams are approved and matches conclude.</span>
          </div>
        )}
        {comp && rows.length > 0 && (
          <div className="standings-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            <div className="standings-card-wrap">
              <div className="standings-card-header">{comp.name} — Standings</div>
              <table className="standings-table">
                <thead>
                  <tr><th>#</th><th className="text-left-align">Team</th><th>W</th><th>L</th><th>Pts</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td><span className={r.rankClass}>{r.rank}</span></td>
                      <td className="text-left-align team-name-white"><strong>{r.name}</strong></td>
                      <td>{r.wins}</td>
                      <td>{r.losses}</td>
                      <td className="score-pts-accent">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


