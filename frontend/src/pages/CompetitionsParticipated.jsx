/**
 * NEXUS ESPORTS — Competitions Participated
 *
 *
 * demo cards; the filter tabs show/hide by status (React state).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/competitions-participated.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
  { id: 'upcoming', label: 'Upcoming' },
];

export default function CompetitionsParticipated() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const show = (status) => filter === 'all' || filter === status;

  return (
    <main className="main-content">
      <h1 className="page-title">Competitions Participated</h1>
      <p className="page-description">All competitions you or your team have been part of.</p>

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-tab${filter === f.id ? ' active' : ''}`}
            data-filter={f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div id="comps-part-list" className="participated-list">
        {show('ongoing') && (
          <div className="comp-participation-card ongoing" data-status="ongoing">
            <div className="card-banner">
              <img src={assetUrl('b890c61489a080992ad7e99adabb1145e6d59606.png')} className="banner-img" alt="" />
              <div className="banner-overlay"></div>
              <div className="banner-content">
                <div className="banner-game-label">Counter-Strike 2</div>
                <div className="banner-title">World Championship 2026</div>
              </div>
              <span className="status-pill ongoing status-pill-absolute">● Ongoing</span>
            </div>
            <div className="card-body">
              <div className="stat-group"><div className="label">Your Team</div><div className="value">Storm Riders</div></div>
              <div className="stat-group"><div className="label">Current Round</div><div className="value accent">Quarter Finals</div></div>
              <div className="stat-group"><div className="label">W / L</div><div className="value">2 / 0</div></div>
              <div className="stat-group"><div className="label">Next Match</div><div className="value">Aug 5, 18:00</div></div>
              <div className="card-actions">
                <button className="btn-table-secondary" onClick={() => navigate('/pages/view-team.html')}>View My Team</button>
                <button className="btn-table-secondary" onClick={() => showToast('Viewing standings...')}>View Standings</button>
                <button className="btn-table-primary" onClick={() => navigate('/pages/submit-report.html')}>Submit Report</button>
              </div>
            </div>
          </div>
        )}

        {show('completed') && (
          <div className="comp-participation-card" data-status="completed">
            <div className="card-banner small">
              <img src={assetUrl('fad13be991fc17a28771191ca710b201fb3ee4fb.png')} className="banner-img" alt="" />
              <div className="banner-overlay"></div>
              <div className="banner-content">
                <div className="banner-game-label">Valorant</div>
                <div className="banner-title">Pro League Season 4</div>
              </div>
              <span className="status-pill completed status-pill-absolute">Completed</span>
            </div>
            <div className="card-body small">
              <div className="stat-group"><div className="label">Team</div><div className="value">Inferno Squad</div></div>
              <div className="stat-group"><div className="label">Result</div><div className="value muted">Semi Final</div></div>
              <div className="stat-group"><div className="label">W / L</div><div className="value">4 / 1</div></div>
              <div className="stat-group"><div className="label">Prize Won</div><div className="value accent">₹75,000</div></div>
              <div className="card-actions">
                <button className="btn-table-secondary" onClick={() => showToast('Viewing final standings...')}>View Standings</button>
              </div>
            </div>
          </div>
        )}

        {show('completed') && (
          <div className="comp-participation-card" data-status="completed">
            <div className="card-banner small">
              <img src={assetUrl('61fe8554e6377c0b431ed18f65529b1847d225cb.png')} className="banner-img" alt="" />
              <div className="banner-overlay"></div>
              <div className="banner-content">
                <div className="banner-game-label">Rocket League</div>
                <div className="banner-title">Regional Cup 2026</div>
              </div>
              <span className="status-pill completed status-pill-absolute">Completed</span>
            </div>
            <div className="card-body small">
              <div className="stat-group"><div className="label">Team</div><div className="value">Storm Riders</div></div>
              <div className="stat-group"><div className="label">Eliminated</div><div className="value muted">Semi Final</div></div>
              <div className="stat-group"><div className="label">W / L</div><div className="value">3 / 1</div></div>
              <div className="stat-group"><div className="label">Placement</div><div className="value muted">3rd / 16</div></div>
              <div className="card-actions">
                <button className="btn-table-secondary" onClick={() => showToast('Viewing standings...')}>View Standings</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


