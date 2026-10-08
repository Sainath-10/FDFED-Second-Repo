/**
 * NEXUS ESPORTS — Edit Competition
 *
 * loads the competition
 * by ?id=, populates the form + live status panel, co-organizer rows, banner
 * upload/preview, save validation, end-competition (with UI lock) and delete.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/edit-competition.css';

const GAME_OPTIONS = ['League of Legends', 'Counter-Strike 2', 'Valorant', 'Dota 2', 'Rocket League', 'Apex Legends', 'Fortnite', 'Overwatch 2', 'Street Fighter 6', 'Other'];
const FORMAT_OPTIONS = ['Round Robin', 'Single Elimination', 'Double Elimination', 'Swiss'];
const STATUS_MAP = {
  upcoming: { label: 'Upcoming', dot: 'dot-upcoming', pct: 60 },
  ongoing: { label: 'Ongoing', dot: '', pct: 85 },
  completed: { label: 'Completed', dot: 'dot-completed', pct: 100 },
};

const parsePrize = (str) => (str ? String(str).replace(/[₹,\s]/g, '') : '');
function formatDateDisplay(start, end) {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!e) return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
}

export default function EditCompetition() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id') || '';

  const comp = useMemo(() => (id && NexusData ? NexusData.getCompetitionById(id) : null), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const creator = comp ? (comp.createdBy || comp.organizerId || 'organizer') : 'organizer';
  const initialCoOrgs = comp && Array.isArray(comp.organizers) ? comp.organizers.filter((u) => u !== creator) : [];

  const [name, setName] = useState(comp ? comp.name || '' : '');
  const [description, setDescription] = useState(comp ? comp.description || '' : '');
  const [maxplayers, setMaxplayers] = useState(comp && comp.maxPlayersPerTeam != null ? String(comp.maxPlayersPerTeam) : '');
  const [prize, setPrize] = useState(comp ? parsePrize(comp.prizePool) : '');
  const [maxteams, setMaxteams] = useState(comp && comp.maxTeams != null ? String(comp.maxTeams) : '');
  const [season, setSeason] = useState(comp ? comp.season || '' : '');
  const [game, setGame] = useState(comp ? comp.game || '' : '');
  const [type, setType] = useState(comp ? comp.type || 'league' : 'league');
  const [format, setFormat] = useState(comp ? comp.format || '' : '');
  const [status, setStatus] = useState(comp ? comp.status || 'upcoming' : 'upcoming');
  const [startdate, setStartdate] = useState(comp ? comp.startDate || '' : '');
  const [enddate, setEnddate] = useState(comp ? comp.endDate || '' : '');
  const [regdeadline, setRegdeadline] = useState(comp && comp.regDeadline ? comp.regDeadline : '');
  const [coOrgs, setCoOrgs] = useState(initialCoOrgs.length ? initialCoOrgs : ['']);
  const [bannerSrc, setBannerSrc] = useState(null);
  const [locked, setLocked] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const ended = !!(comp && (comp.ended || comp.status === 'completed'));
  const isLocked = locked || ended;

  useEffect(() => {
    if (!id) { navigate('/pages/my-activity.html'); return; }
    if (!comp) { navigate('/pages/my-activity.html'); }
  }, [id, comp, navigate]);

  if (!comp) return <main className="edit-main"><h1 className="edit-page-title">Edit Competition</h1></main>;

  const s = STATUS_MAP[status] || STATUS_MAP.upcoming;

  function saveChanges() {
    const trimmed = name.trim();
    if (!trimmed) { showToast('Competition name is required.', 'error'); return; }
    if (startdate && enddate && startdate > enddate) { showToast('End date must be after start date.', 'error'); return; }

    const prizeRaw = String(prize).trim();
    const prizePool = prizeRaw ? (prizeRaw.startsWith('₹') ? prizeRaw : `₹${prizeRaw}`) : comp.prizePool;

    let dates = comp.dates;
    if (startdate || enddate) dates = formatDateDisplay(startdate, enddate) || dates;

    const cleanCoOrgs = coOrgs.map((v) => String(v || '').trim().replace(/^@/, '')).filter(Boolean);
    const organizersList = Array.from(new Set([creator, ...cleanCoOrgs]));

    const updated = {
      ...comp,
      name: trimmed,
      game: game || comp.game,
      type: type || comp.type,
      format: format || comp.format,
      status: status || comp.status,
      description: String(description).trim(),
      maxPlayersPerTeam: parseInt(maxplayers, 10) || comp.maxPlayersPerTeam,
      prizePool,
      maxTeams: parseInt(maxteams, 10) || comp.maxTeams,
      season: String(season).trim() || comp.season,
      dates,
      startDate: startdate || comp.startDate,
      endDate: enddate || comp.endDate,
      regDeadline: regdeadline || comp.regDeadline,
      organizers: organizersList,
    };

    NexusData.updateCompetition(updated);
    showToast('Changes saved successfully!', 'success');
  }

  function forceDeleteCompetitionById(targetId) {
    if (!targetId || !NexusData) return false;
    let deleted = false;
    if (typeof NexusData.deleteCompetition === 'function') deleted = !!NexusData.deleteCompetition(targetId);
    if (!deleted && NexusData.loadCompetitions && NexusData.saveCompetitions) {
      const all = NexusData.loadCompetitions();
      if (Array.isArray(all)) {
        const filtered = all.filter((c) => c.id !== targetId);
        if (filtered.length !== all.length) { NexusData.saveCompetitions(filtered); deleted = true; }
      }
    }
    if (deleted) {
      try {
        const key = 'nexus.deleted.competitionIds';
        const ids = JSON.parse(localStorage.getItem(key) || '[]');
        if (!ids.includes(targetId)) ids.push(targetId);
        localStorage.setItem(key, JSON.stringify(ids));
      } catch (e) { /* ignore */ }
      try {
        const ctxRaw = localStorage.getItem('nexus.team.activeContext');
        if (ctxRaw && JSON.parse(ctxRaw).compId === targetId) localStorage.removeItem('nexus.team.activeContext');
      } catch (e) { /* ignore */ }
    }
    return deleted;
  }

  function confirmDelete() {
    const deleted = forceDeleteCompetitionById(comp.id || id);
    if (!deleted) { showToast('Unable to delete competition.', 'error'); return; }
    setDeleteOpen(false);
    showToast('Competition deleted.');
    setTimeout(() => navigate('/pages/my-activity.html'), 1000);
  }

  function confirmEnd() {
    const next = { ...comp, status: 'completed', ended: true, endedAt: new Date().toISOString() };
    NexusData.updateCompetition(next);
    setEndOpen(false);
    setLocked(true);
    showToast('Competition ended. All actions are now locked.', 'success');
  }

  function onBannerFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File too large. Max 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setBannerSrc(ev.target.result); showToast('Banner updated (preview only).', 'success'); };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <main className="edit-main">
        <div className="edit-page-header">
          <div className="edit-header-left">
            <Link className="btn-back" id="btn-back-to-comp" to={`/pages/competition-detail.html?id=${id}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="3" x2="4" y2="8" /><line x1="4" y1="8" x2="10" y2="13" /></svg>
              Back to Dashboard
            </Link>
            <div>
              <h1 className="edit-page-title">Edit Competition</h1>
              <p className="edit-page-subtitle" id="edit-page-subtitle">{comp.name}</p>
            </div>
          </div>
        </div>

        {isLocked && (
          <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 16, letterSpacing: '0.5px' }}>
            🏁 This competition has ended. All editing and actions are locked.
          </div>
        )}

        <div className="edit-body">
          <div className="edit-col-main">
            <div className="edit-panel">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Competition Details
              </div>

              <div className="edit-form-group">
                <label className="edit-label">Competition Name</label>
                <input type="text" className="edit-input" id="ef-name" placeholder="e.g. Summer Championship 2026" value={name} onChange={(e) => setName(e.target.value)} disabled={isLocked} />
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Game</label>
                  <select className="edit-select" id="ef-game" value={game} onChange={(e) => setGame(e.target.value)} disabled={isLocked}>
                    <option value="">Select Game</option>
                    {GAME_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Competition Type</label>
                  <select className="edit-select" id="ef-type" value={type} onChange={(e) => setType(e.target.value)} disabled={isLocked}>
                    <option value="league">Single Elimination</option>
                    <option value="tournament">Round Robin</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-group">
                <label className="edit-label">Description</label>
                <textarea className="edit-textarea" id="ef-description" rows="4" placeholder="Describe your competition..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLocked} />
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Prize Pool (RUPEES)</label>
                  <div className="edit-input-prefix-wrap">
                    <span className="edit-input-prefix">₹</span>
                    <input type="number" className="edit-input edit-input-prefixed" id="ef-prize" placeholder="50000" min="0" value={prize} onChange={(e) => setPrize(e.target.value)} disabled={isLocked} />
                  </div>
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Max Players per Team</label>
                  <input type="number" className="edit-input" id="ef-maxplayers" placeholder="5" min="1" max="20" value={maxplayers} onChange={(e) => setMaxplayers(e.target.value)} disabled={isLocked} />
                </div>
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Start Date</label>
                  <input type="date" className="edit-input" id="ef-startdate" value={startdate} onChange={(e) => setStartdate(e.target.value)} disabled={isLocked} />
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">End Date</label>
                  <input type="date" className="edit-input" id="ef-enddate" value={enddate} onChange={(e) => setEnddate(e.target.value)} disabled={isLocked} />
                </div>
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Max Teams</label>
                  <input type="number" className="edit-input" id="ef-maxteams" placeholder="32" min="2" max="512" value={maxteams} onChange={(e) => setMaxteams(e.target.value)} disabled={isLocked} />
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Registration Deadline</label>
                  <input type="date" className="edit-input" id="ef-regdeadline" value={regdeadline} onChange={(e) => setRegdeadline(e.target.value)} disabled={isLocked} />
                </div>
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Format</label>
                  <select className="edit-select" id="ef-format" value={format} onChange={(e) => setFormat(e.target.value)} disabled={isLocked}>
                    {FORMAT_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Season</label>
                  <input type="text" className="edit-input" id="ef-season" placeholder="Season 1" value={season} onChange={(e) => setSeason(e.target.value)} disabled={isLocked} />
                </div>
              </div>
            </div>

            <div className="edit-panel">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                Tournament Co-Organizers
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Co-organizers share tournament management and dispute resolution permissions.</span>
                <button type="button" className="btn-table-secondary" disabled={isLocked} onClick={() => setCoOrgs((c) => [...c, ''])} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(198,255,51,0.3)', color: '#c6ff33', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  + Add Co-Organizer
                </button>
              </div>
              <div id="edit-coorganizers-container" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {coOrgs.map((val, i) => (
                  <div className="edit-coorganizer-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }} key={i}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>@</span>
                      <input type="text" className="edit-input edit-coorganizer-input" placeholder="e.g. co_organizer_username or ID" value={val} disabled={isLocked} onChange={(e) => setCoOrgs((c) => c.map((x, j) => (j === i ? e.target.value : x)))} style={{ paddingLeft: 28, width: '100%' }} />
                    </div>
                    <button type="button" className="btn-table-danger" disabled={isLocked} onClick={() => setCoOrgs((c) => c.filter((_, j) => j !== i))} style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} title="Remove co-organizer">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="edit-panel">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                Competition Banner
              </div>
              <div className="edit-banner-preview" id="edit-banner-preview">
                {bannerSrc ? (
                  <img src={bannerSrc} alt="Banner preview" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block', borderRadius: 10 }} />
                ) : (
                  <div className="edit-banner-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a3a4a" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    <p>No banner uploaded</p>
                    <span>Recommended: 1920×1080px · Max 5MB (JPG, PNG)</span>
                  </div>
                )}
              </div>
              <div className="edit-banner-actions">
                <button className="edit-btn-outline" disabled={isLocked} onClick={() => document.getElementById('banner-upload')?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" /></svg>
                  Replace
                </button>
                <button className="edit-btn-outline edit-btn-danger-outline" id="btn-remove-banner" disabled={isLocked} onClick={() => setBannerSrc(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                  Remove
                </button>
                <input type="file" id="banner-upload" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={onBannerFile} />
              </div>
              <p className="edit-hint">Recommended size: 1920×1080px. Max 5MB (JPG, PNG)</p>
            </div>
          </div>

          <div className="edit-col-side">
            <div className="edit-panel edit-panel-status">
              <div className="edit-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Live Status
              </div>
              <div className="edit-status-row">
                <div className={`edit-status-dot ${s.dot}`} id="status-dot"></div>
                <span className="edit-status-label" id="status-label">{s.label}</span>
                <span className="edit-status-time" id="status-time">Last updated: {comp.createdDaysAgo != null ? `${comp.createdDaysAgo}d ago` : 'recently'}</span>
              </div>
              <div className="edit-progress-bar-wrap">
                <div className="edit-progress-bar"><div className="edit-progress-fill" id="status-progress" style={{ width: `${s.pct}%` }}></div></div>
                <span className="edit-progress-label" id="status-progress-label">Profile completeness: {s.pct}%</span>
              </div>
              <div className="edit-form-group" style={{ marginTop: 4 }}>
                <label className="edit-label">Competition Status</label>
                <select className="edit-select" id="ef-status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={isLocked}>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <button className="edit-btn-save edit-btn-save-full" id="btn-save-main" disabled={isLocked} onClick={saveChanges}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              SAVE CHANGES
            </button>

            <button className="edit-btn-discard edit-btn-discard-full" id="btn-discard-2" onClick={() => navigate(`/pages/competition-detail.html?id=${id}`)}>Cancel &amp; Discard</button>

            <div className="edit-panel" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.05)' }} id="end-comp-panel">
              <div className="edit-panel-title" style={{ color: '#fb923c' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                End Competition
              </div>
              <p className="edit-danger-desc" style={{ color: 'rgba(255,255,255,0.55)' }}>Ending this competition marks it as completed. All actions (matches, team approvals, disputes) will be locked. This cannot be undone.</p>
              <button className="edit-btn-delete" id="btn-end-comp" disabled={isLocked} onClick={() => { if (comp.ended || comp.status === 'completed') { showToast('This competition has already been ended.', 'error'); return; } setEndOpen(true); }} style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                END COMPETITION
              </button>
            </div>

            <div className="edit-panel edit-panel-danger">
              <div className="edit-panel-title" style={{ color: '#f87171' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Danger Zone
              </div>
              <p className="edit-danger-desc">Deleting this competition is permanent and cannot be undone. All team registrations, matches and results will be lost.</p>
              <button className="edit-btn-delete" id="btn-delete-comp" onClick={() => setDeleteOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                DELETE COMPETITION
              </button>
            </div>
          </div>
        </div>
      </main>

      {deleteOpen && (
        <div className="modal-overlay open" id="delete-modal" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#f87171' }}>Delete Competition</h3>
              <button className="modal-close" onClick={() => setDeleteOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" /></svg>
              </button>
            </div>
            <p style={{ color: '#9aa4b2', fontSize: 14, marginBottom: 24 }}>Are you sure you want to delete <strong id="delete-comp-name" style={{ color: '#fff' }}>{comp.name || 'this competition'}</strong>? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button className="btn-submit" id="btn-confirm-delete" style={{ background: '#ef4444' }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {endOpen && (
        <div className="modal-overlay open" id="end-comp-modal" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#fb923c' }}>End Competition</h3>
              <button className="modal-close" onClick={() => setEndOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" /></svg>
              </button>
            </div>
            <p style={{ color: '#9aa4b2', fontSize: 14, marginBottom: 8 }}>You are about to end <strong id="end-comp-name" style={{ color: '#fb923c' }}>{comp.name || 'this competition'}</strong>.</p>
            <p style={{ color: '#9aa4b2', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>Once ended, all actions will be locked — no new matches, team approvals, join requests, or disputes will be allowed. The competition will be marked as <strong style={{ color: '#fff' }}>Completed</strong>.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setEndOpen(false)}>Cancel</button>
              <button className="btn-submit" id="btn-confirm-end" style={{ background: '#fb923c', color: '#000', fontWeight: 800 }} onClick={confirmEnd}>✓ Confirm End</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


