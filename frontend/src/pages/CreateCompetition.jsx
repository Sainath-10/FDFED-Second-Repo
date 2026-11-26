/**
 * NEXUS ESPORTS — Create Competition
 *
 * Validates with the same rules as the backend (lib/competitionForm.js), shows
 * the platform fee from the live revenue configuration, respects the Super
 * Admin's platform settings and the organizer's reputation limit, then saves a
 * draft and moves to payment. The backend re-checks everything.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CompetitionsAPI, ReputationAPI } from '../services/api.js';
import { calculatePlatformFee } from '../services/competitions.js';
import { fetchPlatformSettings, fetchRevenueConfig } from '../store/platformSlice.js';
import {
  FORMATS, GAMES, LARGE_PRIZE_POOL, MAX_ENTRY_FEE, MAX_PLAYERS, MAX_PRIZE_POOL, MIN_ENTRY_FEE,
  nextDay, previousDay, parseRupees, readBanner, scheduleToIso, todayInput, validateContact, validateDescription, validateName, validatePrizes, validateSchedule,
} from '../lib/competitionForm.js';
import { UsernameChips } from '../components/UsernameSearch.jsx';
import { competitionBanner } from '../lib/assets.js';
import { ConfirmDialog, Notice, formatINR } from '../components/ui.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/create-competition.css';
import { creationBan } from '../components/CreateCompetitionLink.jsx';


/** Same ban wording as the Create Competition pop-up (for anyone who opens this page directly). */
function creationBlock(profile) {
  const ban = creationBan(profile);
  if (!ban) return '';
  const until = ban.until ? ` You can create competitions again after ${new Date(ban.until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : '';
  return `${ban.message}${until}${ban.reason ? ` Reason: ${ban.reason}` : ''}`;
}

/** Declared at module scope so inputs keep focus between renders. */
function Field({ id, label, children, error, help }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      {children}
      {help && !error && <p className="ui-field-help" style={{ marginTop: 5 }}>{help}</p>}
      {error && <p className="ui-field-error" style={{ marginTop: 5 }}>⚠ {error}</p>}
    </div>
  );
}

/** Every field starts empty: the organizer chooses each value (only the banner has a default image). */
const initialForm = () => ({
  name: '', game: '', format: '', description: '', visibility: '',
  regOpen: '', regClose: '', start: '', end: '',
  maxTeams: '', maxPlayers: '', feeType: '', entryFee: '',
  p1: '', p2: '', p3: '', coOrganizers: [],
  contact: { fullName: '', phone: '', email: '', organisation: '', purpose: '' },
});

export default function CreateCompetition() {
  const session = useSelector((state) => state.auth.session);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Platform fee formula and the Super Admin's switches, from the platform slice.
  const revenue = useSelector((state) => state.platform.revenueConfig);
  const platform = useSelector((state) => state.platform.settings);
  const [form, setForm] = useState(initialForm);
  const [banner, setBanner] = useState('');
  const [errors, setErrors] = useState({});
  const [reputation, setReputation] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [exceptionReason, setExceptionReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    dispatch(fetchPlatformSettings());
    dispatch(fetchRevenueConfig({ force: true }));
    ReputationAPI.me().then((res) => { if (res.ok) setReputation(res.data); });
    loadExceptions();
  }, []);

  function loadExceptions() {
    ReputationAPI.myExceptions().then((res) => { if (res.ok && Array.isArray(res.data)) setExceptions(res.data); });
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setContact = (key) => (e) => setForm((f) => ({ ...f, contact: { ...f.contact, [key]: e.target.value } }));
  const prizeValues = [form.p1, form.p2, form.p3].map((v) => parseRupees(v).value || 0);
  const totalPrize = prizeValues.reduce((a, b) => a + b, 0);
  const platformFee = calculatePlatformFee(totalPrize, revenue);
  const ceiling = reputation?.globalMax ?? MAX_PRIZE_POOL;
  const limit = reputation ? Math.min(reputation.limit ?? LARGE_PRIZE_POOL, ceiling) : LARGE_PRIZE_POOL;
  // Above ₹10,00,000 a finance moderator reviews this competition instead of the reputation limit.
  const largePrize = totalPrize > LARGE_PRIZE_POOL && totalPrize <= ceiling;
  const approvedException = exceptions.find((x) => x.status === 'approved' && !x.competitionId && Number(x.requestedAmount) >= totalPrize) || null;
  const overLimit = !largePrize && totalPrize > limit && totalPrize <= ceiling;
  const canRequestException = ['blue', 'green'].includes(reputation?.level || 'blue');
  const blocked = creationBlock(reputation);
  const formats = FORMATS.filter((f) => (f === 'Round Robin' ? platform.allowRoundRobin : platform.allowKnockout));

  // Live prize feedback while typing.
  const prizeErrors = useMemo(() => {
    const next = {};
    ['p1', 'p2', 'p3'].forEach((key, i) => {
      const { error } = parseRupees(form[key], { label: `Place ${i + 1} prize` });
      if (error) next[key] = error;
    });
    const order = validatePrizes(prizeValues);
    Object.entries(order).forEach(([i, msg]) => { next[`p${Number(i) + 1}`] = next[`p${Number(i) + 1}`] || msg; });
    if (totalPrize > ceiling) next.prizeTotal = `The total cannot exceed ${formatINR(ceiling)}.`;
    else if (overLimit && !approvedException) next.prizeTotal = `Your reputation level allows up to ${formatINR(limit)}. Request an exception below to go higher.`;
    return next;
  }, [form.p1, form.p2, form.p3, limit, ceiling, approvedException, overLimit]);

  function validate() {
    const next = { ...prizeErrors };
    const n = validateName(form.name); if (n) next.name = n;
    const d = validateDescription(form.description); if (d) next.description = d;
    if (!form.game) next.game = 'Choose a game.';
    if (!form.format) next.format = 'Choose a format.';
    if (!form.visibility) next.visibility = 'Choose who can register.';
    if (!form.feeType) next.feeType = 'Choose an entry fee option.';
    Object.assign(next, validateSchedule(form));
    const mt = Number(form.maxTeams);
    if (!Number.isInteger(mt) || mt < 2 || mt > platform.maxTeams) next.maxTeams = `Whole number from 2 to ${platform.maxTeams}.`;
    const mp = Number(form.maxPlayers);
    if (!Number.isInteger(mp) || mp < 1 || mp > MAX_PLAYERS) next.maxPlayers = `Whole number from 1 to ${MAX_PLAYERS}.`;
    if (form.feeType && form.feeType !== 'free') {
      const fee = parseRupees(form.entryFee, { label: 'Entry fee', allowEmpty: false });
      if (fee.error) next.entryFee = fee.error;
      else if (fee.value < MIN_ENTRY_FEE) next.entryFee = `The entry fee must be at least ${formatINR(MIN_ENTRY_FEE)}.`;
      else if (fee.value > MAX_ENTRY_FEE) next.entryFee = `The entry fee cannot exceed ₹${MAX_ENTRY_FEE.toLocaleString('en-IN')}.`;
    }
    const me = String(session?.username || '').toLowerCase();
    const coOrgs = form.coOrganizers;
    if (coOrgs.some((c) => c.toLowerCase() === me)) next.coOrganizers = 'You are already the primary organizer.';
    if (largePrize) Object.entries(validateContact(form.contact)).forEach(([key, msg]) => { next[`contact.${key}`] = msg; });
    setErrors(next);
    return Object.keys(next).length === 0 ? coOrgs : null;
  }

  async function onBanner(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { setBanner(await readBanner(file)); } catch (err) { showToast(err.message, 'error'); }
  }

  async function requestException() {
    if (exceptionReason.trim().length < 10) { showToast('Explain why the higher prize pool is needed (at least 10 characters).', 'error'); return; }
    setRequesting(true);
    const res = await ReputationAPI.requestException(totalPrize, exceptionReason.trim());
    setRequesting(false);
    if (!res.ok) { showToast(res.error || 'Unable to send the request.', 'error'); return; }
    setExceptionReason('');
    showToast('Exception request sent to the administrators.');
    loadExceptions();
  }

  function submit(event) {
    event.preventDefault();
    if (blocked) { showToast(blocked, 'error'); return; }
    const coOrganizers = validate();
    if (!coOrganizers) { showToast('Fix the highlighted fields.', 'error'); return; }
    const entryFeeAmount = form.feeType === 'free' ? 0 : parseRupees(form.entryFee).value;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      game: form.game,
      format: form.format,
      type: form.format === 'Round Robin' ? 'league' : 'tournament',
      visibility: form.visibility,
      ...scheduleToIso(form),
      maxTeams: Number(form.maxTeams),
      maxPlayersPerTeam: Number(form.maxPlayers),
      feeType: form.feeType,
      entryFeeAmount,
      prize: totalPrize,
      prizes: prizeValues.map((amount, i) => ({ place: ['1st Place', '2nd Place', '3rd Place'][i], amount })).filter((p) => p.amount > 0),
      coOrganizers,
      ...(banner ? { img: banner } : {}),
      ...(largePrize ? {
        contactDetails: {
          fullName: form.contact.fullName.trim(),
          phone: form.contact.phone.trim(),
          email: form.contact.email.trim(),
          ...(form.contact.organisation.trim() ? { organisation: form.contact.organisation.trim() } : {}),
          purpose: form.contact.purpose.trim(),
        },
      } : {}),
    };
    setCheckout(payload);
  }

  async function publish() {
    setPublishing(true);
    const res = await CompetitionsAPI.create(checkout);
    setPublishing(false);
    if (!res.ok) { showToast(res.error || 'The competition was not created.', 'error'); return; }
    setCheckout(null);
    showToast(res.data.paymentStatus === 'AWAITING_FINANCE_APPROVAL'
      ? 'Draft saved and sent to finance. You can pay the platform fee once they approve the prize pool.'
      : 'Draft saved. Pay the platform fee to publish it.');
    navigate(`/pages/competition-payment.html?id=${encodeURIComponent(res.data.id)}`);
  }

  const err = (key) => errors[key] || (/^p\d$/.test(key) ? prizeErrors[key] : '');

  return (
    <main className="create-comp-page">
      <Link to="/pages/competitions.html" className="back-btn">← Back to competitions</Link>
      <h1 className="page-title">Create competition</h1>
      <p className="page-subtitle">Set up a new tournament for your community.</p>
      {blocked && <Notice tone="danger">{blocked}</Notice>}

      <div className="create-layout">
        <div className="form-card">
          <form noValidate onSubmit={submit}>
            <div className="form-section-title">Basic information</div>
            <Field id="comp-name" label="Competition name *" error={err('name')}>
              <input className="form-input" id="comp-name" type="text" maxLength={100} placeholder="e.g. Summer Showdown 2026" value={form.name} onChange={set('name')} />
            </Field>
            <div className="form-row">
              <Field id="comp-game" label="Game *" error={err('game')}>
                <select className="form-select" id="comp-game" value={form.game} onChange={set('game')}>
                  <option value="">Select game…</option>
                  {GAMES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field id="comp-format" label="Format *" error={err('format')}>
                <select className="form-select" id="comp-format" value={form.format} onChange={set('format')}>
                  <option value="">Select format…</option>
                  {formats.map((f) => <option key={f}>{f}</option>)}
                </select>
              </Field>
            </div>
            <Field id="comp-desc" label="Description *" error={err('description')} help="Rules, schedule and eligibility. At least 10 characters.">
              <textarea className="form-textarea" id="comp-desc" maxLength={2000} value={form.description} onChange={set('description')} />
            </Field>

            <div className="form-section-title">Co-organizers</div>
            <Field id="co-orgs" label="Usernames (optional)" error={err('coOrganizers')} help="Type to search. Each one gets an invitation and becomes a co-organizer only after accepting. Staff accounts cannot co-organize, and co-organizers cannot play.">
              <UsernameChips id="co-orgs" value={form.coOrganizers} onChange={(names) => setForm((f) => ({ ...f, coOrganizers: names }))} max={5} placeholder="Search a username to invite…" />
            </Field>

            <div className="form-section-title">Banner</div>
            <label className="upload-area" style={{ display: 'block', cursor: 'pointer' }}>
              <div className="upload-icon">🖼️</div>
              <div className="upload-text"><span>Click to upload a banner</span> (PNG or JPEG, up to 5 MB).<br />The game&apos;s banner is used if you skip this.</div>
              <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={onBanner} />
            </label>
            <img src={banner || competitionBanner({ game: form.game })} alt="" style={{ width: '100%', borderRadius: 10, marginTop: 12, maxHeight: 180, objectFit: 'cover' }} />
            {banner && <button type="button" className="btn-cancel" style={{ marginTop: 8 }} onClick={() => setBanner('')}>Remove upload</button>}

            <div className="form-section-title">Visibility</div>
            <Field id="comp-visibility" label="Who can register *" error={err('visibility')} help={form.visibility === 'private' ? 'A join code is generated when you publish. You will see it on the competition page.' : form.visibility === 'public' ? 'Anyone eligible can register without a code.' : ''}>
              <select className="form-select" id="comp-visibility" value={form.visibility} onChange={set('visibility')}>
                <option value="" disabled>Choose who can register</option>
                <option value="public">Public — anyone can join</option>
                <option value="private">Private — join code required</option>
              </select>
            </Field>

            <div className="form-section-title">Dates and capacity</div>
            <div className="form-row">
              <Field id="reg-open" label="Registration opens *" error={err('regOpen')}><input className="form-input" type="date" id="reg-open" min={todayInput()} value={form.regOpen} onChange={set('regOpen')} /></Field>
              <Field id="reg-close" label="Registration closes *" error={err('regClose')} help="At least one day after it opens, and at least one day before the start."><input className="form-input" type="date" id="reg-close" min={nextDay(form.regOpen || todayInput())} max={form.start ? previousDay(form.start) : undefined} value={form.regClose} onChange={set('regClose')} /></Field>
            </div>
            <div className="form-row">
              <Field id="start-date" label="Starts *" error={err('start')} help="At least one day after registration closes."><input className="form-input" type="date" id="start-date" min={form.regClose ? nextDay(form.regClose) : nextDay(todayInput())} value={form.start} onChange={set('start')} /></Field>
              <Field id="end-date" label="Ends *" error={err('end')} help="At least one day after the start date."><input className="form-input" type="date" id="end-date" min={form.start ? nextDay(form.start) : todayInput()} value={form.end} onChange={set('end')} /></Field>
            </div>
            <div className="form-row">
              <Field id="max-teams" label={`Max teams (2–${platform.maxTeams}) *`} error={err('maxTeams')}><input className="form-input" type="number" id="max-teams" min="2" max={platform.maxTeams} step="1" value={form.maxTeams} onChange={set('maxTeams')} /></Field>
              <Field id="max-players" label={`Players per team (1–${MAX_PLAYERS}) *`} error={err('maxPlayers')}><input className="form-input" type="number" id="max-players" min="1" max={MAX_PLAYERS} step="1" value={form.maxPlayers} onChange={set('maxPlayers')} /></Field>
            </div>
            <div className="form-row">
              <Field id="fee-type" label="Entry fee *" error={err('feeType')} help={form.feeType === 'per_player' ? 'Every player pays the entry fee, the team captain included.' : ''}>
                <select className="form-select" id="fee-type" value={form.feeType} onChange={set('feeType')}>
                  <option value="" disabled>Choose an entry fee option</option>
                  <option value="free">Free</option>
                  <option value="per_player">Paid</option>
                </select>
              </Field>
              {form.feeType && form.feeType !== 'free' && (
                <Field id="entry-fee" label="Entry fee amount (₹) *" error={err('entryFee')}><input className="form-input" type="number" id="entry-fee" min={MIN_ENTRY_FEE} step="1" value={form.entryFee} onChange={set('entryFee')} /></Field>
              )}
            </div>

            <div className="form-section-title">Prize pool (whole rupees)</div>
            <div className="prize-tiers">
              {[['p1', '🥇', '1st place'], ['p2', '🥈', '2nd place'], ['p3', '🥉', '3rd place']].map(([key, icon, label]) => (
                <div className="prize-tier" key={key}>
                  <div className="prize-tier-main">
                    <div className="prize-rank">{icon}</div>
                    <div className="prize-label">{label}</div>
                    <input className="prize-input" type="number" min="0" step="1" placeholder="0" aria-label={`${label} prize`} value={form[key]} onChange={set(key)} />
                  </div>
                  {err(key) && <p className="ui-field-error">⚠ {err(key)}</p>}
                </div>
              ))}
            </div>
            <div className="ui-card" style={{ marginTop: 14 }}>
              <div className="ui-kv"><span className="k">Total prize pool</span><span className="v" style={{ color: '#c6ff33' }}>{formatINR(totalPrize)}</span></div>
              <div className="ui-kv"><span className="k">Platform fee ({revenue.percentage}% of the prize pool, minimum {formatINR(revenue.minCost)})</span><span className="v">{formatINR(platformFee)}</span></div>
              {prizeErrors.prizeTotal && <p className="ui-field-error">⚠ {prizeErrors.prizeTotal}</p>}
              {overLimit && canRequestException && !approvedException && (
                <div style={{ marginTop: 12 }}>
                  <label className="form-label" htmlFor="exception-reason">Why do you need a higher prize pool?</label>
                  <textarea id="exception-reason" className="form-input" rows={2} maxLength={1000} value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} />
                  <button type="button" className="btn-table-secondary" style={{ marginTop: 8 }} disabled={requesting} onClick={requestException}>{requesting ? 'Sending…' : 'Request a one-time exception'}</button>
                </div>
              )}
              {approvedException && overLimit && <Notice tone="success">An administrator approved up to {formatINR(approvedException.requestedAmount)} for your next competition.</Notice>}
              {largePrize && (
                <div style={{ marginTop: 14 }}>
                  <Notice tone="info">
                    Prize pools above {formatINR(LARGE_PRIZE_POOL)} are reviewed by a finance moderator before the competition can be published.
                    Add your contact details: finance may call or email you to confirm how the prize pool is funded.
                  </Notice>
                  <div className="form-row">
                    <Field id="contact-name" label="Full name *" error={err('contact.fullName')}><input className="form-input" id="contact-name" autoComplete="name" maxLength={80} value={form.contact.fullName} onChange={setContact('fullName')} /></Field>
                    <Field id="contact-org" label="Organisation (optional)"><input className="form-input" id="contact-org" autoComplete="organization" maxLength={120} value={form.contact.organisation} onChange={setContact('organisation')} /></Field>
                  </div>
                  <div className="form-row">
                    <Field id="contact-phone" label="Phone *" error={err('contact.phone')}><input className="form-input" id="contact-phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={20} value={form.contact.phone} onChange={setContact('phone')} /></Field>
                    <Field id="contact-email" label="Email *" error={err('contact.email')}><input className="form-input" id="contact-email" type="email" autoComplete="email" maxLength={120} value={form.contact.email} onChange={setContact('email')} /></Field>
                  </div>
                  <Field id="contact-purpose" label="How is the prize pool funded? *" error={err('contact.purpose')} help="e.g. sponsor name and agreement, or where the money comes from.">
                    <textarea className="form-textarea" id="contact-purpose" maxLength={2000} value={form.contact.purpose} onChange={setContact('purpose')} />
                  </Field>
                </div>
              )}
              {exceptions.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {exceptions.map((x) => (
                    <div className="ui-kv" key={x.id}><span className="k">Exception {formatINR(x.requestedAmount)} · {new Date(x.createdAt).toLocaleDateString('en-IN')}</span><span className="v">{String(x.status).toUpperCase()}{x.competitionId ? ' · USED' : ''}</span></div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 28 }}>
              <button type="submit" className="btn-submit" disabled={!!blocked}>Review and save draft</button>
            </div>
          </form>
        </div>

        <aside className="summary-card">
          <h3>Summary</h3>
          <div className="summary-row"><span className="k">Name</span><span className="v">{form.name.trim() || '—'}</span></div>
          <div className="summary-row"><span className="k">Game</span><span className="v">{form.game || '—'}</span></div>
          <div className="summary-row"><span className="k">Format</span><span className="v">{form.format || '—'}</span></div>
          <div className="summary-row"><span className="k">Teams</span><span className="v">{form.maxTeams || '—'} × {form.maxPlayers || '—'} players</span></div>
          <div className="summary-row"><span className="k">Dates</span><span className="v">{form.start || '—'} → {form.end || '—'}</span></div>
          <div className="summary-row"><span className="k">Prize pool</span><span className="v">{formatINR(totalPrize)}</span></div>
          <div style={{ marginTop: 24 }}>
            <h3>Next steps</h3>
            <div className="steps-list">
              <div className="step-item"><div className="step-num done">✓</div><span className="step-text">Fill in the details</span></div>
              {largePrize && <div className="step-item"><div className="step-num">2</div><span className="step-text">Finance approves the prize pool</span></div>}
              <div className="step-item"><div className="step-num">{largePrize ? 3 : 2}</div><span className="step-text">Pay the platform fee to publish</span></div>
              <div className="step-item"><div className="step-num">{largePrize ? 4 : 3}</div><span className="step-text">Deposit the prize pool into escrow</span></div>
              <div className="step-item"><div className="step-num">{largePrize ? 5 : 4}</div><span className="step-text">Run registrations and fixtures</span></div>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!checkout}
        tone="primary"
        title="Save draft"
        message={checkout ? (largePrize
          ? `"${checkout.name}" is saved as a private draft and sent to the finance moderators with your contact details. Once they approve the ${formatINR(totalPrize)} prize pool, you pay the ${formatINR(platformFee)} platform fee to publish it. Nothing is charged until then.`
          : `"${checkout.name}" is saved as a private draft. Next you pay the ${formatINR(platformFee)} platform fee to publish it${totalPrize > 0 ? ` and deposit the ${formatINR(totalPrize)} prize pool into escrow` : ''}. In mock mode no real money moves.`) : ''}
        confirmLabel={publishing ? 'Saving…' : largePrize ? 'Save and send to finance' : 'Save draft and continue'}
        onConfirm={publish}
        onClose={() => { if (!publishing) setCheckout(null); }}
      />
    </main>
  );
}
