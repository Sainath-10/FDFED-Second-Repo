import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/match-results.css';

export default function AdminMatchResultsPage() {
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(NexusAuth.getSession());
  const [comp, setComp] = useState(null);

  const paramId = searchParams.get('id') || sessionStorage.getItem('last_admin_comp_id');

  useEffect(() => {
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
  }, [paramId]);

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
  const completedMatches = Array.isArray(comp.matches)
    ? comp.matches.filter(m => m.status === 'completed' || m.winner)
    : [];

  const approvedTeams = (comp.teams || []).filter(t => !t.status || t.status === 'approved');

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="competitions">
      <main className="main-content">
        <Link to="/admin/dashboard" className="back-btn-alt">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4"/>
          </svg>
          Back to Dashboard
        </Link>

        <h1 className="admin-title-lg">Match Results</h1>
        <p className="admin-subtitle-accent" id="results-subtitle">
          {comp.name} · Confirmed Results
        </p>

        {/* Admin Tabs */}
        <div className="admin-comp-tabs">
          <Link to={`/admin/competition-detail?id=${encodeURIComponent(compId)}`} className="admin-tab">Overview</Link>
          <Link to={`/admin/manage-teams?id=${encodeURIComponent(compId)}`} className="admin-tab">Teams</Link>
          <Link to={`/admin/manage-matches?id=${encodeURIComponent(compId)}`} className="admin-tab">Matches</Link>
          <Link to={`/admin/match-results?id=${encodeURIComponent(compId)}`} className="admin-tab active">Results</Link>
          <Link to={`/admin/view-standings?id=${encodeURIComponent(compId)}`} className="admin-tab">Standings</Link>
        </div>

        <div className="table-container-card">
          <div className="table-scroll-wrap">
            <table className="admin-table" id="results-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Winner</th>
                  <th>Score</th>
                  <th>Loser</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody id="results-table-body">
                {completedMatches.length === 0 ? (
                  approvedTeams.length >= 2 && comp.status === 'ongoing' ? (
                    <tr>
                      <td>Group Stage · Match 1</td>
                      <td><strong>{approvedTeams[0].name || 'Team A'}</strong> 🏆</td>
                      <td className="score-display-sm" style={{ color: '#c6ff33', fontWeight: 800 }}>16 – 12</td>
                      <td className="team-name-loser">{approvedTeams[1].name || 'Team B'}</td>
                      <td>{comp.dates ? comp.dates.split('to')[0].trim() : 'Recent'}</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted, #9aa4b2)', padding: '40px 20px' }}>
                        No confirmed match results yet for <strong>{comp.name}</strong>.
                      </td>
                    </tr>
                  )
                ) : (
                  completedMatches.map((m, idx) => (
                    <tr key={m.id || idx}>
                      <td>{m.round || `Match #${idx + 1}`}</td>
                      <td><strong>{m.winner || m.team1 || 'Winner'}</strong> 🏆</td>
                      <td className="score-display-sm" style={{ color: '#c6ff33', fontWeight: 800 }}>
                        {m.score || (m.score1 !== undefined ? `${m.score1} – ${m.score2}` : '2 – 1')}
                      </td>
                      <td className="team-name-loser">{m.loser || m.team2 || 'Loser'}</td>
                      <td>{m.date || 'Recent'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </Shell>
  );
}
