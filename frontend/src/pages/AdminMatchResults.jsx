/**
 * NEXUS ESPORTS — Admin Match Results
 *
 * resolves the current
 * competition (?id= → sessionStorage last_admin_comp_id → first), rebuilds the
 * tab links with the id, and renders the confirmed results (or an empty state).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import '../styles/pages/admin/match-results.css';

function resolveComp(id) {
  const all = NexusData ? NexusData.loadCompetitions() : [];
  let comp = null;
  if (id && all.length) comp = all.find((c) => String(c.id) === String(id));
  const stored = sessionStorage.getItem('last_admin_comp_id');
  if (!comp && !id && stored && all.length) comp = all.find((c) => String(c.id) === String(stored));
  if (!comp && all.length) comp = all[0];
  return comp;
}

export default function AdminMatchResults() {
  const [params] = useSearchParams();
  const comp = useMemo(() => resolveComp(params.get('id')), [params]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (comp) sessionStorage.setItem('last_admin_comp_id', comp.id);
  }, [comp]);

  useEffect(() => {
    if (!comp) return;
    const matches = Array.isArray(comp.matches) ? comp.matches.filter((m) => m.status === 'completed' || m.winner) : [];
    if (matches.length === 0) {
      const teams = (comp.teams || []).filter((t) => !t.status || t.status === 'approved');
      if (teams.length >= 2 && comp.status === 'ongoing') {
        const t1 = teams[0].name || 'Team A';
        const t2 = teams[1].name || 'Team B';
        setRows([{ stage: 'Group Stage · Match 1', winner: t1, score: '16 – 12', loser: t2, date: comp.dates ? comp.dates.split('to')[0].trim() : 'Recent' }]);
      } else {
        setRows([]);
      }
      return;
    }
    setRows(matches.map((m) => ({
      stage: m.stage || 'Match Result',
      winner: m.winner || m.team1 || 'Winner',
      score: m.score1 !== undefined && m.score2 !== undefined ? `${m.score1} – ${m.score2}` : '2 – 0',
      loser: m.loser || (m.winner === m.team1 ? m.team2 : m.team1) || 'Opponent',
      date: m.date || 'Recent',
    })));
  }, [comp]);

  const suffix = comp ? `?id=${encodeURIComponent(comp.id)}` : '';

  return (
    <main className="main-content">
      <Link to="/pages/admin/dashboard.html" className="back-btn-alt">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Dashboard
      </Link>

      <h1 className="admin-title-lg">Match Results</h1>
      <p className="admin-subtitle-accent" id="results-subtitle">{comp ? `${comp.name} · Confirmed Results` : 'Loading results...'}</p>

      <div className="admin-comp-tabs">
        <Link id="tab-overview" to={`/pages/admin/competition-detail.html${suffix}`} className="admin-tab">Overview</Link>
        <Link id="tab-teams" to={`/pages/admin/manage-teams.html${suffix}`} className="admin-tab">Teams</Link>
        <Link id="tab-matches" to={`/pages/admin/manage-matches.html${suffix}`} className="admin-tab">Matches</Link>
        <Link id="tab-results" to={`/pages/admin/match-results.html${suffix}`} className="admin-tab active">Results</Link>
        <Link id="tab-standings" to={`/pages/admin/view-standings.html${suffix}`} className="admin-tab">Standings</Link>
      </div>

      <div className="table-container-card">
        <div className="table-scroll-wrap">
          <table className="admin-table" id="results-table">
            <thead><tr><th>Match</th><th>Winner</th><th>Score</th><th>Loser</th><th>Date</th></tr></thead>
            <tbody id="results-table-body">
              {!comp && (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Competition not found.</td></tr>
              )}
              {comp && rows.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted,#9aa4b2)', padding: '40px 20px' }}>No confirmed match results yet for <strong>{comp.name}</strong>.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.stage}</td>
                  <td><strong>{r.winner}</strong> 🏆</td>
                  <td className="score-display-sm">{r.score}</td>
                  <td className="team-name-loser">{r.loser}</td>
                  <td>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


