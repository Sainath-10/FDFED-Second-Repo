import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/manage-matches.css';

export default function AdminManageMatchesPage() {
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(NexusAuth.getSession());
  const [comp, setComp] = useState(null);
  const [filter, setFilter] = useState('all');

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

  function generateDefaultMatches(c) {
    const teams = (c.teams || []).filter(t => !t.status || t.status === 'approved');
    if (teams.length < 2) return [];

    const matches = [];
    for (let i = 0; i < teams.length - 1; i += 2) {
      const t1 = teams[i].name || `Team ${i + 1}`;
      const t2 = teams[i + 1].name || `Team ${i + 2}`;
      matches.push({
        id: `match_${i}`,
        round: `Group Stage · Match ${Math.floor(i / 2) + 1}`,
        team1: t1,
        team2: t2,
        score1: i === 0 ? 16 : 0,
        score2: i === 0 ? 12 : 0,
        status: i === 0 ? 'completed' : (i === 2 ? 'live' : 'upcoming'),
        time: 'Today, 18:00 IST'
      });
    }
    return matches;
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
  const rawMatches = Array.isArray(comp.matches) && comp.matches.length > 0 ? comp.matches : generateDefaultMatches(comp);
  const filteredMatches = rawMatches.filter(m => {
    if (filter === 'upcoming') return m.status === 'upcoming';
    if (filter === 'live') return m.status === 'live';
    if (filter === 'completed') return m.status === 'completed';
    return true;
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

        <h1 className="admin-title-lg">Matches</h1>
        <p className="admin-subtitle-accent" id="matches-subtitle">
          {comp.name} · {comp.format || 'Group Stage'}
        </p>

        {/* Admin Tabs */}
        <div className="admin-comp-tabs">
          <Link to={`/admin/competition-detail?id=${encodeURIComponent(compId)}`} className="admin-tab">Overview</Link>
          <Link to={`/admin/manage-teams?id=${encodeURIComponent(compId)}`} className="admin-tab">Teams</Link>
          <Link to={`/admin/manage-matches?id=${encodeURIComponent(compId)}`} className="admin-tab active">Matches</Link>
          <Link to={`/admin/match-results?id=${encodeURIComponent(compId)}`} className="admin-tab">Results</Link>
          <Link to={`/admin/view-standings?id=${encodeURIComponent(compId)}`} className="admin-tab">Standings</Link>
        </div>

        <div className="actions-bar">
          <div className="filter-tabs-row">
            <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`filter-tab ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
            <button className={`filter-tab ${filter === 'live' ? 'active' : ''}`} onClick={() => setFilter('live')}>Live</button>
            <button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Completed</button>
          </div>
        </div>

        <div className="matches-list-stack" id="matches-list">
          {filteredMatches.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #9aa4b2)', padding: '50px 20px', background: '#0a0a0a', borderRadius: '14px', border: '1px solid #262626' }}>
              <div style={{ fontSize: '36px', marginBottom: '14px' }}>🎮</div>
              <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#fff' }}>No matches scheduled yet</p>
              <span style={{ fontSize: '13px' }}>
                Approve teams to auto-generate match schedules for <strong style={{ color: 'var(--accent, #c6ff33)' }}>{comp.name}</strong>.
              </span>
            </div>
          ) : (
            filteredMatches.map((m, idx) => {
              const status = m.status || 'upcoming';
              const isLive = status === 'live';
              const isDone = status === 'completed';

              const badgeStyle = isLive
                ? { background: 'rgba(198,255,51,0.12)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)' }
                : isDone
                ? { background: 'rgba(255,255,255,0.06)', color: '#9aa4b2', border: '1px solid rgba(255,255,255,0.1)' }
                : { background: 'rgba(100,200,255,0.08)', color: '#64c8ff', border: '1px solid rgba(100,200,255,0.2)' };

              const badgeLabel = isLive ? '● LIVE' : isDone ? '✓ FINAL' : '⌛ UPCOMING';

              return (
                <div key={m.id || idx} style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '12px', padding: '18px 22px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{m.round || `Match #${idx + 1}`}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                      <span>{m.team1 || (m.teamA?.name) || 'Team 1'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>vs</span>
                      <span>{m.team2 || (m.teamB?.name) || 'Team 2'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {(isLive || isDone) && (
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#c6ff33' }}>
                        {m.score1 !== undefined ? `${m.score1} – ${m.score2}` : '0 – 0'}
                      </div>
                    )}
                    <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, ...badgeStyle }}>
                      {badgeLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </Shell>
  );
}
