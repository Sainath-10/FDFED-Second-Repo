/**
 * NEXUS ESPORTS — Admin Manage Teams (…2)
 *
 *
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import '../styles/pages/admin/manage-teams.css';

const TEAMS = [
  { name: 'Storm Riders', players: '5/5', region: 'South Asia', status: 'pending', statusLabel: 'Pending', reg: 'Jul 10' },
  { name: 'Inferno Squad', players: '5/5', region: 'Southeast Asia', status: 'pending', statusLabel: 'Pending', reg: 'Jul 11' },
  { name: 'Tidal Wave', players: '4/5', region: 'South Asia', status: 'pending', statusLabel: 'Pending', reg: 'Jul 12' },
  { name: 'Apex Predators', players: '5/5', region: 'Europe', status: 'approved', statusLabel: 'Approved', reg: 'Jul 8', revokable: true },
  { name: 'Cloud9', players: '5/5', region: 'North America', status: 'approved', statusLabel: 'Approved', reg: 'Jul 7', revokable: true },
  { name: 'NaVi', players: '5/5', region: 'Europe', status: 'approved', statusLabel: 'Approved', reg: 'Jul 6', revokable: true },
  { name: 'FaZe Clan', players: '5/5', region: 'Europe', status: 'approved', statusLabel: 'Approved', reg: 'Jul 5', revokable: true },
  { name: 'Team Liquid', players: '5/5', region: 'North America', status: 'rejected', statusLabel: 'Rejected', reg: 'Jul 4' },
];

export default function AdminManageTeams2() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = TEAMS.filter((t) => !q || `${t.name} ${t.players} ${t.region} ${t.statusLabel} ${t.reg}`.toLowerCase().includes(q));

  return (
    <main className="main-content">
      <Link to="/pages/admin/competition-detail2.html" className="back-btn-alt">← Spring Invitational</Link>
      <h1 className="admin-title-lg">Teams</h1>
      <p className="admin-subtitle-accent">Spring Invitational · 64 Registered</p>

      <div className="admin-comp-tabs">
        <Link to="/pages/admin/competition-detail2.html" className="admin-tab">Overview</Link>
        <Link to="/pages/admin/manage-teams2.html" className="admin-tab active">Teams</Link>
        <Link to="/pages/admin/manage-matches2.html" className="admin-tab">Matches</Link>
        <Link to="/pages/admin/match-results2.html" className="admin-tab">Results</Link>
        <Link to="/pages/admin/view-standings.html" className="admin-tab">Standings</Link>
      </div>

      <div className="teams-header-row">
        <div className="search-bar teams-search-wrap">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
          <input type="text" placeholder="Search teams…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="table-container-card">
        <div className="table-scroll-wrap">
          <table className="admin-table" id="teams-table">
            <thead><tr><th>Team</th><th>Players</th><th>Region</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.name}>
                  <td><strong>{t.name}</strong></td>
                  <td>{t.players}</td>
                  <td>{t.region}</td>
                  <td><span className={`status-pill ${t.status}`}>{t.statusLabel}</span></td>
                  <td>{t.reg}</td>
                  <td className="table-actions">
                    {t.revokable ? (
                      <button className="btn-table-danger" onClick={() => { showToast('Team approval revoked.', 'error'); }}>Revoke</button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


