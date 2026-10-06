import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import { NexusAuth } from '../services/authService';
import '../styles/pages/edit-competition.css';

export default function EditCompetitionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const id = searchParams.get('id');
  const [comp, setComp] = useState(() => (id ? NexusData.getCompetitionById(id) : null));

  // Form states
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [type, setType] = useState('tournament');
  const [format, setFormat] = useState('Single Elimination');
  const [status, setStatus] = useState('upcoming');
  const [description, setDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [prize, setPrize] = useState('');
  const [maxTeams, setMaxTeams] = useState(16);
  const [season, setSeason] = useState('Season 1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [regDeadline, setRegDeadline] = useState('');
  const [coOrganizers, setCoOrganizers] = useState([]);
  const [bannerUrl, setBannerUrl] = useState('');

  // Modals
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/my-activity', { replace: true });
      return;
    }
    const found = NexusData.getCompetitionById(id);
    if (!found) {
      showToast('Competition not found.', 'error');
      navigate('/my-activity', { replace: true });
      return;
    }

    setComp(found);
    setName(found.name || '');
    setGame(found.game || '');
    setType(found.type || 'tournament');
    setFormat(found.format || 'Single Elimination');
    setStatus(found.status || 'upcoming');
    setDescription(found.description || '');
    setMaxPlayers(found.maxPlayersPerTeam || 5);
    setPrize(String(found.prizePool || '').replace(/[₹,\s]/g, '') || '');
    setMaxTeams(found.maxTeams || 16);
    setSeason(found.season || 'Season 1');
    setStartDate(found.startDate || '');
    setEndDate(found.endDate || '');
    setRegDeadline(found.regDeadline || '');
    setBannerUrl(found.img || '');

    const creator = found.createdBy || found.organizerId;
    const coOrgs = Array.isArray(found.organizers)
      ? found.organizers.filter(u => u !== creator)
      : [];
    setCoOrganizers(coOrgs);

    if (found.ended || found.status === 'completed') {
      setIsEnded(true);
    }
  }, [id, navigate, showToast]);

  const handleBannerUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File too large. Max 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBannerUrl(ev.target.result);
      showToast('Banner updated (preview only).', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBanner = () => {
    setBannerUrl('');
  };

  const addCoOrganizerRow = () => {
    setCoOrganizers([...coOrganizers, '']);
  };

  const updateCoOrganizer = (index, value) => {
    const copy = [...coOrganizers];
    copy[index] = value;
    setCoOrganizers(copy);
  };

  const removeCoOrganizer = (index) => {
    setCoOrganizers(coOrganizers.filter((_, i) => i !== index));
  };

  const formatDateDisplay = (start, end) => {
    if (!start) return '';
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!e) return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  };

  const handleSave = () => {
    if (!comp) return;
    if (!name.trim()) {
      showToast('Competition name is required.', 'error');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      showToast('End date must be after start date.', 'error');
      return;
    }

    const prizePool = prize.trim() ? (prize.trim().startsWith('₹') ? prize.trim() : `₹${prize.trim()}`) : comp.prizePool;
    let dates = comp.dates;
    if (startDate || endDate) {
      dates = formatDateDisplay(startDate, endDate) || dates;
    }

    const cleanCoOrgs = coOrganizers
      .map(s => s.trim().replace(/^@/, ''))
      .filter(Boolean);

    const creator = comp.createdBy || comp.organizerId || 'organizer';
    const organizersList = Array.from(new Set([creator, ...cleanCoOrgs]));

    const updated = {
      ...comp,
      name: name.trim(),
      game,
      type,
      format,
      status,
      description: description.trim(),
      maxPlayersPerTeam: parseInt(maxPlayers) || comp.maxPlayersPerTeam,
      prizePool,
      maxTeams: parseInt(maxTeams) || comp.maxTeams,
      season: season.trim() || comp.season,
      dates,
      startDate: startDate || comp.startDate,
      endDate: endDate || comp.endDate,
      regDeadline: regDeadline || comp.regDeadline,
      organizers: organizersList,
      img: bannerUrl || comp.img,
    };

    NexusData.updateCompetition(updated);
    setComp(updated);
    showToast('Changes saved successfully!', 'success');
  };

  const handleConfirmEnd = () => {
    if (!comp) return;
    const ended = {
      ...comp,
      status: 'completed',
      ended: true,
      endedAt: new Date().toISOString(),
    };
    NexusData.updateCompetition(ended);
    setComp(ended);
    setStatus('completed');
    setIsEnded(true);
    setIsEndOpen(false);
    showToast('Competition ended. All actions are now locked.', 'success');
  };

  const handleConfirmDelete = () => {
    if (!comp) return;
    NexusData.deleteCompetition(comp.id);

    try {
      const key = 'nexus.deleted.competitionIds';
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed : [];
      if (!ids.includes(comp.id)) ids.push(comp.id);
      localStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {}

    setIsDeleteOpen(false);
    showToast('Competition deleted.');
    setTimeout(() => {
      navigate('/my-activity');
    }, 1000);
  };

  if (!comp) {
    return (
      <Shell activeItem="activity">
        <main className="edit-main" style={{ padding: '32px' }}>
          <h2>Competition Not Found</h2>
        </main>
      </Shell>
    );
  }

  const statusMap = {
    upcoming: { label: 'Upcoming', dot: 'dot-upcoming', pct: 60 },
    ongoing: { label: 'Ongoing', dot: '', pct: 85 },
    completed: { label: 'Completed', dot: 'dot-completed', pct: 100 },
  };
  const sInfo = statusMap[status] || statusMap.upcoming;

  return (
    <Shell activeItem="activity">
      <main className="edit-main">
        {/* Page Header */}
        <div className="edit-page-header">
          <div className="edit-header-left">
            <Link className="btn-back" id="btn-back-to-comp" to={`/competition-detail?id=${comp.id}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="10" y1="3" x2="4" y2="8" />
                <line x1="4" y1="8" x2="10" y2="13" />
              </svg>
              Back to Dashboard
            </Link>
            <div>
              <h1 className="edit-page-title">Edit Competition</h1>
              <p className="edit-page-subtitle" id="edit-page-subtitle">{comp.name}</p>
            </div>
          </div>
        </div>

        {/* Ended Banner if applicable */}
        {isEnded && (
          <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', letterSpacing: '0.5px' }}>
            🏁 This competition has ended. All editing and actions are locked.
          </div>
        )}

        {/* Two-column layout */}
        <div className="edit-body">
          {/* LEFT: Main form */}
          <div className="edit-col-main">
            {/* Competition Details */}
            <div className="edit-panel">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Competition Details
              </div>

              <div className="edit-form-group">
                <label className="edit-label">Competition Name</label>
                <input
                  type="text"
                  className="edit-input"
                  id="ef-name"
                  value={name}
                  disabled={isEnded}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Championship 2026"
                />
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Game</label>
                  <select
                    className="edit-select"
                    id="ef-game"
                    value={game}
                    disabled={isEnded}
                    onChange={(e) => setGame(e.target.value)}
                  >
                    <option value="">Select Game</option>
                    <option>League of Legends</option>
                    <option>Counter-Strike 2</option>
                    <option>Valorant</option>
                    <option>Dota 2</option>
                    <option>Rocket League</option>
                    <option>Apex Legends</option>
                    <option>Fortnite</option>
                    <option>Overwatch 2</option>
                    <option>Street Fighter 6</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Competition Type</label>
                  <select
                    className="edit-select"
                    id="ef-type"
                    value={type}
                    disabled={isEnded}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="tournament">Single Elimination</option>
                    <option value="league">Round Robin</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-group">
                <label className="edit-label">Description</label>
                <textarea
                  className="edit-textarea"
                  id="ef-description"
                  rows="4"
                  value={description}
                  disabled={isEnded}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your competition..."
                />
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Prize Pool (RUPEES)</label>
                  <div className="edit-input-prefix-wrap">
                    <span className="edit-input-prefix">₹</span>
                    <input
                      type="number"
                      className="edit-input edit-input-prefixed"
                      id="ef-prize"
                      value={prize}
                      disabled={isEnded}
                      onChange={(e) => setPrize(e.target.value)}
                      placeholder="50000"
                      min="0"
                    />
                  </div>
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Max Players per Team</label>
                  <input
                    type="number"
                    className="edit-input"
                    id="ef-maxplayers"
                    value={maxPlayers}
                    disabled={isEnded}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    placeholder="5"
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Start Date</label>
                  <input
                    type="date"
                    className="edit-input"
                    id="ef-startdate"
                    value={startDate}
                    disabled={isEnded}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">End Date</label>
                  <input
                    type="date"
                    className="edit-input"
                    id="ef-enddate"
                    value={endDate}
                    disabled={isEnded}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Max Teams</label>
                  <input
                    type="number"
                    className="edit-input"
                    id="ef-maxteams"
                    value={maxTeams}
                    disabled={isEnded}
                    onChange={(e) => setMaxTeams(e.target.value)}
                    placeholder="32"
                    min="2"
                    max="512"
                  />
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Registration Deadline</label>
                  <input
                    type="date"
                    className="edit-input"
                    id="ef-regdeadline"
                    value={regDeadline}
                    disabled={isEnded}
                    onChange={(e) => setRegDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Format</label>
                  <select
                    className="edit-select"
                    id="ef-format"
                    value={format}
                    disabled={isEnded}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option>Round Robin</option>
                    <option>Single Elimination</option>
                    <option>Double Elimination</option>
                    <option>Swiss</option>
                  </select>
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Season</label>
                  <input
                    type="text"
                    className="edit-input"
                    id="ef-season"
                    value={season}
                    disabled={isEnded}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="Season 1"
                  />
                </div>
              </div>
            </div>

            {/* Co-Organizers Management */}
            <div className="edit-panel">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Tournament Co-Organizers
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Co-organizers share tournament management and dispute resolution permissions.
                </span>
                {!isEnded && (
                  <button
                    type="button"
                    className="btn-table-secondary"
                    id="btn-edit-add-coorganizer"
                    onClick={addCoOrganizerRow}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(198,255,51,0.3)', color: '#c6ff33', cursor: 'pointer', background: 'transparent' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    + Add Co-Organizer
                  </button>
                )}
              </div>

              <div id="edit-coorganizers-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {coOrganizers.map((coOrg, idx) => (
                  <div key={idx} className="edit-coorganizer-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>
                        @
                      </span>
                      <input
                        type="text"
                        className="edit-input edit-coorganizer-input"
                        placeholder="e.g. co_organizer_username or ID"
                        value={coOrg}
                        disabled={isEnded}
                        onChange={(e) => updateCoOrganizer(idx, e.target.value)}
                        style={{ paddingLeft: '28px', width: '100%' }}
                      />
                    </div>
                    {!isEnded && (
                      <button
                        type="button"
                        className="btn-table-danger"
                        onClick={() => removeCoOrganizer(idx)}
                        style={{ padding: '10px 14px', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        title="Remove co-organizer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Competition Banner */}
            <div className="edit-panel">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Competition Banner
              </div>
              <div className="edit-banner-preview" id="edit-banner-preview">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner preview" style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block', borderRadius: '10px' }} />
                ) : (
                  <div className="edit-banner-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a3a4a" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p>No banner uploaded</p>
                    <span>Recommended: 1920×1080px · Max 5MB (JPG, PNG)</span>
                  </div>
                )}
              </div>
              {!isEnded && (
                <div className="edit-banner-actions">
                  <label className="edit-btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                    </svg>
                    Replace
                    <input type="file" id="banner-upload" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handleBannerUpload} />
                  </label>
                  <button className="edit-btn-outline edit-btn-danger-outline" id="btn-remove-banner" onClick={handleRemoveBanner}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    Remove
                  </button>
                </div>
              )}
              <p className="edit-hint">Recommended size: 1920×1080px. Max 5MB (JPG, PNG)</p>
            </div>
          </div>

          {/* RIGHT: Status panel + Save */}
          <div className="edit-col-side">
            {/* Live Status */}
            <div className="edit-panel edit-panel-status">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Live Status
              </div>

              <div className="edit-status-row">
                <div className={`edit-status-dot ${sInfo.dot}`} id="status-dot"></div>
                <span className="edit-status-label" id="status-label">{sInfo.label}</span>
                <span className="edit-status-time" id="status-time">
                  Last updated: {comp.createdDaysAgo != null ? `${comp.createdDaysAgo}d ago` : 'recently'}
                </span>
              </div>

              <div className="edit-progress-bar-wrap">
                <div className="edit-progress-bar">
                  <div className="edit-progress-fill" id="status-progress" style={{ width: `${sInfo.pct}%` }}></div>
                </div>
                <span className="edit-progress-label" id="status-progress-label">
                  Profile completeness: {sInfo.pct}%
                </span>
              </div>

              <div className="edit-form-group" style={{ marginTop: '4px' }}>
                <label className="edit-label">Competition Status</label>
                <select
                  className="edit-select"
                  id="ef-status"
                  value={status}
                  disabled={isEnded}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Save / Discard */}
            {!isEnded && (
              <>
                <button className="edit-btn-save edit-btn-save-full" id="btn-save-main" onClick={handleSave}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  SAVE CHANGES
                </button>
                <Link to={`/competition-detail?id=${comp.id}`} className="edit-btn-discard edit-btn-discard-full" id="btn-discard-2" style={{ textAlign: 'center', textDecoration: 'none' }}>
                  Cancel &amp; Discard
                </Link>
              </>
            )}

            {/* End Competition */}
            {!isEnded && (
              <div className="edit-panel" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.05)' }} id="end-comp-panel">
                <div className="edit-panel-title" style={{ color: '#fb923c' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  End Competition
                </div>
                <p className="edit-danger-desc" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Ending this competition marks it as completed. All actions (matches, team approvals, disputes) will be locked. This cannot be undone.
                </p>
                <button
                  className="edit-btn-delete"
                  id="btn-end-comp"
                  onClick={() => setIsEndOpen(true)}
                  style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  END COMPETITION
                </button>
              </div>
            )}

            {/* Danger zone */}
            <div className="edit-panel edit-panel-danger">
              <div className="edit-panel-title" style={{ color: '#f87171' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Danger Zone
              </div>
              <p className="edit-danger-desc">
                Deleting this competition is permanent and cannot be undone. All team registrations, matches and results will be lost.
              </p>
              <button className="edit-btn-delete" id="btn-delete-comp" onClick={() => setIsDeleteOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
                DELETE COMPETITION
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirm Modal */}
      {isDeleteOpen && (
        <div className="modal-overlay active open" id="delete-modal" onClick={(e) => { if (e.target.id === 'delete-modal') setIsDeleteOpen(false); }}>
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#f87171' }}>Delete Competition</h3>
              <button className="modal-close" onClick={() => setIsDeleteOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </svg>
              </button>
            </div>
            <p style={{ color: '#9aa4b2', fontSize: '14px', marginBottom: '24px' }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>{comp.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setIsDeleteOpen(false)}>Cancel</button>
              <button className="btn-submit" id="btn-confirm-delete" style={{ background: '#ef4444' }} onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Competition Confirm Modal */}
      {isEndOpen && (
        <div className="modal-overlay active open" id="end-comp-modal" onClick={(e) => { if (e.target.id === 'end-comp-modal') setIsEndOpen(false); }}>
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#fb923c' }}>End Competition</h3>
              <button className="modal-close" onClick={() => setIsEndOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </svg>
              </button>
            </div>
            <p style={{ color: '#9aa4b2', fontSize: '14px', marginBottom: '8px' }}>
              You are about to end <strong style={{ color: '#fb923c' }}>{comp.name}</strong>.
            </p>
            <p style={{ color: '#9aa4b2', fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
              Once ended, all actions will be locked — no new matches, team approvals, join requests, or disputes will be allowed. The competition will be marked as <strong style={{ color: '#fff' }}>Completed</strong>.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setIsEndOpen(false)}>Cancel</button>
              <button className="btn-submit" id="btn-confirm-end" style={{ background: '#fb923c', color: '#000', fontWeight: 800 }} onClick={handleConfirmEnd}>
                ✓ Confirm End
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
