import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import '../../styles/pages/admin/edit-competition.css';

export default function AdminEditCompPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(NexusAuth.getSession());
  const [comp, setComp] = useState(null);

  const paramId = searchParams.get('id') || sessionStorage.getItem('last_admin_comp_id');

  // Form states
  const [name, setName] = useState('');
  const [game, setGame] = useState('League of Legends');
  const [format, setFormat] = useState('Single Elimination');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('/assets/7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxTeams, setMaxTeams] = useState(16);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [regDeadline, setRegDeadline] = useState('');
  const [prizePool, setPrizePool] = useState('0');

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

      setName(found.name || '');
      setGame(found.game || 'League of Legends');
      setDescription(found.description || '');
      setFormat(found.type === 'league' ? 'Round Robin' : (found.format || 'Single Elimination'));
      if (found.img) setBannerUrl(found.img);

      if (found.registrationDates) {
        setRegDeadline(found.registrationDates.close || '');
      }

      if (found.dates) {
        const parts = found.dates.split(' to ');
        if (parts.length === 2) {
          setStartDate(parts[0]);
          setEndDate(parts[1]);
        }
      }

      setMaxTeams(found.maxTeams || 16);
      setMaxPlayers(found.maxPlayersPerTeam || 5);
      setPrizePool((found.prizePool || '').replace('₹', '').replace(/,/g, '') || '0');
    }
  }, [paramId]);

  function handleBannerUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setBannerUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!comp) return;

    const prizeNum = parseInt(prizePool || '0', 10);
    const updated = {
      ...comp,
      name: name.trim(),
      game: game,
      format: format,
      description: description.trim(),
      img: bannerUrl,
      maxTeams: parseInt(maxTeams, 10),
      maxPlayersPerTeam: parseInt(maxPlayers, 10),
      prizePool: '₹' + (isNaN(prizeNum) ? 0 : prizeNum).toLocaleString('en-IN'),
      dates: `${startDate} to ${endDate}`,
      registrationDates: {
        ...(comp.registrationDates || {}),
        close: regDeadline
      }
    };

    if (NexusData && typeof NexusData.updateCompetition === 'function') {
      NexusData.updateCompetition(updated);
    }

    alert('Competition changes saved successfully!');
    navigate(`/admin/competition-detail?id=${encodeURIComponent(comp.id)}`);
  }

  function handleDelete() {
    if (window.confirm('Delete this competition? This cannot be undone.')) {
      if (NexusData && typeof NexusData.deleteCompetition === 'function') {
        NexusData.deleteCompetition(comp.id);
      }
      alert('Competition deleted.');
      navigate('/admin/dashboard');
    }
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

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="competitions">
      <main className="main-content">
        <Link to="/admin/dashboard" className="back-btn-alt">← Back to Dashboard</Link>
        <h1 className="admin-title-lg">Edit Competition</h1>
        <p className="admin-subtitle-accent">{comp.name}</p>

        <div className="admin-comp-tabs">
          <Link to={`/admin/competition-detail?id=${encodeURIComponent(compId)}`} className="admin-tab">Overview</Link>
          <Link to={`/admin/manage-teams?id=${encodeURIComponent(compId)}`} className="admin-tab">Manage Teams</Link>
          <Link to={`/admin/manage-matches?id=${encodeURIComponent(compId)}`} className="admin-tab">Manage Matches</Link>
          <Link to={`/admin/match-results?id=${encodeURIComponent(compId)}`} className="admin-tab">Match Results</Link>
          <Link to={`/admin/view-standings?id=${encodeURIComponent(compId)}`} className="admin-tab">Standings</Link>
          <Link to={`/admin/dispute-review?id=${encodeURIComponent(compId)}`} className="admin-tab">Disputes</Link>
          <Link to={`/admin/edit-competition?id=${encodeURIComponent(compId)}`} className="admin-tab active">Edit</Link>
        </div>

        <div className="layout-wrapper">
          <div className="form-container-card">
            <form id="edit-form" className="edit-form-stack" onSubmit={handleSubmit}>
              <div className="section-divider-title">Basic Information</div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">Competition Name</label>
                <input
                  className="form-input"
                  type="text"
                  id="edit-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-game">Game</label>
                  <select
                    className="form-select"
                    id="edit-game"
                    value={game}
                    onChange={e => setGame(e.target.value)}
                  >
                    <option>League of Legends</option>
                    <option>Counter-Strike 2</option>
                    <option>Dota 2</option>
                    <option>Valorant</option>
                    <option>Fortnite</option>
                    <option>Rocket League</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-format">Format</label>
                  <select
                    className="form-select"
                    id="edit-format"
                    value={format}
                    onChange={e => setFormat(e.target.value)}
                  >
                    <option>Single Elimination</option>
                    <option>Double Elimination</option>
                    <option>Round Robin</option>
                    <option>Group Stage + Playoffs</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-desc">Description</label>
                <textarea
                  className="form-textarea notes-textarea-sm"
                  id="edit-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="section-divider-title section-divider-title-mt">Banner Image</div>

              <div className="banner-preview-wrap">
                <img id="banner-preview" src={bannerUrl} alt="Banner Preview" className="banner-img-preview" />
                <div className="banner-actions-overlay">
                  <button type="button" className="btn-table-primary" onClick={() => document.getElementById('banner-upload').click()}>Replace</button>
                  <button type="button" className="btn-table-danger" onClick={() => setBannerUrl('')}>Remove</button>
                </div>
                <input
                  type="file"
                  id="banner-upload"
                  accept="image/*"
                  className="hidden-file-input"
                  style={{ display: 'none' }}
                  onChange={handleBannerUpload}
                />
              </div>

              <div className="section-divider-title section-divider-title-mt">Dates & Capacity</div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-start-date">Start Date</label>
                  <input className="form-input" type="date" id="edit-start-date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-end-date">End Date</label>
                  <input className="form-input" type="date" id="edit-end-date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-max-teams">Max Teams</label>
                  <input className="form-input" type="number" id="edit-max-teams" min="1" value={maxTeams} onChange={e => setMaxTeams(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-max-players">Max Players per Team</label>
                  <input className="form-input" type="number" id="edit-max-players" min="1" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-reg-deadline">Registration Deadline</label>
                  <input className="form-input" type="date" id="edit-reg-deadline" value={regDeadline} onChange={e => setRegDeadline(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-prize-pool">Prize Pool (₹)</label>
                  <input className="form-input" type="text" id="edit-prize-pool" value={prizePool} onChange={e => setPrizePool(e.target.value)} />
                </div>
              </div>

              <div className="form-actions-row">
                <button type="submit" className="btn-primary btn-save-full">Save Changes</button>
                <button type="button" className="btn-outline btn-cancel-fixed" onClick={() => navigate('/admin/dashboard')}>Cancel & Discard</button>
              </div>

              <div className="danger-zone-block">
                <div className="danger-zone-title">Danger Zone</div>
                <button type="button" className="btn-table-danger btn-cancel-fixed" onClick={handleDelete}>Delete Competition</button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </Shell>
  );
}
