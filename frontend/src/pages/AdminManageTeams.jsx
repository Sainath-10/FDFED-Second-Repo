/**
 * NEXUS ESPORTS — Admin Manage Teams
 *
 * dynamic teams table with
 * search, approve/revoke (persisted via NexusData.updateCompetition).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/admin/manage-teams.css';

export default function AdminManageTeams() {
  const [params] = useSearchParams();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');

  const comp = useMemo(() => {
    const all = NexusData ? NexusData.loadCompetitions() : [];
    const id = params.get('id') || sessionStorage.getItem('last_admin_comp_id');
    let c = id && all.length ? all.find((x) => String(x.id) === String(id)) : null;
    if (!c && all.length) c = all[0];
    return c;
  }, [params, version]);

  useEffect(() => {
    if (comp) sessionStorage.setItem('last_admin_comp_id', comp.id);
  }, [comp]);

  const suffix = comp ? `?id=${encodeURIComponent(comp.id)}` : '';
  const teams = comp && Array.isArray(comp.teams) ? comp.teams : [];

  function setTeamStatus(teamId, status) {
    if (!comp) return;
    const team = (comp.teams || []).find((t) => String(t.id) === String(teamId));
    if (team) {
      team.status = status;
      if (NexusData && NexusData.updateCompetition) NexusData.updateCompetition(comp);
    }
    setVersion((v) => v + 1);
    showToast(status === 'approved' ? 'Team approved.' : 'Team approval revoked.', status === 'approved' ? 'success' : 'error');
  }

  const q = query.trim().toLowerCase();

  return (
    <main className="main-content">
      <Link to="/pages/admin/dashboard.html" className="back-btn-alt">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Dashboard
      </Link>

      <h1 className="admin-title-lg">Teams</h1>
      <p className="admin-subtitle-accent" id="teams-subtitle">{comp ? `${comp.name} · ${teams.length} Registered` : 'Loading teams...'}</p>

      <div className="admin-comp-tabs">
        <Link id="tab-overview" to={`/pages/admin/competition-detail.html${suffix}`} className="admin-tab">Overview</Link>
        <Link id="tab-teams" to={`/pages/admin/manage-teams.html${suffix}`} className="admin-tab active">Teams</Link>
        <Link id="tab-matches" to={`/pages/admin/manage-matches.html${suffix}`} className="admin-tab">Matches</Link>
        <Link id="tab-results" to={`/pages/admin/match-results.html${suffix}`} className="admin-tab">Results</Link>
        <Link id="tab-standings" to={`/pages/admin/view-standings.html${suffix}`} className="admin-tab">Standings</Link>
      </div>

      <div className="teams-header-row">
        <div className="search-bar teams-search-wrap">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
          <input type="text" id="teams-search-input" placeholder="Search teams…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="table-container-card">
        <div className="table-scroll-wrap">
          <table className="admin-table" id="teams-table">
            <thead><tr><th>Team</th><th>Players</th><th>Region</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead>
            <tbody id="teams-table-body">
              {!comp && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Competition not found.</td></tr>}
              {comp && teams.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted,#9aa4b2)', padding: '40px 20px' }}>No teams registered yet for <strong>{comp.name}</strong>.</td></tr>}
              {teams.map((team, idx) => {
                const teamName = team.name || `Team ${idx + 1}`;
                const players = team.players ? `${team.players}/${comp.maxPlayersPerTeam || 5}` : (team.members ? `${team.members.length}/${comp.maxPlayersPerTeam || 5}` : '5/5');
                const region = team.region || team.location || 'Global';
                const status = team.status || 'approved';
                const regDate = team.createdAt ? new Date(team.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Jul 10';
                if (q && !`${teamName} ${players} ${region} ${status} ${regDate}`.toLowerCase().includes(q)) return null;
                return (
                  <tr key={team.id || idx} data-team-id={team.id || idx}>
                    <td><strong>{teamName}</strong></td>
                    <td>{players}</td>
                    <td>{region}</td>
                    <td>{status === 'approved' ? <span className="status-pill approved">Approved</span> : status === 'pending' ? <span className="status-pill pending">Pending</span> : <span className="status-pill rejected">Rejected</span>}</td>
                    <td>{regDate}</td>
                    <td className="table-actions">
                      {status === 'approved' && <button className="btn-table-danger" onClick={() => { if (window.confirm("Revoke this team's approval?")) setTeamStatus(team.id || idx, 'rejected'); }}>Revoke</button>}
                      {status === 'pending' && <button className="btn-table-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setTeamStatus(team.id || idx, 'approved')}>Approve</button>}
                      {status !== 'approved' && status !== 'pending' ? '—' : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


