import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/view-standings.css';

export default function AdminViewStandingsPage() {
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

        <h1 className="admin-title-lg">Standings</h1>
        <p className="admin-subtitle-accent" id="standings-subtitle">
          {comp.name} · Current Tournament Rankings
        </p>

        {/* Admin Tabs */}
        <div className="admin-comp-tabs">
          <Link to={`/admin/competition-detail?id=${encodeURIComponent(compId)}`} className="admin-tab">Overview</Link>
          <Link to={`/admin/manage-teams?id=${encodeURIComponent(compId)}`} className="admin-tab">Teams</Link>
          <Link to={`/admin/manage-matches?id=${encodeURIComponent(compId)}`} className="admin-tab">Matches</Link>
          <Link to={`/admin/match-results?id=${encodeURIComponent(compId)}`} className="admin-tab">Results</Link>
          <Link to={`/admin/view-standings?id=${encodeURIComponent(compId)}`} className="admin-tab active">Standings</Link>
        </div>

        <div id="standings-container">
          {approvedTeams.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #9aa4b2)', padding: '40px 20px', background: '#0d1117', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ margin: '0 0 8px' }}>No approved teams registered for <strong>{comp.name}</strong>.</p>
              <span style={{ fontSize: '13px' }}>Rankings and standings will be generated once teams are approved and matches conclude.</span>
            </div>
          ) : (
            <div className="table-container-card">
              <div className="table-scroll-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th style={{ textAlign: 'left' }}>Team</th>
                      <th>Wins</th>
                      <th>Losses</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedTeams.map((t, idx) => {
                      const rank = idx + 1;
                      const rankClass = rank === 1 ? 'rank-num gold' : (rank === 2 ? 'rank-num silver' : (rank === 3 ? 'rank-num bronze' : 'rank-num'));
                      const wins = t.wins !== undefined ? t.wins : (idx === 0 ? 3 : (idx === 1 ? 2 : 1));
                      const losses = t.losses !== undefined ? t.losses : (idx === 0 ? 0 : (idx === 1 ? 1 : 2));
                      const pts = wins * 3;

                      return (
                        <tr key={t.id || idx}>
                          <td><span className={rankClass}>{rank}</span></td>
                          <td style={{ textAlign: 'left' }} className="team-name-white">
                            <strong>{t.name || `Team ${rank}`}</strong>
                          </td>
                          <td>{wins}</td>
                          <td>{losses}</td>
                          <td className="score-pts-accent" style={{ color: '#c6ff33', fontWeight: 800 }}>{pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
