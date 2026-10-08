/**
 * NEXUS ESPORTS — Competition Info
 *
 *
 * dispute-modal script). Preserves: the 5 tabs, the computed standings, the
 * owner/team-aware CTA block, the share link, and the raise-dispute modal with
 * its target-type routing.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/comp-info.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'teams', label: 'Teams' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'standings', label: 'Standings' },
  { id: 'rules', label: 'Rules' },
];

const STATUS_MAP = { ongoing: 'Ongoing', upcoming: 'Registration Open', completed: 'Completed', live: 'LIVE' };
const TYPE_MAP = { tournament: 'Single Elimination', league: 'Round Robin' };
const PRIZE_ICONS = ['🥇', '🥈', '🥉'];

const normalize = (v) => String(v || '').trim().toLowerCase();
const formatStatus = (s) => STATUS_MAP[s] || s || '—';
const formatType = (t) => TYPE_MAP[t] || t || '—';

function getApprovalStatus(comp) {
  if (NexusData && typeof NexusData.getApprovalStatus === 'function') return NexusData.getApprovalStatus(comp);
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
    if (match.score1 > match.score2) {
      t1.w += 1; t2.l += 1; t1.points += 3; t1.last5.unshift('W'); t2.last5.unshift('L');
    } else if (match.score2 > match.score1) {
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

export default function CompInfo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const compId = params.get('id') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('last_comp_id') : '') || '';
  const comp = useMemo(() => (compId && NexusData ? NexusData.getCompetitionById(compId) : null), [compId]);

  const [tab, setTab] = useState('overview');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [dTargetType, setDTargetType] = useState('');
  const [dTargetUser, setDTargetUser] = useState('');
  const [dReason, setDReason] = useState('');
  const [dEvidence, setDEvidence] = useState('');

  useEffect(() => {
    if (comp) document.title = `NEXUS ESPORTS — ${comp.name}`;
  }, [comp]);

  const userKey = normalize(session && session.username);
  const approvalStatus = comp ? getApprovalStatus(comp) : 'approved';
  const isCoOrg = !!(comp && Array.isArray(comp.organizers) && comp.organizers.map(normalize).includes(userKey));
  const isOwner = !!(comp && userKey && (isCoOrg || normalize(comp.organizerId) === userKey || normalize(comp.createdBy) === userKey));

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

  const approvedTeams = (comp.teams || []).filter((t) => t.status === 'approved');
  const standings = buildStandings(comp);
  const matches = (comp.matches || []).filter((m) => ['completed', 'live', 'scheduled'].includes(m.status));
  const prizes = comp.prizes || [];
  const hasPrize = comp.prizePool && !['No Prize Pool', '₹0', '—'].includes(comp.prizePool);
  const prizePhrase = hasPrize ? `the prize pool of ${comp.prizePool}` : 'glory and championship honors';

 // ── CTA logic ──
  const myTeam = (NexusTeamWorkflow && typeof NexusTeamWorkflow.findUserTeamInCompetition === 'function')
    ? NexusTeamWorkflow.findUserTeamInCompetition(comp.id)
    : null;
  const isTeamLeader = !!(myTeam && myTeam.team && normalize(myTeam.team.createdBy) === userKey);
  const teamStatus = myTeam && myTeam.team ? String(myTeam.team.status || '').toLowerCase() : '';

  function onShare() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('Competition link copied to clipboard!'))
        .catch(() => { window.prompt('Copy this link:', url); });
    } else {
      window.prompt('Copy this link:', url);
    }
  }

  function onRegister() {
    if (getApprovalStatus(comp) !== 'approved') { showToast('Registration opens only after admin approval.', 'error'); return; }
    if (!session) { navigate('/pages/login.html'); return; }
    if (myTeam && myTeam.context && teamStatus !== 'rejected') {
      navigate(`/pages/comp-participant.html?id=${encodeURIComponent(myTeam.context.compId)}`);
      return;
    }
    navigate(`/pages/join-teams.html?id=${comp.id}`);
  }

  function onCreate() {
    if (getApprovalStatus(comp) !== 'approved') { showToast('Team creation opens only after admin approval.', 'error'); return; }
    if (!session) { navigate('/pages/login.html'); return; }
    if (myTeam && myTeam.context && teamStatus !== 'rejected') {
      if (isTeamLeader) {
        navigate(`/pages/team/team-roster.html?compId=${encodeURIComponent(myTeam.context.compId)}&teamId=${encodeURIComponent(myTeam.context.teamId)}`);
      } else {
        navigate(`/pages/comp-participant.html?id=${encodeURIComponent(myTeam.context.compId)}`);
      }
      return;
    }
    navigate(`/pages/create-team.html?id=${comp.id}`);
  }

 // Button state
  let showManage = isOwner;
  let showRegister = !isOwner;
  let showCreate = !isOwner;
  let registerLabel = 'Join Teams';
  let registerDisabled = false;
  let registerStyle = undefined;
  let createLabel = 'Create a New Team';
  let createDisabled = false;
  let showDispute = isOwner;
  let rejectedNotice = false;

  if (!isOwner) {
    if (myTeam && teamStatus !== 'rejected') {
      if (teamStatus === 'banned') {
        registerLabel = '🚫 Team Banned from Tournament';
        registerDisabled = true;
        registerStyle = { background: '#1a1015', color: '#ef4444', border: '1px solid #ef4444', cursor: 'not-allowed' };
        showCreate = false;
        showDispute = false;
      } else if (teamStatus === 'pending') {
        registerLabel = 'Pending Approval';
        registerDisabled = true;
        createLabel = 'Pending Approval';
        createDisabled = true;
      } else {
        registerLabel = 'View My Team';
        if (isTeamLeader) { createLabel = 'Manage My Team'; } else { showCreate = false; }
        showDispute = true;
      }
    } else {
      registerLabel = 'Join a Team';
      createLabel = 'Create a New Team';
      showDispute = false;
      rejectedNotice = teamStatus === 'rejected';
    }
  }

 // ── Dispute modal data ──
  const participants = (NexusData && typeof NexusData.getCompetitionParticipants === 'function')
    ? NexusData.getCompetitionParticipants(compId)
    : { teams: [], players: [], organizer: 'organizer' };
  const currentTeamName = (() => {
    const teams = comp.teams || [];
    const matchesUser = (value) => normalize(typeof value === 'string' ? value : (value && (value.username || value.name || value.id))) === userKey;
    const found = teams.find((t) => matchesUser(t.createdBy) || matchesUser(t.leaderId) || matchesUser(t.leaderUsername) || matchesUser(t.captain)
      || (Array.isArray(t.members) && t.members.some(matchesUser)) || (Array.isArray(t.players) && t.players.some(matchesUser)));
    return found ? normalize(found.name) : '';
  })();

  let targetOptions = [{ value: '', label: '— Select Category First —' }];
  let targetLabel = 'Choose Target *';
  let routingHint = null;
  if (dTargetType === 'team') {
    targetLabel = 'Choose Tournament Team *';
    routingHint = '📋 Dispute sent to Tournament Organizer for review.';
    const teams = (participants.teams || []).filter((t) => normalize(t.name) !== currentTeamName);
    targetOptions = teams.length
      ? [{ value: '', label: '— Select a Team —' }, ...teams.map((t) => ({ value: t.name, label: `${t.name} (${t.status || 'registered'})` }))]
      : [{ value: '', label: '— No other teams available —' }];
  } else if (dTargetType === 'player') {
    targetLabel = 'Choose Tournament Player *';
    routingHint = '📋 Dispute sent to Tournament Organizer for review.';
    const players = (participants.players || []).filter((u) => normalize(u) !== userKey);
    targetOptions = players.length
      ? [{ value: '', label: '— Select a Player —' }, ...players.map((u) => ({ value: u, label: `@${u}` }))]
      : [{ value: '', label: '— No other players available —' }];
  } else if (dTargetType === 'organizer') {
    targetLabel = 'Tournament Organizer *';
    routingHint = '📢 Dispute against Organizer is routed directly to Platform Admin.';
    targetOptions = normalize(participants.organizer) === userKey
      ? [{ value: '', label: 'You cannot dispute yourself as organizer' }]
      : [{ value: participants.organizer, label: `${participants.organizer} (Organizer)` }];
  }

  function openDispute() {
    setDTargetType('');
    setDTargetUser('');
    setDReason('');
    setDEvidence('');
    setDisputeOpen(true);
  }

  function submitDispute(event) {
    event.preventDefault();
    const targetUserOrTeam = dTargetUser.trim();
    const reason = dReason.trim();
    if (!dTargetType || !targetUserOrTeam || reason.length < 10) {
      showToast('Please fill in all required fields (target and min. 10 chars reason).', 'error');
      return;
    }
    if (userKey && normalize(targetUserOrTeam) === userKey) {
      showToast('You cannot raise a dispute against yourself.', 'error');
      return;
    }
    if (NexusData && typeof NexusData.addDispute === 'function') {
      const evidenceUrls = dEvidence.trim() ? dEvidence.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const result = NexusData.addDispute({
        competitionId: compId,
        reportedBy: (session && session.username) || 'anonymous',
        targetType: dTargetType,
        targetUserOrTeam,
        reason,
        evidenceUrls,
        status: dTargetType === 'organizer' ? 'open_admin' : 'open_organizer',
        organizerWarnings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (result && result.ok === false) {
        showToast(result.error || 'Dispute blocked.', 'error');
        return;
      }
    }
    setDisputeOpen(false);
    showToast('Dispute submitted');
  }

  return (
    <>
      <main className="comp-info-page">
        <Link to="/pages/competitions.html" className="back-btn">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4" />
          </svg>
          Back to Competitions
        </Link>

        {approvalStatus === 'pending' && (
          <div style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid #fb923c', borderRadius: 12, padding: '16px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 28 }}>⏳</span>
            <div>
              <h4 style={{ margin: '0 0 4px', color: '#fb923c', fontSize: 16, fontWeight: 700 }}>Pending Admin Approval</h4>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: 13 }}>
                This tournament's prize pool ({comp.prizePool || 'High Stakes'}) exceeds ₹50,000. It is currently under review by Platform Admin and will be published publicly once approved.
              </p>
            </div>
          </div>
        )}

        <div className="comp-info-hero" id="comp-hero">
          <img id="comp-hero-img" src={assetUrl(comp.img) || assetUrl('b890c61489a080992ad7e99adabb1145e6d59606.png')} alt="" />
          <div className="comp-info-overlay">
            <div className="game" id="comp-hero-game">{comp.game || '—'}</div>
            <h1 id="comp-hero-name">{comp.name || 'Competition'}</h1>
          </div>
          {comp.badge && (
            <span className={`comp-badge ${comp.badgeClass || ''}`} id="comp-hero-badge" style={{ position: 'absolute', top: 20, right: 20, zIndex: 3 }}>{comp.badge}</span>
          )}
        </div>

        <div className="comp-info-body">
          <div className="comp-info-details">
            <div className="tabs-nav">
              {TABS.map((t) => (
                <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} data-tab={t.id} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className={`tab-panel${tab === 'overview' ? ' active' : ''}`} id="tab-overview">
              <div className="comp-info-block">
                <h2>About this Tournament</h2>
                <p id="comp-description">
                  {comp.description || `The ${comp.name} is a ${formatType(comp.type)} competition for ${comp.game}. Join teams from around the world to compete for ${prizePhrase}.`}
                </p>
              </div>
              <div className="comp-info-block" style={{ marginTop: 20 }}>
                <h2>Schedule</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} id="comp-schedule">
                  <div className="info-row"><span className="key">Registration Opens</span><span className="val" id="sched-reg-open">{(comp.registrationDates || {}).open || '—'}</span></div>
                  <div className="info-row"><span className="key">Registration Closes</span><span className="val" id="sched-reg-close">{(comp.registrationDates || {}).close || '—'}</span></div>
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

            <div className={`tab-panel${tab === 'teams' ? ' active' : ''}`} id="tab-teams">
              <div className="comp-info-block">
                <h2 id="teams-heading">Registered Teams ({approvedTeams.length} / {comp.maxTeams || '—'})</h2>
                <div className="teams-grid" id="comp-teams-grid">
                  {approvedTeams.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No teams have been accepted yet.</p>
                  ) : (
                    approvedTeams.map((t) => (
                      <div className="team-card" key={t.id || t.name}>
                        <div className="name">{t.name || 'Unknown Team'}</div>
                        <div className="players">{t.players || '—'} Players</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className={`tab-panel${tab === 'bracket' ? ' active' : ''}`} id="tab-bracket">
              <div className="comp-info-block">
                <h2>Tournament Bracket</h2>
                <p style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-muted)' }} id="comp-format-desc">
                  {formatType(comp.type)} format. {comp.entryFee ? `Entry fee: ${comp.entryFee}.` : ''} Up to {comp.maxTeams || '—'} teams.
                </p>
                <div className="bracket-row" id="comp-bracket-row">
                  {matches.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No matches scheduled yet.</p>
                  ) : (
                    matches.map((m) => {
                      const isLive = m.status === 'live';
                      const isDone = m.status === 'completed';
                      const t1Banned = NexusData && NexusData.isTeamBannedInComp && NexusData.isTeamBannedInComp(m.team1, comp);
                      const t2Banned = NexusData && NexusData.isTeamBannedInComp && NexusData.isTeamBannedInComp(m.team2, comp);
                      return (
                        <div className="bracket-match" key={m.id || `${m.team1}-${m.team2}-${m.round}`}>
                          <div className="round-label">{m.round || 'Match'} · {isLive ? '🔴 LIVE' : (isDone ? 'Completed' : 'Scheduled')}</div>
                          <div className={`bracket-team ${isDone && m.score1 >= m.score2 ? 'winner' : ''}`}>
                            <span>{t1Banned ? (<><del style={{ color: '#ef4444' }}>{m.team1 || 'TBD'}</del> <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>(BANNED)</span></>) : (m.team1 || 'TBD')}</span>
                            <span className="score">{isDone ? m.score1 : '—'}</span>
                          </div>
                          <div className={`bracket-team ${isDone && m.score2 > m.score1 ? 'winner' : ''}`}>
                            <span>{t2Banned ? (<><del style={{ color: '#ef4444' }}>{m.team2 || 'TBD'}</del> <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>(BANNED)</span></>) : (m.team2 || 'TBD')}</span>
                            <span className="score">{isDone ? m.score2 : '—'}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
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
                      <p>7. Prize money will be distributed within 14 business days of tournament conclusion.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="comp-sidebar-panel">
            <div className="comp-sidebar-block">
              <h3>Tournament Info</h3>
              <div className="info-row"><span className="key">Status</span><span className="val" id="info-status" style={{ color: 'var(--accent)' }}>{formatStatus(comp.status)}</span></div>
              <div className="info-row"><span className="key">Game</span><span className="val" id="info-game">{comp.game || '—'}</span></div>
              <div className="info-row"><span className="key">Format</span><span className="val" id="info-format">{formatType(comp.type)}</span></div>
              <div className="info-row"><span className="key">Teams</span><span className="val" id="info-teams">{approvedTeams.length} / {comp.maxTeams || '—'}</span></div>
              <div className="info-row"><span className="key">Date</span><span className="val" id="info-date">{comp.dates || '—'}</span></div>
              <div className="info-row"><span className="key">Prize Pool</span><span className="val" id="info-prize" style={{ color: 'var(--accent)', fontSize: 18 }}>{comp.prizePool || '—'}</span></div>
            </div>

            <div className="comp-sidebar-block" id="prize-breakdown-block">
              <h3>Prize Breakdown</h3>
              <div className="prize-breakdown" id="comp-prize-breakdown">
                {prizes.length === 0 ? (
                  <div className="prize-row"><span className="place">{PRIZE_ICONS[0]} 1st Place</span><span className="amount">{comp.prizePool || '—'}</span></div>
                ) : (
                  prizes.map((p, i) => (
                    <div className="prize-row" key={p.place || i}>
                      <span className="place">{PRIZE_ICONS[i] || ''} {p.place}</span>
                      <span className="amount">{p.amount || '—'}</span>
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
                <button id="btn-create-team" className="btn-outline" style={{ width: '100%', textAlign: 'center', padding: 13, fontSize: 14, cursor: 'pointer', background: 'none' }} disabled={createDisabled} onClick={onCreate}>
                  {createLabel}
                </button>
              )}
              {showDispute && (
                <button id="btn-dispute" className="btn-outline" style={{ width: '100%', textAlign: 'center', padding: 13, fontSize: 14, cursor: 'pointer', background: 'none', borderColor: '#f87171', color: '#f87171', fontWeight: 600 }} onClick={openDispute}>
                  ⚠ Raise Dispute
                </button>
              )}
              <button id="btn-share-comp" className="btn-outline" style={{ width: '100%', textAlign: 'center', padding: 11, fontSize: 13, cursor: 'pointer', background: 'none', opacity: 0.8 }} onClick={onShare}>
                🔗 Share Link
              </button>
              {rejectedNotice && (
                <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>⚠ Your previous team registration was rejected. You may join or create a new team.</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      {disputeOpen && (
        <div id="modal-raise-dispute" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setDisputeOpen(false); }}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, width: 'min(96vw,520px)', padding: 32, position: 'relative', boxShadow: '0 20px 60px #000a' }}>
            <button onClick={() => setDisputeOpen(false)} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', color: '#9aa4b2', fontSize: 20, cursor: 'pointer' }}>✕</button>
            <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: 20 }}>⚠ Raise a Dispute</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 13 }}>Select whether the dispute is against a Team, a Player, or the Organizer.</p>

            <form onSubmit={submitDispute}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Dispute Against *</label>
                <select id="dispute-target-type" required value={dTargetType} onChange={(e) => { setDTargetType(e.target.value); setDTargetUser(''); }} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
                  <option value="">— Select Target Entity —</option>
                  <option value="team">Team (Opponent)</option>
                  <option value="player">Player (Participant)</option>
                  <option value="organizer">Tournament Organizer</option>
                </select>
                {routingHint && <p style={{ margin: '6px 0 0', fontSize: 12, color: dTargetType === 'organizer' ? '#fb923c' : '#94a3b8' }}>{routingHint}</p>}
              </div>

              <div style={{ marginBottom: 16 }} id="target-select-container">
                <label id="target-select-label" style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{targetLabel}</label>
                <select id="dispute-target-user" required value={dTargetUser} onChange={(e) => setDTargetUser(e.target.value)} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
                  {targetOptions.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Reason / Description *</label>
                <textarea id="dispute-reason" required rows="4" placeholder="Describe the issue in detail (min. 10 characters)..." value={dReason} onChange={(e) => setDReason(e.target.value)} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Evidence Links (optional)</label>
                <input id="dispute-evidence" type="text" placeholder="e.g. https://imgur.com/screenshot, https://youtube.com/clip" value={dEvidence} onChange={(e) => setDEvidence(e.target.value)} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                <p style={{ margin: '5px 0 0', fontSize: 11, color: '#64748b' }}>Separate multiple links with a comma</p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setDisputeOpen(false)} style={{ flex: 1, padding: 12, background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: 12, background: '#f87171', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Submit Dispute</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


