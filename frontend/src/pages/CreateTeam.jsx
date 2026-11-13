/**
 * NEXUS ESPORTS — Create Team
 *
 * Registers a team with the backend, which checks the registration window,
 * capacity, the private join code, duplicate names, who may play, and takes the
 * entry fee (simulated in mock payment mode). The page previews the team as it
 * is named, and afterwards hands the captain a link to recruit players.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { TeamsAPI } from '../services/api.js';
import { isOrganizerOf, useCompetition } from '../services/competitions.js';
import useJoinCodeGate from '../hooks/useJoinCodeGate.jsx';
import { TeamAvatar } from '../components/TeamHeader.jsx';
import { ConfirmDialog, ErrorState, LoadingState, Notice, copyText, formatDate, formatINR } from '../components/ui.jsx';
import { competitionBanner } from '../lib/assets.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/create-team.css';

const STAFF_ROLES = ['admin', 'super-admin', 'super_admin', 'finance_moderator', 'community_moderator'];

function Steps({ current }) {
  const steps = ['Name your team', 'Register', 'Invite players'];
  return (
    <ol className="ct-steps" aria-label="Progress">
      {steps.map((label, i) => (
        <li key={label} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="ct-step-dot">{i < current ? '✓' : i + 1}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function CompetitionSummary({ comp }) {
  const max = comp.maxTeams || 0;
  const registered = comp.activeTeams.length;
  return (
    <aside className="ct-summary">
      <h2 className="ct-card-title">Competition</h2>
      <div className="ct-kv"><span>Starts</span><strong>{formatDate(comp.startDate, true)}</strong></div>
      <div className="ct-kv"><span>Registration closes</span><strong>{formatDate(comp.registrationCloseAt || comp.startDate, true)}</strong></div>
      <div className="ct-kv"><span>Format</span><strong>{comp.format}</strong></div>
      <div className="ct-kv"><span>Players per team</span><strong>Up to {comp.maxPlayersPerTeam || 5}</strong></div>
      <div className="ct-kv"><span>Entry fee</span><strong>{comp.entryFee}</strong></div>
      <div className="ct-kv"><span>Prize pool</span><strong className="ct-accent">{comp.prize > 0 ? comp.prizePool : 'None'}</strong></div>
      <div className="ct-capacity">
        <div className="ct-capacity-row"><span>Teams registered</span><strong>{registered}{max ? ` / ${max}` : ''}</strong></div>
        {max > 0 && <div className="ct-meter"><span style={{ width: `${Math.min(100, (registered / max) * 100)}%` }} /></div>}
      </div>
      <Link className="ct-link" to={`/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`}>View competition details →</Link>
    </aside>
  );
}

export default function CreateTeam() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const id = params.get('id') || params.get('compId') || '';
  const { loading, error, data: comp, reload } = useCompetition(id);
  const joinCodeGate = useJoinCodeGate(comp);

  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [created, setCreated] = useState(null);

  if (!id) return <main className="main-content"><ErrorState message="Open Create Team from a competition page." /></main>;
  if (loading && !comp) return <main className="main-content"><LoadingState label="Loading competition…" /></main>;
  if (error || !comp) return <main className="main-content"><ErrorState message={error || 'That competition could not be found.'} onRetry={reload} /></main>;

  const me = String(session?.username || '').toLowerCase();
  const myTeam = comp.activeTeams.find((t) => t.members.some((m) => m.username.toLowerCase() === me));
  const organizer = isOrganizerOf(comp, me) || (comp.pendingOrganizers || []).some((o) => String(o).toLowerCase() === me);
  const staff = STAFF_ROLES.includes(String(session?.role || ''));
  const fee = comp.feeType === 'free' ? 0 : comp.entryFeeAmount;
  const trimmed = name.trim();
  const taken = comp.activeTeams.some((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase());
  const nameError = !trimmed ? 'Give your team a name.'
    : trimmed.length < 3 ? 'At least 3 characters.'
      : trimmed.length > 40 ? 'At most 40 characters.'
        : /[<>]/.test(trimmed) ? 'Cannot contain < or >.'
          : taken ? 'Another team in this competition already uses this name.' : '';
  const blocked = !comp.registration.open || organizer || staff || !!myTeam;
  const maxPlayers = comp.maxPlayersPerTeam || 5;

  async function register(joinCode) {
    setBusy(true);
    const res = await TeamsAPI.create({ name: trimmed, competitionId: comp.id, ...(joinCode ? { joinCode } : {}) });
    setBusy(false);
    if (!res.ok) { showToast(res.error || 'Unable to create the team.', 'error'); return false; }
    setCreated(res.data);
    showToast(`Team "${res.data.name}" is registered.`);
    return true;
  }

  async function submit(event) {
    event.preventDefault();
    setTouched(true);
    if (blocked || nameError) return;
    const code = await joinCodeGate.requireCode();
    if (code === null) return;
    if (fee > 0) setConfirming({ joinCode: code });
    else await register(code);
  }

  const banner = (
    <header className="ct-hero" style={{ '--cover': `url("${competitionBanner(comp)}")` }}>
      <Link to={`/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`} className="ct-back">← {comp.name}</Link>
      <div className="ct-hero-copy">
        <span className="ct-eyebrow">{comp.game} · {comp.format}</span>
        <h1>{created ? 'Your team is in' : 'Create your team'}</h1>
        <p>{created ? `${created.name} is registered for ${comp.name}.` : `Register a team for ${comp.name}. You become its captain.`}</p>
      </div>
    </header>
  );

  if (created) {
    const link = `${window.location.origin}/pages/join-teams.html?id=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(created.id)}`;
    const ctx = `compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(created.id)}`;
    return (
      <main className="main-content ct-page">
        {banner}
        <Steps current={2} />
        <div className="ct-layout">
          <section className="ct-card ct-success">
            <div className="ct-success-badge" aria-hidden="true">✓</div>
            <div className="ct-preview">
              <TeamAvatar name={created.name} />
              <div>
                <h2>{created.name}</h2>
                <p>Captain @{session?.username} · 1 of {maxPlayers} players</p>
              </div>
            </div>
            <label className="ct-label" htmlFor="invite-link">Share this link — players who open it can ask to join</label>
            <div className="ct-copy-row">
              <input id="invite-link" type="text" value={link} readOnly className="form-input" onFocus={(e) => e.target.select()} />
              <button type="button" className="td-btn td-btn-primary" onClick={async () => showToast((await copyText(link)) ? 'Link copied.' : 'Copy failed — select the link and copy it.')}>Copy link</button>
            </div>
            <div className="ct-next">
              <Link className="ct-next-card" to={`/pages/team/add-players.html?${ctx}`}>
                <strong>Invite players</strong>
                <span>Search players by username and send invitations.</span>
              </Link>
              <Link className="ct-next-card" to={`/pages/team/team-roster.html?${ctx}`}>
                <strong>Open team dashboard</strong>
                <span>Roster, fixtures, standings and team chat.</span>
              </Link>
            </div>
          </section>
          <CompetitionSummary comp={comp} />
        </div>
      </main>
    );
  }

  return (
    <main className="main-content ct-page">
      {banner}
      <Steps current={0} />

      {!comp.registration.open && <Notice tone="warning">{comp.registration.label}{comp.registration.detail ? ` · ${comp.registration.detail}` : ''}. New teams cannot be registered.</Notice>}
      {organizer && <Notice tone="info">You organise this competition, so you cannot play in it.</Notice>}
      {staff && <Notice tone="info">Staff accounts cannot register teams.</Notice>}
      {myTeam && (
        <Notice tone="success">
          You are already on {myTeam.name}. <Link to={`/pages/team/team-roster.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(myTeam.id)}`}>Open your team</Link>
        </Notice>
      )}

      <div className="ct-layout">
        <form className="ct-card" onSubmit={submit} noValidate>
          <h2 className="ct-card-title">Name your team</h2>
          <p className="ct-help">This is how other teams, the organiser and the bracket will show you.</p>

          <div className="ct-field">
            <label className="ct-label" htmlFor="team-name">Team name</label>
            <input
              id="team-name"
              type="text"
              placeholder="e.g. Midnight Raiders"
              className={`form-input ct-input${touched && nameError ? ' has-error' : ''}`}
              maxLength={40}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={blocked || busy}
            />
            <div className="ct-field-foot">
              <span className={touched && nameError ? 'ui-field-error' : 'ui-field-help'}>{touched && nameError ? nameError : '3–40 characters, unique in this competition.'}</span>
              <span className="ui-field-help">{trimmed.length}/40</span>
            </div>
          </div>

          <div className="ct-preview" aria-label="Preview">
            <TeamAvatar name={trimmed || '?'} />
            <div style={{ minWidth: 0 }}>
              <h3>{trimmed || 'Your team name'}</h3>
              <p>Captain @{session?.username || 'you'}</p>
              <div className="ct-slots" aria-label={`1 of ${maxPlayers} players`}>
                {Array.from({ length: Math.min(maxPlayers, 12) }).map((_, i) => <span key={i} className={i === 0 ? 'is-filled' : ''} />)}
                <small>1 / {maxPlayers} players</small>
              </div>
            </div>
          </div>

          <ul className="ct-rules">
            <li>You become the captain: you invite players, approve join requests and manage the roster until play starts.</li>
            <li>{fee > 0
              ? comp.feeType === 'per_player'
                ? `Each player pays their own ${formatINR(fee)} entry fee — you pay yours now.`
                : `You pay the ${formatINR(fee)} team entry fee now.`
              : 'This competition is free to enter.'}
              {fee > 0 && ' Fees are held in escrow and refunded in full if you unregister before the start or the competition is cancelled.'}</li>
            <li>Organisers and staff accounts can never be added to a team.</li>
          </ul>

          <div className="ct-actions">
            <button type="button" className="td-btn" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="td-btn td-btn-primary ct-submit" disabled={blocked || busy}>
              {busy ? 'Registering…' : fee > 0 ? `Continue to payment · ${formatINR(fee)}` : 'Create team'}
            </button>
          </div>
        </form>

        <CompetitionSummary comp={comp} />
      </div>

      <ConfirmDialog
        open={!!confirming}
        title="Confirm registration fee"
        tone="primary"
        message={`Pay ${formatINR(fee)} to register "${trimmed}" for ${comp.name}. The fee is held in escrow and refunded in full if you unregister before the start or the competition is cancelled. (Mock mode: no real money moves.)`}
        confirmLabel={`Pay ${formatINR(fee)} and register`}
        onConfirm={async () => { const ok = await register(confirming.joinCode); if (ok) setConfirming(null); }}
        onClose={() => setConfirming(null)}
      />
      {joinCodeGate.modal}
    </main>
  );
}
