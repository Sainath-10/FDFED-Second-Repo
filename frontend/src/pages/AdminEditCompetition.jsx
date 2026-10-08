/**
 * NEXUS ESPORTS — Admin Edit Competition
 *
 * loads the comp by
 * ?id=, populates the form, and saves name/game/description/banner/limits/dates.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/admin/edit-competition.css';

const GAMES = ['League of Legends', 'Counter-Strike 2', 'Dota 2', 'Valorant', 'Fortnite', 'Rocket League'];
const FORMATS = ['Single Elimination', 'Double Elimination', 'Round Robin', 'Group Stage + Playoffs'];

export default function AdminEditCompetition() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const compId = params.get('id') || 'sum-champ-2026';

  const comp = useMemo(() => (NexusData ? NexusData.getCompetitionById(compId) : null), [compId]);

  const [form, setForm] = useState(null);
  const [banner, setBanner] = useState('');

  useEffect(() => {
    if (!comp) return;
    sessionStorage.setItem('last_admin_comp_id', comp.id);
    const dates = String(comp.dates || '').split(' to ');
    setForm({
      name: comp.name || '',
      game: comp.game || 'League of Legends',
      desc: comp.description || '',
      format: FORMATS.includes(comp.format) ? comp.format : (comp.type === 'league' ? 'Round Robin' : 'Single Elimination'),
      regDeadline: (comp.registrationDates && comp.registrationDates.close) || '',
      startDate: dates.length === 2 ? dates[0] : '',
      endDate: dates.length === 2 ? dates[1] : '',
      maxTeams: comp.maxTeams || 16,
      maxPlayers: comp.maxPlayersPerTeam || 5,
      prizePool: String(comp.prizePool || '').replace('₹', '').replace(/,/g, ''),
    });
    setBanner(comp.img || assetUrl('7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png'));
  }, [comp]);

  const suffix = comp ? `?id=${encodeURIComponent(comp.id)}` : '';

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function onSubmit(e) {
    e.preventDefault();
    if (!comp || !form || !NexusData) return;
    const updated = {
      ...comp,
      name: form.name.trim(),
      game: form.game,
      description: form.desc.trim(),
      img: banner,
      maxTeams: parseInt(form.maxTeams, 10),
      maxPlayersPerTeam: parseInt(form.maxPlayers, 10),
      prizePool: `₹${parseInt(form.prizePool || 0, 10).toLocaleString('en-IN')}`,
      dates: `${form.startDate} to ${form.endDate}`,
      registrationDates: { ...comp.registrationDates, close: form.regDeadline },
    };
    NexusData.updateCompetition(updated);
    showToast('Competition changes saved successfully!');
    setTimeout(() => navigate(`/pages/admin/competition-detail.html?id=${encodeURIComponent(compId)}`), 1200);
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
      <Link to={`/pages/admin/competition-detail.html${suffix}`} className="back-btn-alt">← Back to Dashboard</Link>
      <h1 className="admin-title-lg">Edit Competition</h1>
      <p className="admin-subtitle-accent">{comp ? comp.name : 'Summer Championship 2026'}</p>

      <div className="admin-comp-tabs">
        <Link to={`/pages/admin/competition-detail.html${suffix}`} className="admin-tab">Overview</Link>
        <Link to={`/pages/admin/manage-teams.html${suffix}`} className="admin-tab">Manage Teams</Link>
        <Link to={`/pages/admin/manage-matches.html${suffix}`} className="admin-tab">Manage Matches</Link>
        <Link to={`/pages/admin/match-results.html${suffix}`} className="admin-tab">Match Results</Link>
        <Link to={`/pages/admin/view-standings.html${suffix}`} className="admin-tab">Standings</Link>
        <Link to={`/pages/admin/dispute-review.html${suffix}`} className="admin-tab">Disputes</Link>
        <Link to={`/pages/admin/edit-competition.html${suffix}`} className="admin-tab active">Edit</Link>
      </div>

      {!comp && <p style={{ color: 'var(--text-muted)', padding: 30, textAlign: 'center' }}>Competition not found.</p>}

      {comp && form && (
        <div className="layout-wrapper">
          <div className="form-container-card">
            <form id="edit-form" className="edit-form-stack" onSubmit={onSubmit}>
              <div className="section-divider-title">Basic Information</div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">Competition Name</label>
                <input className="form-input" type="text" id="edit-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-game">Game</label>
                  <select className="form-select" id="edit-game" value={form.game} onChange={(e) => set('game', e.target.value)}>
                    {GAMES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-format">Format</label>
                  <select className="form-select" id="edit-format" value={form.format} onChange={(e) => set('format', e.target.value)}>
                    {FORMATS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-desc">Description</label>
                <textarea className="form-textarea notes-textarea-sm" id="edit-desc" value={form.desc} onChange={(e) => set('desc', e.target.value)} />
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

              <div className="section-divider-title section-divider-title-mt">Dates &amp; Capacity</div>

              <div className="form-grid-2col">
                <div className="form-group"><label className="form-label" htmlFor="edit-start-date">Start Date</label><input className="form-input" type="date" id="edit-start-date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
                <div className="form-group"><label className="form-label" htmlFor="edit-end-date">End Date</label><input className="form-input" type="date" id="edit-end-date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
                <div className="form-group"><label className="form-label" htmlFor="edit-max-teams">Max Teams</label><input className="form-input" type="number" id="edit-max-teams" min="1" value={form.maxTeams} onChange={(e) => set('maxTeams', e.target.value)} /></div>
                <div className="form-group"><label className="form-label" htmlFor="edit-max-players">Max Players per Team</label><input className="form-input" type="number" id="edit-max-players" min="1" value={form.maxPlayers} onChange={(e) => set('maxPlayers', e.target.value)} /></div>
                <div className="form-group"><label className="form-label" htmlFor="edit-reg-deadline">Registration Deadline</label><input className="form-input" type="date" id="edit-reg-deadline" value={form.regDeadline} onChange={(e) => set('regDeadline', e.target.value)} /></div>
                <div className="form-group"><label className="form-label" htmlFor="edit-prize-pool">Prize Pool (₹)</label><input className="form-input" type="text" id="edit-prize-pool" value={form.prizePool} onChange={(e) => set('prizePool', e.target.value)} /></div>
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
                <Link to={`/pages/admin/manage-teams.html${suffix}`} className="btn-table-secondary btn-sidebar-full">Manage Teams</Link>
                <Link to={`/pages/admin/manage-matches.html${suffix}`} className="btn-table-secondary btn-sidebar-full">Manage Matches</Link>
                <Link to={`/pages/admin/view-standings.html${suffix}`} className="btn-table-secondary btn-sidebar-full">View Standings</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


