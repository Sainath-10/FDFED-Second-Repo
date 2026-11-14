/**
 * NEXUS ESPORTS — My Activity
 *
 * Everything the signed-in user is involved in, loaded from the backend so it
 * is identical on every device: competitions they organize (including unpaid
 * drafts), teams they lead, teams they play on, and co-organizer invitations
 * waiting for an answer. The Action log tab lists what the user did on the
 * platform (and actions that affected them) from the backend audit log.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AuditAPI, CompetitionsAPI } from '../services/api.js';
import ActivityTimeline from '../components/ActivityTimeline.jsx';
import { fetchAllTeams, fetchCompetitions, isCancelledCompetition, mapCompetition } from '../services/competitions.js';
import { EmptyState, ErrorState, LoadingState, formatINR } from '../components/ui.jsx';
import useReportSync from '../hooks/useReportSync.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/my-activity.css';

const lower = (v) => String(v || '').trim().toLowerCase();

/** Organizer-facing money status of a competition. */
function organizerBadge(comp) {
  const p = comp.paymentStatus;
  if (p === 'AWAITING_FINANCE_APPROVAL') return { label: 'Draft — waiting for finance to approve the prize pool', cls: 'act-badge-upcoming' };
  if (p === 'AWAITING_PLATFORM_FEE') return { label: 'Draft — pay the platform fee to publish', cls: 'act-badge-upcoming' };
  if (isCancelledCompetition(comp)) return { label: p === 'EXPIRED' ? 'Draft expired' : 'Cancelled — players refunded', cls: 'act-badge-cancelled' };
  if (p === 'REVERSED') return { label: 'Settlement reversed', cls: 'act-badge-cancelled' };
  if (p === 'PRIZE_RELEASED') return { label: 'Settled — payouts released', cls: 'act-badge-completed' };
  if (p === 'COMPLETED') return { label: 'Ended — awaiting finance review', cls: 'act-badge-upcoming' };
  if (p && p !== 'LEGACY' && !comp.prizePoolPaid) return { label: 'Prize pool not deposited', cls: 'act-badge-upcoming' };
  return { label: 'Published', cls: 'act-approved' };
}

