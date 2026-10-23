/**
 * NEXUS ESPORTS — Edit Competition
 *
 * §3 edit workflow:
 * - loads the competition by ?id= from the BACKEND first (authoritative), with a
 *   localStorage fallback so the page still renders when the API is offline.
 * - Registration closed (regDeadline/regClose past): name, game, type and
 *   description fields are disabled — and the backend enforces the same rule for
 *   any direct API request (competitions.service.updateCompetition).
 * - Removed from the edit UI: prize pool, start/end dates, max teams, max
 *   players per team, and the registration deadline. They are omitted from the
 *   update payload so the persisted values remain untouched.
 * - Co-organizers are editable in full; every username is validated against
 *   registered accounts on save, and the backend repeats the validation and
 *   rejects the entire update if any username is invalid.
 * - Format & Season are not editable fields. The persisted format value is
 *   preserved untouched so match scheduling keeps working.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import NexusData from '../services/data.js';
import { AuthAPI, CompetitionsAPI, getUser } from '../services/api.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/edit-competition.css';

const GAME_OPTIONS = ['League of Legends', 'Counter-Strike 2', 'Valorant', 'Dota 2', 'Rocket League', 'Apex Legends', 'Fortnite', 'Overwatch 2', 'Street Fighter 6', 'Other'];
const STATUS_MAP = {
  upcoming: { label: 'Upcoming', dot: 'dot-upcoming', pct: 60 },
  ongoing: { label: 'Ongoing', dot: '', pct: 85 },
  completed: { label: 'Completed', dot: 'dot-completed', pct: 100 },
};

/** §3.4 — timezone-safe comparisons happen on Date values, not "YYYY-MM-DD" strings. */
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/** §3.1 — registration closure from the persisted deadline (registrationCloseAt or regDeadline). */
export function registrationEndValue(comp) {
  const raw = comp?.registrationCloseAt || comp?.regClose || comp?.regDeadline || '';
  if (!raw) return null;
  // A date-only value means end-of-day in local time, not midnight UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) {
    const [y, m, dd] = String(raw).split('-').map(Number);
    return new Date(y, m - 1, dd, 23, 59, 59, 999);
  }
  return toDate(raw);
}

export function isRegistrationClosed(comp, now = new Date()) {
  const end = registrationEndValue(comp);
  return !!end && now.getTime() >= end.getTime();
}

