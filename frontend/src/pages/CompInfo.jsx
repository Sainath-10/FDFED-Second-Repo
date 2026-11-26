/**
 * NEXUS ESPORTS — Competition Info
 *
 *
 * dispute-modal script). Preserves: the 5 tabs, the computed standings, the
 * owner/team-aware CTA block, the share link, and the raise-dispute modal with
 * its target-type routing.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ReportsAPI as LocalReportsAPI } from '../services/api.js';
import { isCancelledCompetition, isOrganizerOf, useCompetition } from '../services/competitions.js';
import { formatDate, formatINR, copyText, LoadingState } from '../components/ui.jsx';
import useJoinCodeGate from '../hooks/useJoinCodeGate.jsx';
import { MatchesAPI } from '../services/api.js';
import ChatRoom from '../components/ChatRoom.jsx';
import OrganisersInfo from '../components/OrganisersInfo.jsx';
import ReportButton from '../components/ReportButton.jsx';
import CompetitionResults from '../components/CompetitionResults.jsx';
import { showToast } from '../lib/toast.js';
import { competitionBanner } from '../lib/assets.js';
import '../styles/pages/comp-info.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'organisers', label: 'Organisers Info' },
  { id: 'teams', label: 'Teams' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'standings', label: 'Standings' },
  { id: 'rules', label: 'Rules' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'general-chat', label: 'General chat' },
];

const TYPE_MAP = { tournament: 'Single Elimination', league: 'Round Robin' };
const PRIZE_ICONS = ['🥇', '🥈', '🥉'];

const normalize = (v) => String(v || '').trim().toLowerCase();
const formatType = (t) => TYPE_MAP[t] || t || '—';

function getApprovalStatus(comp) {
  return String((comp && comp.approvalStatus) || '').toLowerCase() || 'approved';
}

function buildStandings(compData) {
  const teamNames = (compData.teams || []).filter((t) => t.status === 'approved').map((t) => t.name);
  const table = {};
  teamNames.forEach((name) => { table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] }; });

  (compData.matches || []).forEach((match) => {
    if (match.status !== 'completed') return;
    if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    const t1 = table[match.team1];
    const t2 = table[match.team2];
    t1.mp += 1; t2.mp += 1;
    // The recorded winner decides the result (as on the server), so a knockout
    // tie settled by the host counts as a win, and an edited result is always
    // reflected. Scores are only a fallback, compared as numbers, not text.
    const winner = String(match.winnerName || '').trim();
    const s1 = Number(match.score1);
    const s2 = Number(match.score2);
    const outcome = winner
      ? (winner === match.team1 ? 1 : winner === match.team2 ? 2 : 0)
      : (Number.isFinite(s1) && Number.isFinite(s2) ? (s1 > s2 ? 1 : s2 > s1 ? 2 : 0) : 0);
    if (outcome === 1) {
      t1.w += 1; t2.l += 1; t1.points += 3; t1.last5.unshift('W'); t2.last5.unshift('L');
    } else if (outcome === 2) {
      t2.w += 1; t1.l += 1; t2.points += 3; t1.last5.unshift('L'); t2.last5.unshift('W');
    } else {
      t1.d += 1; t2.d += 1; t1.points += 1; t2.points += 1; t1.last5.unshift('D'); t2.last5.unshift('D');
    }
  });

  return Object.values(table)
    .map((row) => {
      const extra = (compData.customPoints || {})[row.team] || 0;
      row.points = Math.max(0, row.points + extra);
      return { ...row, last5: row.last5.slice(0, 5) };
    })
    .sort((a, b) => (b.points - a.points) || (b.w - a.w))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Maps the persisted match record for the bracket/standings tabs. */
function mapApiMatch(match, index) {
  const [score1 = '—', score2 = '—'] = String(match.score || '').split(/\s*[-:]\s*/);
  const scheduled = match.scheduledAt ? new Date(match.scheduledAt) : null;
  const valid = scheduled && !Number.isNaN(scheduled.getTime());
  return {
    id: match.id || `match-${index}`,
    team1: match.team1Name || 'TBD',
    team2: match.team2Name || 'TBD',
    status: match.status === 'ongoing' ? 'live' : (match.status || 'scheduled'),
    score1,
    score2,
    winnerName: match.winnerName || '',
    round: match.round || '—',
    // Position in the knockout bracket (absent for league fixtures).
    bracketRound: Number.isFinite(Number(match.bracket?.round)) ? Number(match.bracket.round) : null,
    bracketPosition: Number.isFinite(Number(match.bracket?.position)) ? Number(match.bracket.position) : null,
    date: valid ? scheduled.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
    time: valid ? scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
  };
}

