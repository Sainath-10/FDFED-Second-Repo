/**
 * NEXUS ESPORTS — Admin Manage Matches
 *
 * dynamic matches list
 * (comp.matches or generated round-robin pairs) with status filter tabs.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import '../styles/pages/admin/manage-matches.css';

function generateDefaultMatchesForComp(comp) {
  const teams = (comp.teams || []).filter((t) => !t.status || t.status === 'approved');
  if (teams.length < 2) return [];
  const matches = [];
  for (let i = 0; i < teams.length - 1; i += 2) {
    const t1 = teams[i].name || `Team ${i + 1}`;
    const t2 = teams[i + 1] ? (teams[i + 1].name || `Team ${i + 2}`) : 'BYE';
    matches.push({
      id: `m_${comp.id}_${i}`,
      team1: t1,
      team2: t2,
      stage: `Round 1 · Match ${Math.floor(i / 2) + 1}`,
      status: i === 0 && comp.status === 'ongoing' ? 'live' : 'upcoming',
      score1: i === 0 && comp.status === 'ongoing' ? 14 : undefined,
      score2: i === 0 && comp.status === 'ongoing' ? 9 : undefined,
      time: comp.dates || 'Upcoming',
    });
  }
  return matches;
}

export default function AdminManageMatches() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState('all');

  const comp = useMemo(() => {
    const all = NexusData ? NexusData.loadCompetitions() : [];
    const id = params.get('id') || sessionStorage.getItem('last_admin_comp_id');
    let c = id && all.length ? all.find((x) => String(x.id) === String(id)) : null;
    if (!c && all.length) c = all[0];
    return c;
  }, [params]);

  useEffect(() => {
    if (comp) sessionStorage.setItem('last_admin_comp_id', comp.id);
  }, [comp]);

  const suffix = comp ? `?id=${encodeURIComponent(comp.id)}` : '';
  const matches = comp ? (Array.isArray(comp.matches) && comp.matches.length > 0 ? comp.matches : generateDefaultMatchesForComp(comp)) : [];

  return (
    <main className="main-content">
      <Link to="/pages/admin/dashboard.html" className="back-btn-alt">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
        Back to Dashboard
      </Link>

      <h1 className="admin-title-lg">Matches</h1>
      <p className="admin-subtitle-accent" id="matches-subtitle">{comp ? `${comp.name} · ${comp.format || 'Group Stage'}` : 'Loading matches...'}</p>

      <div className="admin-comp-tabs">
        <Link id="tab-overview" to={`/pages/admin/competition-detail.html${suffix}`} className="admin-tab">Overview</Link>
        <Link id="tab-teams" to={`/pages/admin/manage-teams.html${suffix}`} className="admin-tab">Teams</Link>
        <Link id="tab-matches" to={`/pages/admin/manage-matches.html${suffix}`} className="admin-tab active">Matches</Link>
        <Link id="tab-results" to={`/pages/admin/match-results.html${suffix}`} className="admin-tab">Results</Link>
        <Link id="tab-standings" to={`/pages/admin/view-standings.html${suffix}`} className="admin-tab">Standings</Link>
      </div>

      <div className="actions-bar">
        <div className="filter-tabs-row">
          {[['all', 'All'], ['upcoming', 'Upcoming'], ['live', 'Live'], ['completed', 'Completed']].map(([k, l]) => (
            <button key={k} className={`filter-tab ${filter === k ? 'active' : ''}`} data-filter={k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="matches-list-stack" id="matches-list">
        {!comp && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>Competition not found.</p>}
        {comp && matches.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted,#9aa4b2)', padding: '50px 20px', background: '#0a0a0a', borderRadius: 14, border: '1px solid #262626' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🎮</div>
            <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#fff' }}>No matches scheduled yet</p>
            <span style={{ fontSize: 13 }}>Approve teams to auto-generate match schedules for <strong style={{ color: 'var(--accent,#c6ff33)' }}>{comp.name}</strong>.</span>
          </div>
        )}
        {matches.filter((m) => filter === 'all' || (m.status || 'upcoming') === filter).map((m, idx) => {
          const status = m.status || 'upcoming';
          const isLive = status === 'live';
          const isDone = status === 'completed';
          const badgeStyle = isLive
            ? 'background:rgba(198,255,51,0.12);color:#c6ff33;border:1px solid rgba(198,255,51,0.3);'
            : isDone
              ? 'background:rgba(255,255,255,0.06);color:#9aa4b2;border:1px solid rgba(255,255,255,0.1);'
              : 'background:rgba(100,200,255,0.08);color:#64c8ff;border:1px solid rgba(100,200,255,0.2);';
          const badgeLabel = isLive ? '● LIVE' : isDone ? '✓ FINAL' : '⌛ UPCOMING';
          const team1 = m.team1 || m.homeTeam || 'Team A';
          const team2 = m.team2 || m.awayTeam || 'Team B';
          const hasScore = (isLive || isDone) && m.score1 !== undefined && m.score2 !== undefined;
          const s1 = hasScore ? m.score1 : null;
          const s2 = hasScore ? m.score2 : null;
          const t1Win = hasScore && s1 > s2;
          const t2Win = hasScore && s2 > s1;
          const stage = m.stage || `Match ${idx + 1}`;
          const time = m.scheduledAt || m.time || 'TBD';
          return (
            <div className="match-card-row" data-status={status} key={m.id || idx} style={{ position: 'relative', overflow: 'hidden' }}>
              {isLive && <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: '#c6ff33', borderRadius: '3px 0 0 3px' }}></div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, padding: '4px 10px', borderRadius: 20, ...Object.fromEntries(badgeStyle.split(';').filter(Boolean).map((p) => { const [k, v] = p.split(':'); return [k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]; })) }}>{badgeLabel}</span>
                  <span style={{ fontSize: 12, color: '#9aa4b2', fontWeight: 600 }}>{stage}</span>
                </div>
                <span style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>{time}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t1Win ? '#c6ff33' : '#fff', letterSpacing: 0.5 }}>{team1}</div>
                  {t1Win && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#c6ff33' }}>WINNER</span>}
                </div>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  {hasScore
                    ? <div style={{ fontFamily: 'var(--font-display,monospace)', fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>{s1}<span style={{ color: '#333', margin: '0 4px' }}>–</span>{s2}</div>
                    : <div style={{ fontSize: 18, fontWeight: 800, color: '#444', letterSpacing: 3 }}>VS</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t2Win ? '#c6ff33' : '#fff', letterSpacing: 0.5 }}>{team2}</div>
                  {t2Win && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#c6ff33', textAlign: 'right' }}>WINNER</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}


