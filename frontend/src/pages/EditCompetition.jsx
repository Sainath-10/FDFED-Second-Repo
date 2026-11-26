/**
 * NEXUS ESPORTS — Edit Competition
 *
 * Loads the competition from the backend and saves changes there. Name, game,
 * type and description lock once registration closes; dates lock once play
 * starts; capacity can only grow. The danger zone:
 *  - before the start: cancel (every player refunded);
 *  - after the start, every fixture played and no open dispute against the organiser: end (prizes are paid out automatically);
 *  - after the start, fixtures still to play: request an early end with a reason.
 *    A finance moderator reviews it; if approved, players are refunded and the
 *    organiser forfeits 10% of the prize pool.
 * Competitions are never silently deleted: their payments must stay on record.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CompetitionsAPI, MatchesAPI } from '../services/api.js';
import { fetchPlatformSettings } from '../store/platformSlice.js';
import { paymentRequest, requestEarlyEnd } from '../services/payments.js';
import { UsernameChips } from '../components/UsernameSearch.jsx';
import { hasStarted, isClosedCompetition, isOrganizerOf, useCompetition } from '../services/competitions.js';
import { GAMES, MAX_DATE_EDITS, MAX_PLAYERS, MAX_TEAMS, readBanner, scheduleToIso, toDateInput, validateDescription, validateName, validateSchedule } from '../lib/competitionForm.js';
import { competitionBanner } from '../lib/assets.js';
import { ConfirmDialog, ErrorState, LoadingState, Notice, PageHeader, ReasonDialog, formatINR } from '../components/ui.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/edit-competition.css';

const field = (label, error, children, help) => (
  <div className="ui-field">
    <label>{label}</label>
    {children}
    {help && !error && <span className="ui-field-help">{help}</span>}
    {error && <span className="ui-field-error">{error}</span>}
  </div>
);

export default function EditCompetition() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSelector((state) => state.auth.session);
  const dispatch = useDispatch();
  const id = params.get('id') || '';
  const { loading, error, data: comp, reload } = useCompetition(id);

  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [fixtures, setFixtures] = useState(null);
  const [ledger, setLedger] = useState(null);
  // The Super Admin's saved team limit (the server enforces the same rule).
  const platformMaxTeams = useSelector((state) => (Number.isInteger(state.platform.settings.maxTeams) ? state.platform.settings.maxTeams : MAX_TEAMS));
  // A competition already above a since-lowered limit may keep its current size.
  const teamLimit = Math.max(platformMaxTeams, Number(comp?.maxTeams || 0));

  useEffect(() => {
    dispatch(fetchPlatformSettings());
  }, [dispatch]);

  useEffect(() => {
    if (!id) return;
    MatchesAPI.getByCompetition(id).then((res) => setFixtures(res.ok && Array.isArray(res.data) ? res.data : []));
    paymentRequest(`/competitions/${encodeURIComponent(id)}/ledger`).then(setLedger).catch(() => setLedger(null));
  }, [id, comp?.updatedAt]);

  useEffect(() => {
    if (!comp) return;
    setForm({
      name: comp.name || '',
      description: comp.description || '',
      game: comp.game || '',
      type: comp.type || 'tournament',
      regOpen: toDateInput(comp.registrationOpenAt),
      regClose: toDateInput(comp.registrationCloseAt),
      start: toDateInput(comp.startDate),
      end: toDateInput(comp.endDate),
      maxTeams: String(comp.maxTeams || ''),
      maxPlayersPerTeam: String(comp.maxPlayersPerTeam || ''),
      img: comp.img || '',
      coOrganizers: [...(comp.organizers || []).filter((o) => o !== comp.createdBy), ...(comp.pendingOrganizers || [])],
    });
  }, [comp?.id, comp?.updatedAt]);

  const original = useMemo(() => comp && ({
    regOpen: toDateInput(comp.registrationOpenAt),
    regClose: toDateInput(comp.registrationCloseAt),
    start: toDateInput(comp.startDate),
    end: toDateInput(comp.endDate),
  }), [comp]);

  if (!id) return <main className="main-content"><ErrorState message="Open Settings from a competition." /></main>;
  if ((loading && !comp) || (comp && !form)) return <main className="main-content"><LoadingState label="Loading competition…" /></main>;
  if (error || !comp) return <main className="main-content"><ErrorState message={error || 'That competition could not be found.'} onRetry={reload} /></main>;
  if (!isOrganizerOf(comp, session?.username)) return <main className="main-content"><ErrorState message="Only this competition's organizers can change its settings." /></main>;

  const ended = isClosedCompetition(comp);
  const started = hasStarted(comp);
  const regClosed = !comp.registration.open && comp.registration.reason !== 'not_open';
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  // Date edit limits (mirrors the server, which enforces them).
  const dateEditsLeft = Math.max(0, MAX_DATE_EDITS - Number(comp.dateEditCount || 0));
  const endEditsLeft = Math.max(0, MAX_DATE_EDITS - Number(comp.endDateEditCount || 0));
  const hasRegisteredTeams = (comp.activeTeams || []).length > 0;
  const datesLocked = ended || started || dateEditsLeft === 0;
  const regOpenLocked = datesLocked || hasRegisteredTeams;
  const endLocked = ended || (started ? endEditsLeft === 0 : dateEditsLeft === 0);

  function validate() {
    const next = {};
    if (!regClosed) {
      const n = validateName(form.name); if (n) next.name = n;
      const d = validateDescription(form.description); if (d) next.description = d;
    }
    const changed = ['regOpen', 'regClose', 'start', 'end'].filter((k) => form[k] !== original[k]);
    if (changed.length) Object.assign(next, validateSchedule(form, { changed }));
    const mt = Number(form.maxTeams);
    if (!Number.isInteger(mt) || mt < 2 || mt > teamLimit) next.maxTeams = `Whole number from 2 to ${teamLimit}.`;
    else if (mt < comp.maxTeams) next.maxTeams = `Capacity can only grow (currently ${comp.maxTeams}).`;
    const mp = Number(form.maxPlayersPerTeam);
    if (!Number.isInteger(mp) || mp < 1 || mp > MAX_PLAYERS) next.maxPlayersPerTeam = `Whole number from 1 to ${MAX_PLAYERS}.`;
    else if (mp < comp.maxPlayersPerTeam) next.maxPlayersPerTeam = `Capacity can only grow (currently ${comp.maxPlayersPerTeam}).`;
    setErrors(next);
    return { ok: Object.keys(next).length === 0, changed };
  }

  async function save(event) {
    event.preventDefault();
    const { ok, changed } = validate();
    if (!ok) { showToast('Fix the highlighted fields.', 'error'); return; }
    const iso = scheduleToIso(form);
    const payload = {
      maxTeams: Number(form.maxTeams),
      maxPlayersPerTeam: Number(form.maxPlayersPerTeam),
      coOrganizers: form.coOrganizers,
    };
    if (!regClosed) Object.assign(payload, { name: form.name.trim(), description: form.description.trim(), game: form.game, type: form.type });
    if (changed.includes('regOpen')) payload.registrationOpenAt = iso.registrationOpenAt;
    if (changed.includes('regClose') || changed.includes('start')) payload.registrationCloseAt = iso.registrationCloseAt;
    if (changed.includes('start')) payload.startDate = iso.startDate;
    if (changed.includes('end')) payload.endDate = iso.endDate;
    if (form.img !== (comp.img || '')) payload.img = form.img;
    setSaving(true);
    const res = await CompetitionsAPI.update(comp.id, payload);
    setSaving(false);
    if (!res.ok) { showToast(res.error || 'Unable to save changes.', 'error'); return; }
    showToast('Changes saved.');
    reload();
  }

  async function onBanner(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { const img = await readBanner(file); setForm((f) => ({ ...f, img })); } catch (err) { showToast(err.message, 'error'); }
  }

  async function endCompetition() {
    const res = await CompetitionsAPI.end(comp.id);
    if (!res.ok) { showToast(res.error || 'Unable to end the competition.', 'error'); return; }
    setConfirmEnd(false);
    showToast(res.data?.paymentStatus === 'PRIZE_RELEASED'
      ? 'Competition ended. The prizes were paid to the winners automatically.'
      : 'Competition ended. A finance moderator will review it before the prizes are paid.');
    navigate(`/pages/competition-detail.html?id=${encodeURIComponent(comp.id)}`);
  }

  async function endEarly(reason) {
    try {
      await requestEarlyEnd(comp.id, reason);
    } catch (err) { showToast(err.message, 'error'); return; }
    setEarlyOpen(false);
    showToast('Request sent. A finance moderator will review it; the competition keeps running until then.');
    reload();
  }

  async function cancelCompetition(reason) {
    try {
      await paymentRequest(`/competitions/${encodeURIComponent(comp.id)}/cancel`, 'POST', { note: reason });
    } catch (err) { showToast(err.message, 'error'); return; }
    setCancelOpen(false);
    showToast('Competition cancelled. Every registration fee was refunded.');
    navigate('/pages/my-activity.html');
  }

  const lockedProps = { disabled: regClosed || ended };
  const played = (fixtures || []).filter((m) => m.status !== 'bye');
  const remaining = played.filter((m) => m.status !== 'completed').length;
  const fixturesDone = !!fixtures && played.length > 0 && remaining === 0;
  // Only one team registered and nothing to play: it can be declared the solo winner.
  const soloWinner = started && !!fixtures && (comp.activeTeams || []).length === 1 && played.every((m) => !m.team1Id || !m.team2Id);
  const earlyRequest = ledger?.earlyEndRequest || comp.earlyEndRequest || null;
  const penaltyPercent = ledger?.earlyEndPenaltyPercent ?? 10;
  const prizeAmount = Number(comp.prize) || 0;

  return (
    <main className="main-content">
      <PageHeader
        title="Competition settings"
        subtitle={comp.name}
        actions={<Link className="btn-cancel" to={`/pages/competition-detail.html?id=${encodeURIComponent(comp.id)}`}>Back to competition</Link>}
      />
      {ended && <Notice tone="warning">This competition has ended, so its settings can no longer change.</Notice>}
      {!ended && regClosed && <Notice tone="info">Registration has closed: the name, game, type and description are locked.</Notice>}
      {!ended && started && (
        <Notice tone="info">
          The competition has started: only the end date can still change
          {endEditsLeft > 0 ? ` (${endEditsLeft} of ${MAX_DATE_EDITS} changes left).` : ', and it has already been changed the maximum number of times.'}
        </Notice>
      )}
      {!ended && !started && (
        <Notice tone={dateEditsLeft ? 'info' : 'warning'}>
          {dateEditsLeft
            ? `The dates can be changed ${dateEditsLeft} more time${dateEditsLeft === 1 ? '' : 's'}.`
            : 'The dates have been changed the maximum number of times and are now locked.'}
          {hasRegisteredTeams ? ' Teams have registered, so the registration opening date is fixed.' : ''}
        </Notice>
      )}

      <form onSubmit={save} className="ui-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <div className="ui-card">
          <h2 className="ui-card-title">Basics</h2>
          {field('Name', errors.name, <input className="form-input" value={form.name} maxLength={100} onChange={set('name')} {...lockedProps} />)}
          {field('Description', errors.description, <textarea className="form-input" rows={4} value={form.description} maxLength={2000} onChange={set('description')} {...lockedProps} />)}
          {field('Game', errors.game, (
            <select className="form-input" value={form.game} onChange={set('game')} {...lockedProps}>
              {[...new Set([form.game, ...GAMES])].filter(Boolean).map((g) => <option key={g}>{g}</option>)}
            </select>
          ))}
          {field('Type', errors.type, (
            <select className="form-input" value={form.type} onChange={set('type')} {...lockedProps}>
              <option value="tournament">Tournament (knockout)</option>
              <option value="league">League (round robin)</option>
            </select>
          ))}
          {field('Co-organizers', errors.coOrganizers, (
            <UsernameChips value={form.coOrganizers} onChange={(names) => setForm((f) => ({ ...f, coOrganizers: names }))} max={5} disabled={ended} exclude={[comp.createdBy]} placeholder="Search a username to invite…" />
          ), 'New names receive an invitation and become co-organizers once they accept. Remove a name to remove that co-organizer.')}
        </div>

        <div className="ui-card">
          <h2 className="ui-card-title">Dates</h2>
          {field('Registration opens', errors.regOpen, <input className="form-input" type="date" value={form.regOpen} onChange={set('regOpen')} disabled={regOpenLocked} />)}
          {field('Registration closes', errors.regClose, <input className="form-input" type="date" value={form.regClose} onChange={set('regClose')} disabled={datesLocked} />, 'At least one day after it opens, and at least one day before the start.')}
          {field('Starts', errors.start, <input className="form-input" type="date" value={form.start} onChange={set('start')} disabled={datesLocked} />)}
          {field('Ends', errors.end, <input className="form-input" type="date" value={form.end} onChange={set('end')} disabled={endLocked} />, 'The end day is included. It must be at least one day after the start.')}

          <h2 className="ui-card-title" style={{ marginTop: 10 }}>Capacity</h2>
          {field('Max teams', errors.maxTeams, <input className="form-input" type="number" min={comp.maxTeams || 2} max={teamLimit} value={form.maxTeams} onChange={set('maxTeams')} disabled={ended} />)}
          {field('Max players per team', errors.maxPlayersPerTeam, <input className="form-input" type="number" min={comp.maxPlayersPerTeam || 1} max={MAX_PLAYERS} value={form.maxPlayersPerTeam} onChange={set('maxPlayersPerTeam')} disabled={ended} />)}
        </div>

        <div className="ui-card">
          <h2 className="ui-card-title">Banner</h2>
          <img src={form.img ? competitionBanner({ img: form.img, game: form.game }) : competitionBanner({ game: form.game })} alt="" style={{ width: '100%', borderRadius: 10, maxHeight: 180, objectFit: 'cover', marginBottom: 12 }} />
          <div className="ui-row-actions">
            <label className="btn-cancel" style={{ cursor: ended ? 'not-allowed' : 'pointer' }}>
              Upload PNG or JPEG
              <input type="file" accept="image/png,image/jpeg" onChange={onBanner} disabled={ended} style={{ display: 'none' }} />
            </label>
            {form.img && <button type="button" className="btn-cancel" disabled={ended} onClick={() => setForm((f) => ({ ...f, img: '' }))}>Use game banner</button>}
          </div>
          <p className="ui-field-help" style={{ marginTop: 8 }}>Up to 5 MB.</p>

          <div className="ui-dialog-actions" style={{ marginTop: 22 }}>
            <button type="submit" className="btn-primary" disabled={saving || ended}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </form>

      {!ended && (
        <div className="ui-card" style={{ marginTop: 24, borderColor: 'rgba(239,68,68,0.4)' }}>
          <h2 className="ui-card-title" style={{ color: '#f87171' }}>Danger zone</h2>
          {earlyRequest?.status === 'pending' && (
            <Notice tone="warning">
              You asked to end this competition early on {new Date(earlyRequest.requestedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.
              A finance moderator is reviewing it.{earlyRequest.reason ? ` Your reason: “${earlyRequest.reason}”` : ''}
            </Notice>
          )}
          {earlyRequest?.status === 'rejected' && (
            <Notice tone="danger">Finance rejected your request to end early{earlyRequest.note ? `: ${earlyRequest.note}` : ''}. Finish the remaining fixtures, then end it normally.</Notice>
          )}
          <div className="ui-row" style={{ marginBottom: 10 }}>
            <div className="ui-row-main">
              <div className="ui-row-title">End competition</div>
              <div className="ui-row-meta">
                {!started ? 'Available once the competition has started.'
                  : soloWinner ? `Only one team registered: ending declares ${(comp.activeTeams || [])[0]?.name || 'it'} the solo winner. The other places stay empty.`
                  : fixturesDone ? 'Every fixture is complete. Ending pays the prizes to the winners automatically. You cannot end while a dispute against you is unresolved.'
                    : `${remaining} fixture${remaining === 1 ? ' is' : 's are'} still to be played. Ending now needs a reason and a finance moderator's approval: players are refunded and you forfeit ${penaltyPercent}% of the prize pool${prizeAmount ? ` (${formatINR(Math.round(prizeAmount * penaltyPercent) / 100)})` : ''}.`}
              </div>
            </div>
            <button
              type="button"
              className={fixturesDone || soloWinner ? 'btn-primary' : 'btn-cancel'}
              disabled={!started || fixtures === null || earlyRequest?.status === 'pending'}
              onClick={() => (fixturesDone || soloWinner ? setConfirmEnd(true) : setEarlyOpen(true))}
            >
              {fixturesDone || soloWinner || !started ? 'End competition' : 'Request early end'}
            </button>
          </div>
          <div className="ui-row">
            <div className="ui-row-main">
              <div className="ui-row-title">Cancel competition</div>
              <div className="ui-row-meta">{started
                ? 'A started competition cannot be cancelled outright. Use End competition instead.'
                : 'Before the start only. Every registration fee is refunded in full. Your platform fee is not refunded and your organizer trust score drops.'}</div>
            </div>
            <button type="button" className="btn-danger" disabled={started} onClick={() => setCancelOpen(true)}>Cancel competition</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmEnd}
        tone="primary"
        title="End competition"
        message="End this competition now? Results become final and the prize pool is paid to the winners straight away."
        confirmLabel="End competition"
        onConfirm={endCompetition}
        onClose={() => setConfirmEnd(false)}
      />
      <ReasonDialog
        open={earlyOpen}
        title="Request an early end"
        description={`${remaining} fixture${remaining === 1 ? '' : 's'} have not been played. Explain why the competition must end now. A finance moderator reviews your request. If approved, every player is refunded, ${penaltyPercent}% of the prize pool is kept as a penalty, the rest is returned to you, and your trust score drops.`}
        placeholder="e.g. The sponsor withdrew and the venue closed; we cannot finish the remaining matches."
        minLength={20}
        confirmLabel="Send to finance"
        onConfirm={endEarly}
        onClose={() => setEarlyOpen(false)}
      />
      <ReasonDialog
        open={cancelOpen}
        title="Cancel competition"
        description="Players are refunded and told the reason. This cannot be undone."
        placeholder="Reason for cancelling"
        minLength={10}
        confirmLabel="Cancel competition"
        onConfirm={cancelCompetition}
        onClose={() => setCancelOpen(false)}
      />
    </main>
  );
}