export default function MyActivity() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', comps: [], teams: [], mine: [] });
  const [query, setQuery] = useState('');
  const [view, setView] = useState('overview');
  const loadLog = useCallback(() => AuditAPI.mine(), []);
  const [responding, setResponding] = useState('');
  const username = session?.username || '';

  const load = useCallback(async () => {
    const [list, teams, mine] = await Promise.all([
      fetchCompetitions(),
      fetchAllTeams(),
      CompetitionsAPI.getByOrganizer(encodeURIComponent(username)),
    ]);
    if (!list.ok) { setState((s) => ({ ...s, loading: false, error: list.error || 'Unable to load your activity.' })); return; }
    setState({
      loading: false,
      error: '',
      comps: list.data,
      teams,
      mine: mine.ok && Array.isArray(mine.data) ? mine.data.map((c) => mapCompetition(c)) : [],
    });
  }, [username]);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  const buckets = useMemo(() => {
    const me = lower(username);
    const byId = new Map(state.comps.map((c) => [c.id, c]));
    state.mine.forEach((c) => { if (!byId.has(c.id)) byId.set(c.id, c); });
    const all = [...byId.values()];
    const organized = all.filter((c) => [c.createdBy, ...(c.organizers || [])].some((o) => lower(o) === me));
    const invitations = all.filter((c) => (c.pendingOrganizers || []).some((o) => lower(o) === me));
    const myTeams = state.teams.filter((t) => !['rejected', 'banned', 'disbanded'].includes(lower(t.status)) && t.members.some((m) => lower(m.username) === me));
    const asTeam = (team) => {
      const comp = byId.get(team.competitionId);
      return comp ? { comp, team } : null;
    };
    return {
      organized,
      invitations,
      led: myTeams.filter((t) => lower(t.leader) === me).map(asTeam).filter(Boolean),
      played: myTeams.filter((t) => lower(t.leader) !== me).map(asTeam).filter(Boolean),
    };
  }, [state, username]);

  async function respond(comp, accept) {
    setResponding(comp.id);
    const res = accept ? await CompetitionsAPI.acceptOrganizerInvite(comp.id) : await CompetitionsAPI.declineOrganizerInvite(comp.id);
    setResponding('');
    if (!res.ok) { showToast(res.error || 'Unable to answer the invitation.', 'error'); return; }
    showToast(accept ? `You now co-organize ${comp.name}.` : 'Invitation declined.');
    load();
  }

  const q = query.trim().toLowerCase();
  const match = (comp) => !q || `${comp.name} ${comp.game} ${comp.location}`.toLowerCase().includes(q);

  function card({ comp, team, role }) {
    const href = role === 'organizer'
      ? (['AWAITING_PLATFORM_FEE', 'AWAITING_FINANCE_APPROVAL'].includes(comp.paymentStatus) ? `/pages/competition-payment.html?id=${encodeURIComponent(comp.id)}` : `/pages/competition-detail.html?id=${encodeURIComponent(comp.id)}`)
      : `/pages/team/team-roster.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;
    const badge = role === 'organizer' ? organizerBadge(comp) : null;
    return (
      <div className="act-comp-card" key={`${role}-${comp.id}-${team?.id || ''}`} role="link" tabIndex={0} onClick={() => navigate(href)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(href); }}>
        <div className="act-card-top">
          <div className="act-card-meta">
            <p className="act-card-game">{comp.game}</p>
            <h3 className="act-card-title">{comp.name}</h3>
          </div>
          <div className="act-card-badges">
            <span className={`act-badge ${comp.type === 'league' ? 'act-badge-league' : 'act-badge-tournament'}`}>{comp.type === 'league' ? 'League' : 'Tournament'}</span>
            <span className="act-badge act-badge-ongoing">{comp.badge}</span>
            {badge && <span className={`act-badge ${badge.cls}`}>{badge.label}</span>}
            {team && <span className="act-badge" style={{ background: 'rgba(198,255,51,0.12)', border: '1px solid rgba(198,255,51,0.35)', color: '#c6ff33' }}>{team.name}</span>}
          </div>
        </div>
        <div className="act-card-details">
          <div className="act-detail-row"><span>{comp.dates}</span></div>
          <div className="act-detail-row"><span>{team ? `${team.members.length} / ${comp.maxPlayersPerTeam || 5} players` : `${comp.maxTeams || 0} team slots`}</span></div>
          <div className="act-detail-row"><span>{comp.location}</span></div>
        </div>
        <div className="act-card-footer"><span className="act-prize">{comp.prize > 0 ? `${formatINR(comp.prize)} prize pool` : 'No prize pool'}</span></div>
      </div>
    );
  }

  const sections = [
    { key: 'organized', title: 'Competitions organized', items: buckets.organized.filter(match).map((comp) => ({ comp, role: 'organizer' })) },
    { key: 'led', title: 'Teams you lead', items: buckets.led.filter((x) => match(x.comp)).map((x) => ({ ...x, role: 'captain' })) },
    { key: 'played', title: 'Teams you play on', items: buckets.played.filter((x) => match(x.comp)).map((x) => ({ ...x, role: 'player' })) },
  ];

  return (
    <main className="activity-main">
      <div className="act-page-header">
        <div className="act-header-row">
          <div>
            <h1 className="act-page-title">Your activity</h1>
            <p className="act-page-subtitle">Competitions you organize and the teams you are on.</p>
          </div>
          <Link to="/pages/create-competition.html" className="btn-create">+ Create competition</Link>
        </div>
      </div>

      <div className="ui-tabs" role="tablist" aria-label="Activity views">
        <button type="button" role="tab" aria-selected={view === 'overview'} className={`ui-tab${view === 'overview' ? ' active' : ''}`} onClick={() => setView('overview')}>Competitions &amp; teams</button>
        <button type="button" role="tab" aria-selected={view === 'log'} className={`ui-tab${view === 'log' ? ' active' : ''}`} onClick={() => setView('log')}>Action log</button>
      </div>

      {view === 'log' ? (
        <ActivityTimeline load={loadLog} showActor emptyMessage="Your actions on the platform will appear here." />
      ) : (<>
      <div className="act-search-wrapper">
        <input type="search" className="act-search-input" aria-label="Search your activity" placeholder="Search by name, game or location…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {state.loading && <LoadingState label="Loading your activity…" />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}

      {buckets.invitations.length > 0 && (
        <section className="act-section">
          <h2 className="act-section-title">Co-organizer invitations</h2>
          <div className="ui-list" style={{ marginTop: 12 }}>
            {buckets.invitations.map((comp) => (
              <div className="ui-row" key={comp.id}>
                <div className="ui-row-main">
                  <div className="ui-row-title">{comp.name}</div>
                  <div className="ui-row-meta">@{comp.createdBy} invited you to help run this competition.</div>
                </div>
                <div className="ui-row-actions">
                  <button type="button" className="btn-table-primary" disabled={responding === comp.id} onClick={() => respond(comp, true)}>Accept</button>
                  <button type="button" className="btn-table-danger" disabled={responding === comp.id} onClick={() => respond(comp, false)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!state.loading && !state.error && sections.map((s) => (
        <section className="act-section" key={s.key}>
          <div className="act-section-heading">
            <div>
              <h2 className="act-section-title">{s.title}</h2>
              <p className="act-section-count">{s.items.length}</p>
            </div>
            {s.key === 'organized' && s.items.length > 0 && <Link className="btn-table-secondary" to="/pages/organizer-reports.html">Report queue</Link>}
          </div>
          {s.items.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              message={s.key === 'organized' ? 'Competitions you create appear here.' : 'Join or create a team from the Competitions page.'}
              action={<Link className="btn-table-secondary" to={s.key === 'organized' ? '/pages/create-competition.html' : '/pages/competitions.html'}>{s.key === 'organized' ? 'Create a competition' : 'Browse competitions'}</Link>}
            />
          ) : (
            <div className="act-comp-grid">{s.items.map(card)}</div>
          )}
        </section>
      ))}
      </>)}
    </main>
  );
}
