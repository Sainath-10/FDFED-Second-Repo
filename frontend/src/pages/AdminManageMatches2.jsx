/**
 * NEXUS ESPORTS — Admin Manage Matches (…2)
 *
 *
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/pages/admin/manage-matches.css';

const MATCHES = [
  { status: 'live', pill: 'ongoing', pillLabel: '● LIVE', meta: 'Group A · Match 1', home: 'Storm Riders', away: 'Inferno Squad', score: '14 – 9', scoreCls: 'score-display-accent', time: 'Mar 10 · 18:00 IST' },
  { status: 'upcoming', pill: 'upcoming', pillLabel: 'Upcoming', meta: 'Group A · Match 2', home: 'Apex Predators', away: 'Cloud9', score: 'vs', scoreCls: 'score-display-muted', time: 'Mar 10 · 20:00 IST' },
  { status: 'completed', pill: 'completed', pillLabel: 'Completed', meta: 'Group B · Match 1', home: 'NaVi', homeWin: true, away: 'FaZe Clan', awayMuted: true, score: '16 – 8', scoreCls: '', time: 'Mar 10 · 16:00 IST' },
];

export default function AdminManageMatches2() {
  const [filter, setFilter] = useState('all');
  return (
    <main className="main-content">
      <Link to="/pages/admin/competition-detail2.html" className="back-btn-alt">← Spring Invitational</Link>
      <h1 className="admin-title-lg">Matches</h1>
      <p className="admin-subtitle-accent">Spring Invitational · Group Stage</p>

      <div className="admin-comp-tabs">
        <Link to="/pages/admin/competition-detail2.html" className="admin-tab">Overview</Link>
        <Link to="/pages/admin/manage-teams2.html" className="admin-tab">Teams</Link>
        <Link to="/pages/admin/manage-matches2.html" className="admin-tab active">Matches</Link>
        <Link to="/pages/admin/match-results2.html" className="admin-tab">Results</Link>
        <Link to="/pages/admin/view-standings.html" className="admin-tab">Standings</Link>
      </div>

      <div className="actions-bar">
        <div className="filter-tabs-row">
          {[['all', 'All'], ['upcoming', 'Upcoming'], ['live', 'Live'], ['completed', 'Completed']].map(([k, l]) => (
            <button key={k} className={`filter-tab ${filter === k ? 'active' : ''}`} data-filter={k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="matches-list-stack" id="matches-list">
        {MATCHES.filter((m) => filter === 'all' || m.status === filter).map((m) => (
          <div className="match-card-row" data-status={m.status} key={m.meta}>
            <div className="match-info-flex">
              <div className="match-status-row"><span className={`status-pill ${m.pill}`}>{m.pillLabel}</span><span className="match-meta-sm">{m.meta}</span></div>
              <div className="match-grid-display">
                <div className="team-name-bold">{m.home}{m.homeWin ? <span className="win-indicator-sm">W</span> : null}</div>
                <div className={`score-display-lg ${m.scoreCls}`}>{m.score}</div>
                <div className={m.awayMuted ? 'team-name-muted-right' : 'team-name-right'}>{m.away}</div>
              </div>
            </div>
            <div className="match-time-muted">{m.time}</div>
          </div>
        ))}
      </div>
    </main>
  );
}