export default function CompInfo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSelector((state) => state.auth.session);

  const compId = params.get('id') || '';
  const { loading: compLoading, data: comp } = useCompetition(compId);

  const [tab, setTab] = useState(() => {
    const requestedTab = params.get('tab');
    return TABS.some((item) => item.id === requestedTab) ? requestedTab : 'overview';
  });
  const [removal, setRemoval] = useState(null);

  // Participation revocation is read from the stored decision record. The API
  // enforces the same rule server-side; this only explains the block in the UI.
  useEffect(() => {
    let cancelled = false;
    if (!compId || !session?.username) { setRemoval(null); return undefined; }
    LocalReportsAPI.removalStatus(compId)
      .then((res) => { if (!cancelled && res.ok && res.data) setRemoval(res.data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [compId, session?.username]);

  const backendCompId = comp ? comp.id : null;
  const joinCodeGate = useJoinCodeGate(comp);

  // §9/§10 — bracket and standings use persisted match records, not local cache.
  const [apiMatches, setApiMatches] = useState([]);
  useEffect(() => {
    let cancelled = false;
    if (!compId) return undefined;
    MatchesAPI.getByCompetition(compId)
      .then((res) => {
        if (!cancelled && res.ok && Array.isArray(res.data)) setApiMatches(res.data);
      })
      .catch(() => { /* keep local fallback */ });
    return () => { cancelled = true; };
  }, [compId]);

  useEffect(() => {
    if (comp) document.title = `NEXUS ESPORTS — ${comp.name}`;
  }, [comp]);

  const userKey = normalize(session && session.username);
  const approvalStatus = comp ? getApprovalStatus(comp) : 'approved';
  const isOwner = isOrganizerOf(comp, userKey);
  const isRemoved = !!removal?.removed && !isOwner;
  // A removed player keeps the public competition page and the organiser tab
  // (so a complaint can still be filed) but loses every team-scoped surface.
  const RESTRICTED_TABS = ['teams', 'announcements', 'general-chat'];
  const visibleTabs = isRemoved ? TABS.filter((item) => !RESTRICTED_TABS.includes(item.id)) : TABS;

  useEffect(() => {
    if (isRemoved && RESTRICTED_TABS.includes(tab)) setTab('overview');
  }, [isRemoved, tab]);

  if (compId && compLoading && !comp) {
    return <main className="comp-info-page"><LoadingState label="Loading competition…" /></main>;
  }

  if (!compId || !comp || (approvalStatus !== 'approved' && !isOwner)) {
    return (
      <main className="comp-info-page">
        <Link to="/pages/competitions.html" className="back-btn" style={{ marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Back to Competitions
        </Link>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <h2 style={{ color: 'var(--text-white)', marginBottom: 8 }}>Competition Not Found</h2>
          <p style={{ color: 'var(--text-muted)' }}>This competition may have been removed or the link is invalid.</p>
        </div>
      </main>
    );
  }

  const approvedTeams = comp.activeTeams;
  const bannedNames = new Set(comp.teams.filter((t) => t.status === 'banned').map((t) => normalize(t.name)));
  const authoritativeMatches = apiMatches.map(mapApiMatch);
  const matchSource = authoritativeMatches.length ? authoritativeMatches : (comp.matches || []);
  const standings = buildStandings({ ...comp, matches: matchSource });
  // The full fixture for the Bracket tab: every round, including byes and
  // matches still waiting for their teams, in bracket order.
  const fixtureRounds = (() => {
    const all = matchSource.filter((m) => m.status !== 'cancelled');
    const groups = new Map();
    all.forEach((m, index) => {
      const key = m.bracketRound != null ? `r${m.bracketRound}` : `n${m.round}`;
      if (!groups.has(key)) groups.set(key, { label: m.round || 'Matches', order: m.bracketRound ?? 1000 + index, matches: [] });
      groups.get(key).matches.push(m);
    });
    return [...groups.values()]
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ ...g, matches: [...g.matches].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0)) }));
  })();
  const prizes = comp.prizes || [];
  const hasPrize = comp.prize > 0;
  const prizePhrase = hasPrize ? `the prize pool of ${comp.prizePool}` : 'glory and championship honors';

 // ── CTA logic ──
  const mine = comp.teams.find((t) => t.members.some((m) => normalize(m.username) === userKey) && !['rejected', 'disbanded'].includes(normalize(t.status)));
  const myTeam = mine ? { team: mine, context: { compId: comp.id, teamId: mine.id } } : null;
  const isTeamLeader = !!(mine && normalize(mine.leader) === userKey);

  const teamRosters = approvedTeams.map((t) => ({
    key: t.id,
    name: t.name,
    status: t.status,
    members: t.members.map((m) => ({ username: m.username, isLead: m.role === 'captain' })).sort((a, b) => Number(b.isLead) - Number(a.isLead)),
  }));
  // §6 — only people playing in this competition see rosters and report buttons.
  const isCompetitionParticipant = !!userKey && teamRosters.some((t) => t.members.some((m) => normalize(m.username) === userKey));
  const teamStatus = myTeam && myTeam.team ? String(myTeam.team.status || '').toLowerCase() : '';


  async function onShare() {
    const url = `${window.location.origin}/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`;
    showToast((await copyText(url)) ? 'Competition link copied.' : `Copy this link: ${url}`);
  }

  function onRegister() {
    if (getApprovalStatus(comp) !== 'approved') { showToast('Registration opens only after admin approval.', 'error'); return; }
    if (!session) { navigate('/pages/login.html'); return; }
    if (myTeam && myTeam.context && teamStatus !== 'rejected') {
      navigate(`/pages/team/team-roster.html?compId=${encodeURIComponent(myTeam.context.compId)}&teamId=${encodeURIComponent(myTeam.context.teamId)}`);
      return;
    }
    (async () => {
      // §2.4 — private competitions require the backend-validated join code.
      const code = await joinCodeGate.requireCode();
      if (code === null) return; // cancelled — no navigation, no duplicate records
      if (code) {
        try { sessionStorage.setItem(`nexus.joinCode.${comp.id}`, code); } catch (err) { /* ignore */ }
      }
      navigate(`/pages/join-teams.html?id=${comp.id}`);
    })();
  }

  function onCreate() {
    if (getApprovalStatus(comp) !== 'approved') { showToast('Team creation opens only after admin approval.', 'error'); return; }
    if (!session) { navigate('/pages/login.html'); return; }
    if (myTeam && myTeam.context && teamStatus !== 'rejected') {
      navigate(`/pages/team/team-roster.html?compId=${encodeURIComponent(myTeam.context.compId)}&teamId=${encodeURIComponent(myTeam.context.teamId)}`);
      return;
    }
    (async () => {
      const code = await joinCodeGate.requireCode();
      if (code === null) return;
      if (code) {
        try { sessionStorage.setItem(`nexus.joinCode.${comp.id}`, code); } catch (err) { /* ignore */ }
      }
      navigate(`/pages/create-team.html?id=${comp.id}`);
    })();
  }

 // Button state
  let showManage = isOwner;
  let showRegister = !isOwner && !isRemoved;
  let showCreate = !isOwner && !isRemoved;
  let registerLabel = 'Join Teams';
  let registerDisabled = false;
  let registerStyle = undefined;
  let createLabel = 'Create a New Team';
  let createDisabled = false;
  let rejectedNotice = false;

  const cancelledComp = isCancelledCompetition(comp);
  const registration = comp.registration;
  if (!isOwner && !registration.open && !(myTeam && teamStatus !== 'rejected')) {
    // Same rules the server enforces: no joining before it opens, after it closes, or once play has started.
    registerLabel = registration.label;
    registerDisabled = true;
    registerStyle = { background: '#1a1a1a', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'not-allowed' };
    showCreate = false;
  } else if (!isOwner) {
    if (myTeam && teamStatus !== 'rejected') {
      if (teamStatus === 'banned') {
        registerLabel = '🚫 Team Banned from Tournament';
        registerDisabled = true;
        registerStyle = { background: '#1a1015', color: '#ef4444', border: '1px solid #ef4444', cursor: 'not-allowed' };
        showCreate = false;
      } else if (teamStatus === 'pending') {
        registerLabel = 'Pending Approval';
        registerDisabled = true;
        createLabel = 'Pending Approval';
        createDisabled = true;
      } else {
        registerLabel = 'View My Team';
        if (isTeamLeader) { createLabel = 'Manage My Team'; } else { showCreate = false; }
      }
    } else {
      registerLabel = 'Join a Team';
      createLabel = 'Create a New Team';
      rejectedNotice = teamStatus === 'rejected';
      // Every team slot is taken (the server refuses a new team then too).
      // Joining an existing team with roster space is still possible.
      if (comp.maxTeams > 0 && approvedTeams.length >= comp.maxTeams) {
        createLabel = 'Team Capacity Full';
        createDisabled = true;
      }
    }
  }

  // All organisers stored on this competition (creator + co-organisers),
  // de-duplicated case-insensitively so nobody is listed twice.
  const organisers = Array.from(new Map([comp.createdBy, ...(comp.organizers || [])]
    .filter(Boolean)
    .map((name) => [normalize(name), String(name).replace(/^@/, '')])).values());

  return (
    <>
      <main className="comp-info-page">
        <Link to="/pages/competitions.html" className="back-btn">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4" />
          </svg>
          Back to Competitions
        </Link>

        {isRemoved && (
          <div className="comp-removed-banner" role="alert">
            You have been removed from this competition. You can no longer access its team or competition management features.
          </div>
        )}

        <div className="comp-info-hero" id="comp-hero">
          <img id="comp-hero-img" src={competitionBanner(comp)} alt="" />
          <div className="comp-info-overlay">
            <div className="game" id="comp-hero-game">{comp.game || '—'}</div>
            <h1 id="comp-hero-name">{comp.name || 'Competition'}</h1>
          </div>
          {comp.badge && (
            <span className={`comp-badge ${comp.badgeClass || ''}`} id="comp-hero-badge" style={{ position: 'absolute', top: 20, right: 20, zIndex: 3 }}>{comp.badge}</span>
          )}
        </div>

        {cancelledComp && (
          <div role="status" id="comp-cancelled-notice" style={{ margin: '0 0 20px', padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(231,0,11,0.08)', color: 'var(--text-light)', fontSize: 14, lineHeight: 1.55 }}>
            <strong style={{ color: '#f87171' }}>This competition has been cancelled.</strong>{' '}
            {comp.abandonedReason ? `Reason: ${comp.abandonedReason}. ` : ''}
            {comp.organizerPaid ? 'Every registered player was refunded their entry fee in full. Check Payments in the sidebar for your refund.' : 'Nothing was charged.'}
          </div>
        )}

        <div className="comp-info-body">
          <div className="comp-info-details">
            <div className="tabs-nav">
              {visibleTabs.map((t) => (
                <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} data-tab={t.id} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className={`tab-panel${tab === 'overview' ? ' active' : ''}`} id="tab-overview">
              <CompetitionResults competitionId={comp.id} highlightTeamId={mine?.id} />
              <div className="comp-info-block">
                <h2>About this Tournament</h2>
                <p id="comp-description">
                  {comp.description || `The ${comp.name} is a ${formatType(comp.type)} competition for ${comp.game}. Join teams from around the world to compete for ${prizePhrase}.`}
                </p>
              </div>
              <div className="comp-info-block" style={{ marginTop: 20 }}>
                <h2>Schedule</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} id="comp-schedule">
                  <div className="info-row"><span className="key">Registration Opens</span><span className="val" id="sched-reg-open">{formatDate(comp.registrationOpenAt, true)}</span></div>
                  <div className="info-row"><span className="key">Registration Closes</span><span className="val" id="sched-reg-close">{formatDate(comp.registrationCloseAt, true)}</span></div>
                  <div className="info-row"><span className="key">Competition Dates</span><span className="val" id="sched-dates">{comp.dates || '—'}</span></div>
                </div>
              </div>
              <div className="comp-info-block" style={{ marginTop: 20 }}>
                <h2>Competition Limits</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="info-row"><span className="key">Max Teams</span><span className="val" id="overview-max-teams">{comp.maxTeams ? `${comp.maxTeams} teams` : '—'}</span></div>
                  <div className="info-row"><span className="key">Max Players per Team</span><span className="val" id="overview-max-players">{comp.maxPlayersPerTeam ? `${comp.maxPlayersPerTeam} players per team` : '—'}</span></div>
                </div>
              </div>
            </div>

            <div className={'tab-panel' + (tab === 'organisers' ? ' active' : '')} id="tab-organisers">
              <div className="comp-info-block">
                <h2>Organisers Info</h2>
                <p className="organisers-intro">
                  Everyone who can organise this competition. Select an organiser to open their reputation
                  history, or report a specific organiser to the Community Moderator.
                </p>
                <OrganisersInfo
                  competitionId={comp.id}
                  organisers={organisers}
                />
              </div>
            </div>

            <div className={`tab-panel${tab === 'teams' ? ' active' : ''}`} id="tab-teams">
              {isRemoved ? (
                <div className="comp-info-block">
                  <div className="comp-removed-banner" role="alert">
                    You have been removed from this competition. You can no longer access its team or competition management features.
                  </div>
                </div>
              ) : (
              <div className="comp-info-block">
                <h2 id="teams-heading">Registered Teams ({approvedTeams.length} / {comp.maxTeams || '—'})</h2>
                {/* One roster view for every role. Organisers used to get a
                    reduced card (name + count) while players got rosters; the
                    data was there, the organiser simply could not see it. */}
                <div className="ci-teams-grid" id="comp-teams-grid">
                  {approvedTeams.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No teams have been accepted yet.</p>
                  ) : (
                    teamRosters.map((t) => (
                      <article className="ci-team-card" key={t.key}>
                        <header className="ci-team-head">
                          <span className="ci-team-avatar" aria-hidden="true">{String(t.name || '?').charAt(0).toUpperCase()}</span>
                          <div className="ci-team-title">
                            <h3>{t.name}</h3>
                            <span>{t.members.length} player{t.members.length === 1 ? '' : 's'}</span>
                          </div>
                        </header>
                        <ul className="ci-team-roster">
                          {t.members.map((m) => (
                            <li key={m.username} className="ci-team-player">
                              <span className="ci-player-name" title={m.username}>@{m.username}</span>
                              {m.isLead && <span className="ci-lead-badge">Lead</span>}
                              {/* Reporting stays a participant action; organisers can see the same roster. */}
                              {isCompetitionParticipant && normalize(m.username) !== userKey && (
                                <ReportButton compId={comp.id} against={m.username} targetRole="player" source="comp-info-roster" className="ci-report-btn" />
                              )}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))
                  )}
                </div>
              </div>
              )}
            </div>

            <div className={`tab-panel${tab === 'bracket' ? ' active' : ''}`} id="tab-bracket">
              <div className="comp-info-block">
                <h2>Tournament Bracket</h2>
                <p style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-muted)' }} id="comp-format-desc">
                  {formatType(comp.type)} format. {comp.entryFee ? `Entry fee: ${comp.entryFee}.` : ''} Up to {comp.maxTeams || '—'} teams.
                </p>
                <div className="bracket-row" id="comp-bracket-row" style={{ alignItems: 'flex-start', overflowX: 'auto' }}>
                  {fixtureRounds.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>The fixture has not been generated yet.</p>
                  ) : fixtureRounds.map((roundGroup) => (
                    <div key={roundGroup.label + roundGroup.order} style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-around', minWidth: 190 }}>
                      <div className="round-label" style={{ color: 'var(--accent)' }}>{roundGroup.label}</div>
                    {roundGroup.matches.map((m) => {
                      const isLive = m.status === 'live';
                      const isDone = m.status === 'completed';
                      const isBye = m.status === 'bye';
                      const statusText = isLive ? '🔴 LIVE' : isDone ? 'Completed' : isBye ? 'Bye · advances' : m.status === 'pending' ? 'Awaiting teams' : m.status === 'ready' ? 'Ready to play' : 'Scheduled';
                      const slotName = (name) => (name && name !== 'TBD' ? name : (isBye ? 'BYE' : 'TBD'));
                      const t1Banned = bannedNames.has(normalize(m.team1));
                      const t2Banned = bannedNames.has(normalize(m.team2));
                      // Prefer the persisted winner; never infer one when absent.
                      const winner1 = isDone && (m.winnerName ? normalize(m.winnerName) === normalize(m.team1) : Number(m.score1) > Number(m.score2));
                      const winner2 = isDone && (m.winnerName ? normalize(m.winnerName) === normalize(m.team2) : Number(m.score2) > Number(m.score1));
                      return (
                        <div className="bracket-match" key={m.id || `${m.team1}-${m.team2}-${m.round}`}>
                          <div className="round-label">{statusText}{m.date && m.date !== '—' && !isDone && !isBye ? ` · ${m.date}${m.time ? ` ${m.time}` : ''}` : ''}</div>
                          <div className={`bracket-team ${winner1 ? 'winner' : ''}`}>
                            <span>{t1Banned ? (<><del style={{ color: '#ef4444' }}>{m.team1 || 'TBD'}</del> <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>(BANNED)</span></>) : slotName(m.team1)}</span>
                            <span className="score">{isDone ? m.score1 : '—'}</span>
                          </div>
                          <div className={`bracket-team ${winner2 ? 'winner' : ''}`}>
                            <span>{t2Banned ? (<><del style={{ color: '#ef4444' }}>{m.team2 || 'TBD'}</del> <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>(BANNED)</span></>) : slotName(m.team2)}</span>
                            <span className="score">{isDone ? m.score2 : '—'}</span>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`tab-panel${tab === 'standings' ? ' active' : ''}`} id="tab-standings">
              <div className="comp-info-block">
                <h2 style={{ marginBottom: 20 }}>Standings</h2>
                <div className="standings-table-header">
                  <span className="col-rank">RANK</span><span className="col-team">TEAM</span><span className="col-mp">MP</span>
                  <span className="col-w">W</span><span className="col-l">L</span><span className="col-d">D</span>
                  <span className="col-pts">POINTS</span><span className="col-last5">LAST 5</span>
                </div>
                <div id="standings-rows">
                  {standings.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: 18 }}>No standings yet.</p>
                  ) : (
                    standings.map((row) => {
                      const last = row.last5.length ? row.last5 : ['-', '-', '-', '-', '-'];
                      return (
                        <div className="standings-row" key={row.team}>
                          <span className="col-rank"><span className={`rank-badge ${row.rank === 1 ? 'rank-1' : ''}`}>{String(row.rank).padStart(2, '0')}</span></span>
                          <span className="col-team">{row.team}</span>
                          <span className="col-mp">{row.mp}</span>
                          <span className="col-w stat-green">{row.w}</span>
                          <span className="col-l">{row.l}</span>
                          <span className="col-d">{row.d}</span>
                          <span className="col-pts stat-green">{row.points}</span>
                          <span className="col-last5">
                            <span className="last-five">
                              {last.map((r, i) => (
                                r === 'W' ? <span className="last-chip last-win" key={i}>✔</span>
                                  : r === 'L' ? <span className="last-chip last-loss" key={i}>X</span>
                                    : <span className="last-chip last-draw" key={i}>-</span>
                              ))}
                            </span>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className={`tab-panel${tab === 'rules' ? ' active' : ''}`} id="tab-rules">
              <div className="comp-info-block">
                <h2>Tournament Rules</h2>
                <div id="comp-rules" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15, color: 'var(--text-muted)', lineHeight: '24px' }}>
                  {comp.rules ? (
                    <>
                      {comp.rules.split('\n').filter((r) => r.trim()).map((r, i) => <p key={i}>{i + 1}. {r}</p>)}
                      {comp.maxPlayersPerTeam && !comp.rules.toLowerCase().includes('player') && (
                        <p>{comp.rules.split('\n').filter((r) => r.trim()).length + 1}. Maximum {comp.maxPlayersPerTeam} players allowed per team.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p>1. All participating teams must have valid NEXUS accounts.</p>
                      <p>2. Format: {formatType(comp.type)}. Max {comp.maxTeams || '—'} teams.</p>
                      <p>3. Maximum {comp.maxPlayersPerTeam || 5} players allowed per team.</p>
                      <p>4. Teams must be ready to play within 10 minutes of scheduled match time.</p>
                      <p>5. All matches must be played on official NEXUS tournament servers.</p>
                      <p>6. Entry fee: {comp.entryFee || 'Free'}.</p>
                      <p>7. Prize money is held in escrow and released by a finance moderator after the dispute window closes.</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className={`tab-panel${tab === 'announcements' ? ' active' : ''}`} id="tab-announcements">
                <div className="comp-info-block">
                  <h2>Announcements</h2>
                  <p style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-muted)' }}>Updates from the competition organizers.</p>
                  <ChatRoom
                    scope="competition"
                    id={backendCompId}
                    channel="announcements"
                    canPost={isOwner}
                  />
                </div>
              </div>

              <div className={`tab-panel${tab === 'general-chat' ? ' active' : ''}`} id="tab-general-chat">
                <div className="comp-info-block">
                  <h2>General chat</h2>
                  <p style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-muted)' }}>For organizers and registered team members. You can send up to five messages every 30 seconds.</p>
                  <ChatRoom
                    scope="competition"
                    id={backendCompId}
                    channel="general"
                    canPost={!!session}
                  />
                </div>
              </div>
            </div>

          <aside className="comp-sidebar-panel">
            <div className="comp-sidebar-block">
              <h3>Tournament Info</h3>
              <div className="info-row"><span className="key">Status</span><span className="val" id="info-status" style={{ color: 'var(--accent)' }}>{comp.badge}</span></div>
              <div className="info-row"><span className="key">Game</span><span className="val" id="info-game">{comp.game || '—'}</span></div>
              <div className="info-row"><span className="key">Format</span><span className="val" id="info-format">{formatType(comp.type)}</span></div>
              <div className="info-row"><span className="key">Teams</span><span className="val" id="info-teams">{approvedTeams.length} / {comp.maxTeams || '—'}</span></div>
              <div className="info-row"><span className="key">Date</span><span className="val" id="info-date">{comp.dates || '—'}</span></div>
              <div className="info-row"><span className="key">Prize Pool</span><span className="val" id="info-prize" style={{ color: 'var(--accent)', fontSize: 18 }}>{hasPrize ? comp.prizePool : 'No prize pool'}</span></div>
              {/* Whether the organiser has paid the prize pool into escrow. */}
              {hasPrize && (
                <div className="info-row">
                  <span className="key">Prize pool status</span>
                  <span className="val" id="info-prize-status" style={{ color: comp.prizePoolPaid ? 'var(--accent)' : '#fbbf24' }}>
                    {comp.prizePoolPaid ? 'Paid · held in escrow' : 'Not paid yet'}
                  </span>
                </div>
              )}
            </div>

            <div className="comp-sidebar-block" id="prize-breakdown-block">
              <h3>Prize Breakdown</h3>
              <div className="prize-breakdown" id="comp-prize-breakdown">
                {prizes.length === 0 ? (
                  <div className="prize-row"><span className="place">{PRIZE_ICONS[0]} 1st Place</span><span className="amount">{hasPrize ? comp.prizePool : '—'}</span></div>
                ) : (
                  prizes.map((p, i) => (
                    <div className="prize-row" key={p.place || i}>
                      <span className="place">{PRIZE_ICONS[i] || ''} {p.place}</span>
                      <span className="amount">{formatINR(p.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="comp-sidebar-block" id="comp-cta-block" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              {showManage && (
                <Link to={`/pages/competition-detail.html?id=${comp.id}`} id="btn-manage-comp" className="btn-primary" style={{ width: '100%', textAlign: 'center', padding: 14, fontSize: 15, cursor: 'pointer', border: 'none', textDecoration: 'none', boxSizing: 'border-box' }}>
                  ✏ Manage Competition
                </Link>
              )}
              {showRegister && (
                <button id="btn-register-team" className="btn-primary" style={{ width: '100%', textAlign: 'center', padding: 14, fontSize: 15, cursor: 'pointer', border: 'none', ...registerStyle }} disabled={registerDisabled} onClick={onRegister}>
                  {registerLabel}
                </button>
              )}
              {showCreate && (
                <button id="btn-create-team" className="btn-outline" style={{ width: '100%', textAlign: 'center', padding: 13, fontSize: 14, cursor: createDisabled ? 'not-allowed' : 'pointer', background: 'none', opacity: createDisabled ? 0.6 : 1 }} disabled={createDisabled} onClick={onCreate}>
                  {createLabel}
                </button>
              )}
              <button id="btn-share-comp" className="btn-outline" style={{ width: '100%', textAlign: 'center', padding: 11, fontSize: 13, cursor: 'pointer', background: 'none', opacity: 0.8 }} onClick={onShare}>
                🔗 Share Link
              </button>
              {!isOwner && registration.detail && !(myTeam && teamStatus !== 'rejected') && (
                <p style={{ fontSize: 12, color: registration.open ? 'var(--text-muted)' : '#fbbf24', marginTop: 4, textAlign: 'center' }}>{registration.open ? `Registration ${registration.detail.toLowerCase()}` : registration.detail}</p>
              )}
              {rejectedNotice && (
                <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>⚠ Your previous team registration was rejected. You may join or create a new team.</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      {joinCodeGate.modal}
    </>
  );
}