export default function EditCompetition() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id') || '';

  const comp = useMemo(() => (id && NexusData ? NexusData.getCompetitionById(id) : null), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const creator = comp ? (comp.createdBy || comp.organizerId || 'organizer') : 'organizer';
  const initialCoOrgs = comp && Array.isArray(comp.organizers)
    ? comp.organizers.filter((u) => String(u).toLowerCase() !== String(creator).toLowerCase())
    : [];

  const [name, setName] = useState(comp ? comp.name || '' : '');
  const [description, setDescription] = useState(comp ? comp.description || '' : '');
  const [game, setGame] = useState(comp ? comp.game || '' : '');
  const [type, setType] = useState(comp ? comp.type || 'league' : 'league');
  const [status, setStatus] = useState(comp ? comp.status || 'upcoming' : 'upcoming');
  const [coOrgs, setCoOrgs] = useState(initialCoOrgs.length ? initialCoOrgs : ['']);
  const [bannerSrc, setBannerSrc] = useState(null);
  const [locked, setLocked] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const savingRef = useRef(false);

  const ended = !!(comp && (comp.ended || comp.status === 'completed'));
  const isLocked = locked || ended;
  // §3.1 — the URL may not be bypassed; closure state is derived from persisted data.
  const regClosed = isRegistrationClosed(comp);

  useEffect(() => {
    if (!id) { navigate('/pages/my-activity.html'); return; }
    if (!comp) { navigate('/pages/my-activity.html'); }
  }, [id, comp, navigate]);

  if (!comp) return <main className="edit-main"><h1 className="edit-page-title">Edit Competition</h1></main>;

  const s = STATUS_MAP[status] || STATUS_MAP.upcoming;
  // Registration closure is intentionally not used here: only the persisted
  // competition start time decides whether the tournament has started.
  const startAt = toDate(comp.startDate);
  const tournamentStarted = !!startAt && Date.now() >= startAt.getTime();

  async function validateClient() {
    if (!name.trim()) return 'Competition name is required.';
    return null;
  }

  async function saveChanges() {
    if (isLocked) { showToast('This competition has ended and can no longer be edited.', 'error'); return; }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await performSave();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function performSave() {
    const clientError = await validateClient();
    if (clientError) { showToast(clientError, 'error'); return; }

    // Build the desired co-organizer list from all non-empty rows. The creator is
    // never assignable, duplicates are collapsed, and every username is checked
    // against the authoritative backend before any update is sent.
    const cleanCoOrgs = [];
    const seen = new Set();
    let selfAssignment = '';
    coOrgs.forEach((raw) => {
      const value = String(raw || '').trim().replace(/^@/, '');
      if (!value) return;
      const key = value.toLowerCase();
      if (key === String(creator).toLowerCase()) { selfAssignment = value; return; }
      if (seen.has(key)) return;
      seen.add(key);
      cleanCoOrgs.push(value);
    });

    if (selfAssignment) {
      showToast('The creator is already the primary organizer; self-assignment is not allowed.', 'error');
      return;
    }

    if (cleanCoOrgs.length) {
      let validationError = '';
      const checks = await Promise.all(cleanCoOrgs.map(async (username) => {
        const res = await AuthAPI.userExists(username);
        if (!res.ok) {
          if (!validationError) {
            if (res.status === 401) validationError = 'Your session has expired. Please log in again.';
            else if (res.status === 403) validationError = 'You are not authorized to validate co-organizers.';
            else validationError = 'Unable to validate co-organizer usernames. Please try again.';
          }
          return { username, exists: false };
        }
        return { username, exists: !!res.data?.exists };
      }));

      if (validationError) {
        showToast(validationError, 'error');
        return;
      }

      const unknown = checks.filter((check) => !check.exists).map((check) => check.username);
      if (unknown.length) {
        showToast(
          unknown.length === 1
            ? `Co-organizer username "${unknown[0]}" does not exist. Please select a valid registered username.`
            : `Co-organizer usernames ${unknown.map((u) => `"${u}"`).join(', ')} do not exist. Please select valid registered usernames.`,
          'error',
        );
        return;
      }
    }

    const user = getUser();
    const sessionName = user?.username || user?.email || creator;
    const payload = {
      name: name.trim(),
      description: String(description).trim(),
      game: game || undefined,
      type: type || undefined,
      status: status || undefined,
      coOrganizers: cleanCoOrgs,
    };

    try {
      const res = await CompetitionsAPI.update(comp.id || id, payload);
      if (res.ok && res.data) {
        const updated = res.data;
        try {
          NexusData.updateCompetition({
            ...comp,
            ...updated,
            organizers: Array.isArray(updated.organizers) && updated.organizers.length
              ? updated.organizers
              : Array.from(new Set([creator, ...cleanCoOrgs])),
          });
        } catch (e) { /* local cache is best-effort only */ }
        showToast('Changes saved successfully!', 'success');
        // Only a backend-confirmed save redirects. The destination id comes
        // from the authoritative response, falling back to the current record.
        navigate(`/pages/competition-detail.html?id=${encodeURIComponent(updated.id || comp.id || id)}`);
        return;
      }

      const backendError = res.error || 'The backend rejected the update.';
      if (/backend|network|Failed to fetch|is the backend/i.test(String(backendError))) {
        // Offline fallback keeps the local record usable; it never overwrites
        // dates, prize pool, or capacity because those fields are not in the form.
        const updatedLocal = {
          ...comp,
          name: name.trim(),
          description: String(description).trim(),
          game: game || comp.game,
          type: type || comp.type,
          status: status || comp.status,
          organizers: Array.from(new Set([creator, ...cleanCoOrgs])),
          updatedBy: sessionName,
        };
        NexusData.updateCompetition(updatedLocal);
        showToast('Saved locally (backend offline). Re-sync when the API is back.', 'success');
        return;
      }

      // Surface backend validation verbatim, including invalid co-organizer names.
      showToast(backendError, 'error');
    } catch (err) {
      showToast(err.message || 'Backend update failed.', 'error');
    }
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

  async function confirmEnd() {
    if (ending) return;
    if (!tournamentStarted) {
      showToast('You can end the competition only after the tournament has started.', 'error');
      return;
    }
    if (comp.ended || String(comp.status).toLowerCase() === 'completed') {
      showToast('This competition has already ended.', 'error');
      return;
    }

    setEnding(true);
    try {
      const res = await CompetitionsAPI.end(comp.id || id);
      if (!res.ok) {
        showToast(res.error || 'Unable to end the competition.', 'error');
        return;
      }
      const updated = res.data || {};
      NexusData.updateCompetition({
        ...comp,
        ...updated,
        status: 'completed',
        ended: true,
        endedAt: new Date().toISOString(),
      });
      setStatus('completed');
      setEndOpen(false);
      setLocked(true);
      showToast('Competition ended. All actions are now locked.', 'success');
    } catch (err) {
      showToast(err.message || 'Unable to end the competition.', 'error');
    } finally {
      setEnding(false);
    }
  }

  function onBannerFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File too large. Max 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setBannerSrc(ev.target.result); showToast('Banner updated (preview only).', 'success'); };
    reader.readAsDataURL(file);
  }

  const lockedFieldProps = regClosed || isLocked ? { disabled: true } : {};

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

        {regClosed && !isLocked && (
          <div style={{ background: 'rgba(198,255,51,0.08)', border: '1px solid rgba(198,255,51,0.3)', color: '#c6ff33', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 16, letterSpacing: '0.5px' }}>
            🔒 Registration has closed. Name, game, competition type and description can no longer be changed. Status and co-organizers can still be updated.
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
                <input type="text" className="edit-input" id="ef-name" placeholder="e.g. Summer Championship 2026" value={name} onChange={(e) => setName(e.target.value)} {...lockedFieldProps} />
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">Game</label>
                  <select className="edit-select" id="ef-game" value={game} onChange={(e) => setGame(e.target.value)} {...lockedFieldProps}>
                    <option value="">Select Game</option>
                    {GAME_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="edit-form-group">
                  <label className="edit-label">Competition Type</label>
                  <select className="edit-select" id="ef-type" value={type} onChange={(e) => setType(e.target.value)} {...lockedFieldProps}>
                    <option value="league">Single Elimination</option>
                    <option value="tournament">Round Robin</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-group">
                <label className="edit-label">Description</label>
                <textarea className="edit-textarea" id="ef-description" rows="4" placeholder="Describe your competition..." value={description} onChange={(e) => setDescription(e.target.value)} {...lockedFieldProps} />
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
                      <input type="text" className="edit-input edit-coorganizer-input" placeholder="e.g. co_organizer_username" value={val} disabled={isLocked} onChange={(e) => setCoOrgs((c) => c.map((x, j) => (j === i ? e.target.value : x)))} style={{ paddingLeft: 28, width: '100%' }} />
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

            <button className="edit-btn-save edit-btn-save-full" id="btn-save-main" disabled={isLocked || saving} onClick={saveChanges}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              {saving ? 'SAVING…' : 'SAVE CHANGES'}
            </button>

            <button className="edit-btn-discard edit-btn-discard-full" id="btn-discard-2" onClick={() => navigate(`/pages/competition-detail.html?id=${id}`)}>Cancel &amp; Discard</button>

            <div className="edit-panel" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.05)' }} id="end-comp-panel">
              <div className="edit-panel-title" style={{ color: '#fb923c' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                End Competition
              </div>
              <p className="edit-danger-desc" style={{ color: 'rgba(255,255,255,0.55)' }}>Ending this competition marks it as completed. This action becomes available only after the tournament&apos;s scheduled start time, and cannot be undone.</p>
              <button
                className="edit-btn-delete"
                id="btn-end-comp"
                disabled={isLocked || !tournamentStarted || ending}
                title={!tournamentStarted ? 'Available only after the tournament has started.' : undefined}
                onClick={() => {
                  if (!tournamentStarted) { showToast('You can end the competition only after the tournament has started.', 'error'); return; }
                  if (comp.ended || comp.status === 'completed') { showToast('This competition has already been ended.', 'error'); return; }
                  setEndOpen(true);
                }}
                style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', opacity: !tournamentStarted ? 0.55 : 1, cursor: !tournamentStarted ? 'not-allowed' : 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                {ending ? 'ENDING…' : 'END COMPETITION'}
              </button>
              {!tournamentStarted && (
                <p className="edit-hint" style={{ marginTop: 0 }}>You can end the competition only after the tournament has started.</p>
              )}
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
              <button className="btn-submit" id="btn-confirm-end" disabled={ending} style={{ background: '#fb923c', color: '#000', fontWeight: 800, opacity: ending ? 0.7 : 1, cursor: ending ? 'wait' : 'pointer' }} onClick={confirmEnd}>{ending ? 'Ending…' : '✓ Confirm End'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
