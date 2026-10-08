/**
 * NEXUS ESPORTS — Admin Competition Detail (…2)
 *
 *
 */
import { Link } from 'react-router-dom';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/admin/competition-detail.css';

export default function AdminCompetitionDetail2() {
  return (
    <main className="main-content">
      <Link to="/pages/admin/dashboard.html" className="back-btn-alt">← Back to Dashboard</Link>
      <div className="admin-header-row">
        <div>
          <h1 className="admin-title-lg">Spring Invitational</h1>
          <p className="admin-subtitle-accent">Counter-Strike 2 · Upcoming · Jun 15–20, 2026</p>
        </div>
        <div className="header-actions-group">
          <Link to="/pages/admin/edit-competition2.html" className="btn-table-secondary">Edit Competition</Link>
          <p className="admin-subtitle-accent">Counter-Strike 2 · Ongoing · Mar 10–12, 2026</p>
        </div>
      </div>

      <div className="admin-comp-tabs">
        <Link to="/pages/admin/competition-detail2.html" className="admin-tab active">Overview</Link>
        <Link to="/pages/admin/manage-teams2.html" className="admin-tab">Teams</Link>
        <Link to="/pages/admin/manage-matches2.html" className="admin-tab">Matches</Link>
        <Link to="/pages/admin/match-results2.html" className="admin-tab">Results</Link>
        <Link to="/pages/admin/view-standings.html" className="admin-tab">Standings</Link>
      </div>

      <div className="dash-stats stats-grid-gap">
        <div className="dash-stat-card"><div className="dash-stat-icon stat-icon-wrap">👥</div><div><div className="dash-stat-num">64</div><div className="dash-stat-lbl">Registered</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon stat-icon-warn">⏳</div><div><div className="dash-stat-num">8</div><div className="dash-stat-lbl">Pending</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon stat-icon-success">✅</div><div><div className="dash-stat-num">56</div><div className="dash-stat-lbl">Approved</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon stat-icon-info">🎮</div><div><div className="dash-stat-num">3</div><div className="dash-stat-lbl">Days Left</div></div></div>
      </div>

      <div className="layout-wrapper">
        <div className="content-stack">
          <div className="banner-card">
            <img src={assetUrl('7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png')} className="banner-img-wide" alt="Banner" />
            <div className="banner-gradient-overlay"></div>
            <div className="banner-text-content">
              <div className="banner-label-sm">Counter-Strike 2</div>
              <div className="banner-title-md">Spring Invitational</div>
            </div>
          </div>
        </div>

        <div className="sidebar-sticky-stack">
          <div className="comp-sidebar-block">
            <h3>Competition Details</h3>
            <div className="info-row"><span className="key">Status</span><span className="val stat-val-accent">Ongoing</span></div>
            <div className="info-row"><span className="key">Game</span><span className="val">Counter-Strike 2</span></div>
            <div className="info-row"><span className="key">Format</span><span className="val">Double Elimination</span></div>
            <div className="info-row"><span className="key">Max Teams</span><span className="val">64</span></div>
            <div className="info-row"><span className="key">Date</span><span className="val">Mar 10–12, 2026</span></div>
            <div className="info-row"><span className="key">Location</span><span className="val">Online</span></div>
            <div className="info-row"><span className="key">Prize Pool</span><span className="val prize-val-lg">$25,000</span></div>
          </div>
          <div className="comp-sidebar-block sidebar-btns-stack">
            <Link to="/pages/admin/manage-matches2.html" className="btn-table-primary btn-sidebar-full">Manage Matches</Link>
            <Link to="/pages/admin/view-standings.html" className="btn-table-secondary btn-sidebar-full">View Standings</Link>
            <Link to="/pages/admin/match-results2.html" className="btn-table-secondary btn-sidebar-full">Match Results</Link>
          </div>
        </div>
      </div>
    </main>
  );
}


