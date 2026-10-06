import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/manage-teams.css';

export default function AdminManageTeamsPage() {
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(NexusAuth.getSession());
  const [comp, setComp] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const paramId = searchParams.get('id') || sessionStorage.getItem('last_admin_comp_id');

  useEffect(() => {
    loadData();
  }, [paramId]);

  function loadData() {
    const allComps = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    let found = null;
    if (paramId && allComps.length > 0) {
      found = allComps.find(c => String(c.id) === String(paramId));
    }
    if (!found && allComps.length > 0) {
      found = allComps[0];
    }
    if (found) {
      sessionStorage.setItem('last_admin_comp_id', found.id);
      setComp(found);
    }
  }

  function handleRevokeTeam(teamId) {
    if (!comp) return;
    if (!window.confirm("Revoke this team's approval?")) return;

    const team = (comp.teams || []).find(t => String(t.id) === String(teamId));
    if (team) {
      team.status = 'rejected';
      if (NexusData && typeof NexusData.updateCompetition === 'function') {
        NexusData.updateCompetition(comp);
      }
    }
    loadData();
    alert('Team approval revoked.');
  }

  function handleApproveTeam(teamId) {
    if (!comp) return;
    const team = (comp.teams || []).find(t => String(t.id) === String(teamId));
    if (team) {
      team.status = 'approved';
      if (NexusData && typeof NexusData.updateCompetition === 'function') {
        NexusData.updateCompetition(comp);
      }
    }
    loadData();
    alert('Team approved.');
  }

  const role = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = role.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';

  if (!comp) {
    return (
      <Shell sidebarVariant={sidebarVariant} activePage="competitions">
        <main className="main-content">
          <Link to="/admin/dashboard" className="back-btn-alt">← Back to Dashboard</Link>
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Competition not found.</div>
        </main>
      </Shell>
    );
  }

  const compId = comp.id;
  const teams = Array.isArray(comp.teams) ? comp.teams : [];
  const filteredTeams = teams.filter(t => {
    const q = searchTerm.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) || (t.region || '').toLowerCase().includes(q);
  });

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="competitions">
      <main className="main-content">
        <Link to="/admin/dashboard" className="back-btn-alt">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4"/>
          </svg>
          Back to Dashboard
        </Link>

        <h1 className="admin-title-lg">Teams</h1>
        <p className="admin-subtitle-accent" id="teams-subtitle">
          {comp.name} · {teams.length} Registered
        </p>

        {/* Admin Tabs */}
        <div className="admin-comp-tabs">
          <Link to={`/admin/competition-detail?id=${encodeURIComponent(compId)}`} className="admin-tab">Overview</Link>
          <Link to={`/admin/manage-teams?id=${encodeURIComponent(compId)}`} className="admin-tab active">Teams</Link>
          <Link to={`/admin/manage-matches?id=${encodeURIComponent(compId)}`} className="admin-tab">Matches</Link>
          <Link to={`/admin/match-results?id=${encodeURIComponent(compId)}`} className="admin-tab">Results</Link>
          <Link to={`/admin/view-standings?id=${encodeURIComponent(compId)}`} className="admin-tab">Standings</Link>
        </div>

        <div className="teams-header-row">
          <div className="search-bar teams-search-wrap">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
            </svg>
            <input
              type="text"
              id="teams-search-input"
              placeholder="Search teams…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container-card">
          <div className="table-scroll-wrap">
            <table className="admin-table" id="teams-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Players</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="teams-table-body">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted, #9aa4b2)', padding: '40px 20px' }}>
                      No teams registered yet for <strong>{comp.name}</strong>.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team, idx) => {
                    const teamName = team.name || `Team ${idx + 1}`;
                    const players = team.players ? `${team.players}/${comp.maxPlayersPerTeam || 5}` : (team.members ? `${team.members.length}/${comp.maxPlayersPerTeam || 5}` : '5/5');
                    const region = team.region || team.location || 'Global';
                    const status = team.status || 'approved';
                    const registeredDate = team.createdAt ? new Date(team.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Jul 10';

                    return (
                      <tr key={team.id || idx}>
                        <td><strong>{teamName}</strong></td>
                        <td>{players}</td>
                        <td>{region}</td>
                        <td>
                          {status === 'approved' && <span className="status-pill approved">Approved</span>}
                          {status === 'pending' && <span className="status-pill pending">Pending</span>}
                          {status !== 'approved' && status !== 'pending' && <span className="status-pill rejected">Rejected</span>}
                        </td>
                        <td>{registeredDate}</td>
                        <td className="table-actions">
                          {status === 'approved' && (
                            <button type="button" className="btn-table-danger" onClick={() => handleRevokeTeam(team.id || idx)}>
                              Revoke
                            </button>
                          )}
                          {status === 'pending' && (
                            <button type="button" className="btn-table-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleApproveTeam(team.id || idx)}>
                              Approve
                            </button>
                          )}
                          {status !== 'approved' && status !== 'pending' && '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </Shell>
  );
}
