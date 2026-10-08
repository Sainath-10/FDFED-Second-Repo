/**
 * NEXUS ESPORTS — Admin Edit Competition (…2)
 *
 *
 * banner preview/remove).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/admin/edit-competition2.css';

export default function AdminEditCompetition2() {
  const navigate = useNavigate();
  const [banner, setBanner] = useState(assetUrl('7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png'));

  function onSubmit(e) {
    e.preventDefault();
    showToast('Competition changes saved successfully!');
  }

  function previewBanner(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setBanner(ev.target.result);
    r.readAsDataURL(f);
  }

  return (
    <main className="main-content">
      <Link to="/pages/admin/competition-detail2.html" className="back-btn-alt">← Back to Dashboard</Link>
      <h1 className="admin-title-lg">Edit Competition</h1>
      <p className="admin-subtitle-accent">Spring Invitational</p>

      <div className="admin-comp-tabs">
        <Link to="/pages/admin/competition-detail2.html" className="admin-tab">Overview</Link>
        <Link to="/pages/admin/manage-teams2.html" className="admin-tab">Manage Teams</Link>
        <Link to="/pages/admin/manage-matches2.html" className="admin-tab">Manage Matches</Link>
        <Link to="/pages/admin/match-results2.html" className="admin-tab">Match Results</Link>
        <Link to="/pages/admin/view-standings.html" className="admin-tab">Standings</Link>
        <Link to="/pages/admin/dispute-review2.html" className="admin-tab">Disputes</Link>
        <Link to="/pages/admin/edit-competition2.html" className="admin-tab active">Edit</Link>
      </div>

      <div className="layout-wrapper">
        <div className="form-container-card">
          <form id="edit-form" className="edit-form-stack" onSubmit={onSubmit}>
            <div className="section-divider-title">Basic Information</div>

            <div className="form-group">
              <label className="form-label">Competition Name</label>
              <input className="form-input" type="text" defaultValue="Spring Invitational" />
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label">Game</label>
                <select className="form-select" defaultValue="Counter-Strike 2">
                  <option>Counter-Strike 2</option>
                  <option>Dota 2</option>
                  <option>Valorant</option>
                  <option>Fortnite</option>
                  <option>Rocket League</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Format</label>
                <select className="form-select" defaultValue="Double Elimination">
                  <option>Single Elimination</option>
                  <option>Double Elimination</option>
                  <option>Round Robin</option>
                  <option>Group Stage + Playoffs</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea notes-textarea-sm" defaultValue="The Spring Invitational is our flagship Counter-Strike 2 tournament featuring the top teams from across South Asia and Southeast Asia." />
            </div>

            <div className="section-divider-title section-divider-title-mt">Banner Image</div>

            <div className="banner-preview-wrap">
              {banner ? <img id="banner-preview" src={banner} className="banner-img-preview" alt="Banner" /> : null}
              <div className="banner-actions-overlay">
                <button type="button" className="btn-table-primary" onClick={() => document.getElementById('banner-upload')?.click()}>Replace</button>
                <button type="button" className="btn-table-danger" onClick={() => { setBanner(''); showToast('Banner removed.', 'error'); }}>Remove</button>
              </div>
              <input type="file" id="banner-upload" accept="image/*" className="hidden-file-input" onChange={previewBanner} />
            </div>

            <div className="section-divider-title section-divider-title-mt">Dates & Capacity</div>

            <div className="form-grid-2col">
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" defaultValue="2026-06-15" /></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" defaultValue="2026-06-20" /></div>
              <div className="form-group"><label className="form-label">Max Teams</label><select className="form-select" defaultValue="128"><option>64</option><option>128</option><option>256</option></select></div>
              <div className="form-group"><label className="form-label">Prize Pool ($)</label><input className="form-input" type="text" defaultValue="50000" /></div>
            </div>

            <div className="form-actions-row">
              <button type="submit" className="btn-primary btn-save-full">Save Changes</button>
              <button type="button" className="btn-outline btn-cancel-fixed" onClick={() => navigate('/pages/admin/dashboard.html')}>Cancel &amp; Discard</button>
            </div>

            <div className="danger-zone-block">
              <div className="danger-zone-title">Danger Zone</div>
              <button type="button" className="btn-table-danger btn-cancel-fixed" onClick={() => { if (window.confirm('Delete this competition? This cannot be undone.')) showToast('Competition deleted.', 'error'); }}>Delete Competition</button>
            </div>
          </form>
        </div>

        <div className="sidebar-sticky-stack">
          <div className="comp-sidebar-block">
            <h3>Edit Settings</h3>
            <div className="guidelines-stack">
              <p>✅ Changes take effect immediately upon saving.</p>
              <p>✅ Registered teams will be notified of date changes.</p>
              <p>⚠️ Changing game type may affect registered teams.</p>
              <p>❌ Reducing max teams will not auto-remove registered teams.</p>
            </div>
          </div>
          <div className="comp-sidebar-block">
            <h3>Quick Navigation</h3>
            <div className="nav-btns-stack">
              <Link to="/pages/admin/manage-teams2.html" className="btn-table-secondary btn-sidebar-full">Manage Teams</Link>
              <Link to="/pages/admin/manage-matches2.html" className="btn-table-secondary btn-sidebar-full">Manage Matches</Link>
              <Link to="/pages/admin/view-standings.html" className="btn-table-secondary btn-sidebar-full">View Standings</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


