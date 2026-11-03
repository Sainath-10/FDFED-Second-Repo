/** Participant view uses the server roster to verify current membership. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { CompetitionsAPI, MatchesAPI, TeamsAPI } from '../services/api.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/comp-participant.css';

const normalize = (v) => String(v || '').trim().toLowerCase();

function fmtPrize(val) {
  if (!val || ['—', '-', '₹0'].includes(val) || String(val).toLowerCase().includes('no prize')) return 'No Prize Pool';
  const str = String(val).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

function fmtShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseScore(score) {
  const parts = String(score || '').split(/\s*[-:]\s*/).map((part) => part.trim());
  if (parts.length < 2) return [null, null];
  return [parts[0], parts[1]];
}

/** Maps the persisted match record onto the shape this page renders. */
function mapBackendMatch(match, index) {
  const [score1, score2] = parseScore(match.score);
  const scheduled = match.scheduledAt ? new Date(match.scheduledAt) : null;
  const validDate = scheduled && !Number.isNaN(scheduled.getTime());
  const status = match.status === 'ongoing' ? 'live' : (match.status || 'scheduled');
  return {
    id: match.id || `backend-match-${index}`,
    team1: match.team1Name || 'TBD',
    team2: match.team2Name || 'TBD',
    status,
    score1,
    score2,
    winnerName: match.winnerName || '',
    round: match.round || '—',
    date: validDate ? scheduled.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
    time: validDate ? scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
  };
}

export default function CompParticipant() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const compId = params.get('id');

  const [tick, setTick] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [backendMatches, setBackendMatches] = useState([]);
  const [backendStandings, setBackendStandings] = useState([]);

  function freshComp() {
    // §7 — this page must only ever show THE competition it was opened for;
    // no other entry may leak in through fallbacks.
    const all = NexusData ? NexusData.loadCompetitions() : [];
    return all.find((c) => String(c.id) === String(compId)) || {};
  }
  function freshMyTeam(comp) {
    if (!NexusTeamWorkflow || !comp.id || typeof NexusTeamWorkflow.findUserTeamInCompetition !== 'function') return null;
    const bundle = NexusTeamWorkflow.findUserTeamInCompetition(comp.id);
    return bundle && bundle.team ? bundle.team : null;
  }

 // Static metadata read once.
  const comp0 = useMemo(() => freshComp(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const myTeam0 = useMemo(() => freshMyTeam(comp0), [comp0]);

  useEffect(() => {
    if (myTeam0 && normalize(myTeam0.status) === 'banned') {
      showToast('Your team has been banned from this tournament.', 'error');
      navigate(`/pages/comp-info.html?id=${comp0.id || compId || ''}`, { replace: true });
    }
  }, [myTeam0, comp0, compId, navigate]);

 // Poll to refresh dynamic sections every 3s.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  // §7 — fetch the authoritative competition record from the backend and mirror
  // it into the local cache so the summary, schedule and standings all reflect
  // the real record instead of a stale localStorage copy.
  useEffect(() => {
    let cancelled = false;
    if (!compId) { setSyncError('No competition specified in the URL.'); return undefined; }
    CompetitionsAPI.getById(compId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data && res.data.id && NexusData && typeof NexusData.updateCompetition === 'function') {
          // Map backend fields onto the local-cache record shape.
          const b = res.data;
          const local = freshComp();
          NexusData.updateCompetition({
            ...local,
            id: local.id || compId,
            dbId: b.id,
            name: b.name || local.name,
            description: b.description || local.description,
            game: b.game || local.game,
            type: b.type || local.type,
            format: b.format || local.format,
            status: b.status || local.status,
            prizePool: b.prizePool || local.prizePool,
            prize: b.prize ?? local.prize,
            startDate: b.startDate ? String(b.startDate).slice(0, 10) : local.startDate,
            endDate: b.endDate ? String(b.endDate).slice(0, 10) : local.endDate,
            regDeadline: b.registrationCloseAt ? String(b.registrationCloseAt).slice(0, 10) : local.regDeadline,
            maxTeams: b.maxTeams ?? local.maxTeams,
            maxPlayersPerTeam: b.maxPlayersPerTeam ?? local.maxPlayersPerTeam,
            visibility: b.visibility || local.visibility,
            organizers: Array.isArray(b.organizers) ? b.organizers : local.organizers,
          });
          setSyncError('');
        } else if (!res.ok && !/backend|network|Failed to fetch|is the backend/i.test(String(res.error || ''))) {
          setSyncError(res.error || 'This competition could not be loaded.');
        }
      })
      .catch(() => { if (!cancelled) setSyncError(''); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compId]);

  // The participant count follows the live team rosters.
  const [backendTeams, setBackendTeams] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!compId) return undefined;

    async function loadTeams() {
      const res = await TeamsAPI.getByCompetition(compId);
      if (!cancelled) setBackendTeams(res.ok && Array.isArray(res.data) ? res.data : null);
    }

    loadTeams();
    const timer = setInterval(loadTeams, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [compId]);

  // §7/§9/§10 — schedule, bracket and standings come from the authoritative
  // match service (verified results only), not from a stale local cache.
  useEffect(() => {
    let cancelled = false;
    if (!compId) return undefined;

    async function loadMatchData() {
      const [matchRes, standingsRes] = await Promise.all([
        MatchesAPI.getByCompetition(compId),
        MatchesAPI.getStandings(compId),
      ]);
      if (cancelled) return;
      if (matchRes.ok && Array.isArray(matchRes.data)) setBackendMatches(matchRes.data);
      if (standingsRes.ok && Array.isArray(standingsRes.data)) setBackendStandings(standingsRes.data);
    }

    loadMatchData();
    const timer = setInterval(loadMatchData, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [compId]);

  const isLeague = (comp0.type || 'league') === 'league';
  const compName = comp0.name || 'Competition';
  const compGame = comp0.game || 'Unknown Game';
  const compStatus = comp0.status || 'ongoing';
  const compFormat = comp0.format || (isLeague ? 'Round Robin' : 'Single Elimination');
  const compLocation = comp0.location || 'Online';
  const compPrize = comp0.prizePool || comp0.prize || '₹0';
  const compDates = comp0.dates || (comp0.startDate
    ? `${fmtShortDate(comp0.startDate)}${comp0.endDate ? ` – ${fmtShortDate(comp0.endDate)}` : ''}`
    : 'TBD');
  // Distinct players on active teams. The backend roster is the truth; players who
  // joined through a path it doesn't record yet are counted from this browser's copy.
  const compParticipants = (() => {
    const isActive = (team) => !['rejected', 'disbanded', 'banned'].includes(normalize(team && team.status));
    const players = new Set();
    (backendTeams || []).filter(isActive).forEach((team) => {
      (team.memberUsernames || []).forEach((name) => players.add(normalize(name)));
    });
    (comp0.teams || []).filter(isActive).forEach((team) => {
      const server = (backendTeams || []).find((b) => b.id === team.dbId || b.id === team.id);
      if (server && !isActive(server)) return;
      (team.members || [])
        .filter((member) => !server || member.localOnly)
        .forEach((member) => players.add(normalize(member.username)));
    });
    players.delete('');
    return players.size;
  })();
  const compPrizeFormatted = fmtPrize(compPrize);
  const compDesc = comp0.description || `${compName} is a competitive ${compGame} ${isLeague ? 'league' : 'tournament'}. Teams battle across ${isLeague ? 'a structured league format with standings' : 'a knockout bracket'} competing for ${compPrizeFormatted.toLowerCase() === 'no prize pool' ? 'victory' : `the ${compPrizeFormatted}`}.`;

 // Dynamic data recomputed each render (and on each poll tick).
  const comp = freshComp(); // eslint-disable-line react-hooks/exhaustive-deps
  const serverTeam = (backendTeams || []).find(team => !['rejected', 'banned', 'disbanded'].includes(normalize(team.status)) && (team.memberUsernames || []).some(name => normalize(name) === normalize(session?.username)));
  const myTeam = serverTeam ? { ...serverTeam, createdBy: serverTeam.leaderId, members: (serverTeam.memberUsernames || []).map(username => ({ username, role: normalize(username) === normalize(serverTeam.leaderId) ? 'captain' : 'player' })) } : null; // eslint-disable-line react-hooks/exhaustive-deps
  const myTeamName = myTeam ? (myTeam.name || '') : '';
  const rawMatches = Array.isArray(comp.matches) ? comp.matches : [];
  const authoritativeMatches = backendMatches.map(mapBackendMatch);
  const displayMatches = authoritativeMatches;

  const teamName = myTeam ? (myTeam.name || 'My Team') : '';
  const abbr = teamName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'MT';
  const allMembers = myTeam && Array.isArray(myTeam.members) ? myTeam.members : [];
  const captainMember = allMembers.find((m) => ['captain', 'leader'].includes(normalize(m.role)));
  const captainName = (captainMember && (captainMember.displayName || captainMember.username)) || (myTeam && myTeam.createdBy) || 'Team Captain';
  const rosterMembers = allMembers.filter((m) => {
    const isCaptain = ['captain', 'leader'].includes(normalize(m.role)) || normalize(m.username) === normalize(myTeam.createdBy);
    const st = normalize(m.status);
    return isCaptain || !st || st === 'approved' || st === 'active';
  });
  const standingsArr = backendStandings.length
    ? backendStandings.map((row, index) => ({ ...row, rank: index + 1 }))
    : (Array.isArray(comp.standings) ? comp.standings : []);
  let rank = '#—';
  if (standingsArr.length) {
    const idx = standingsArr.findIndex((s) => normalize(s.team) === normalize(teamName));
    if (idx >= 0) rank = `#${standingsArr[idx].rank || idx + 1}`;
  }

  const statusMap = { completed: ['msb msb-completed', 'Completed'], live: ['msb msb-live', '● Live'], upcoming: ['msb msb-upcoming', 'Upcoming'], scheduled: ['msb msb-upcoming', 'Upcoming'] };

  if (backendTeams === null || !serverTeam) return <main className="part-main"><div className="part-panel"><h2>{backendTeams === null ? 'Verifying participation' : 'Participant access unavailable'}</h2><p>{backendTeams === null ? 'Waiting for the current team roster from the server.' : 'You are no longer on an active team in this competition. This dashboard cannot be edited.'}</p><Link to={`/pages/comp-info.html?id=${encodeURIComponent(compId || '')}`}>View competition</Link></div></main>;

  return (
    <>
      <main className="part-main">
        {syncError && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>
            ⚠ {syncError} Showing locally cached data below.
          </div>
        )}
        {!comp0.id && !syncError && (
          <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>
            ⏳ Loading competition details…
          </div>
        )}
        <div className="part-hero" id="part-hero">
          <div className="part-hero-left">
            <div className="part-hero-tags" id="part-hero-tags">
              <span className="hero-tag-status">{String(compStatus).toUpperCase()}</span>
              <span className="hero-tag-game">{compGame}</span>
            </div>
            <h1 className="part-hero-title" id="part-hero-title">{compName}</h1>
            <div className="part-hero-meta" id="part-hero-meta">
              <span className="hero-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>{compDates}</span>
              <span className="hero-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>{compPrizeFormatted}</span>
              <span className="hero-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>{compParticipants} participants</span>
              <span className="hero-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" /><circle cx="12" cy="11" r="3" /></svg>{compLocation}</span>
            </div>
          </div>
          <div className="part-hero-actions" id="part-hero-actions">
            <Link className="hero-btn hero-btn-secondary" to={`/pages/comp-info.html?id=${comp0.id || compId || ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Back
            </Link>

            {isLeague && (
              <button className="hero-btn hero-btn-secondary" onClick={() => document.getElementById('part-standings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                View Standings
              </button>
            )}
          </div>
        </div>

        <div className="part-about-panel" id="part-about-panel">
          <div className="about-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            About This Competition
          </div>
          <p className="about-panel-desc">{compDesc}</p>
          <div className="about-meta-blocks">
            <div className="about-meta-block"><span className="about-meta-label">Type</span><span className="about-meta-val">{isLeague ? 'League' : 'Tournament'}</span></div>
            <div className="about-meta-block"><span className="about-meta-label">Format</span><span className="about-meta-val">{compFormat}</span></div>
            <div className="about-meta-block"><span className="about-meta-label">Location</span><span className="about-meta-val">{compLocation}</span></div>
            <div className="about-meta-block"><span className="about-meta-label">Organizer</span><span className="about-meta-val">{comp0.organizer || comp0.organizerName || comp0.createdBy || 'ArenaHub Events'}</span></div>
          </div>
        </div>

        <div className="part-body">
          <div className="part-panel" id="panel-myteam">
            <div className="part-panel-header">
              <div className="part-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                <span>My Team</span>
              </div>
            </div>
            <div id="my-team-content">
              {!myTeam ? (
                <p style={{ color: '#4b5563', fontSize: 14, padding: '16px 0' }}>You are not currently registered in a team for this competition.</p>
              ) : (
                <>
                  <div className="my-team-card">
                    <div className="my-team-avatar-box">{abbr}</div>
                    <div className="my-team-info">
                      <div className="my-team-name">{teamName}</div>
                      <div className="my-team-sub">{compGame} · {compFormat}</div>
                    </div>
                  </div>
                  <div className="my-team-stats-grid">
                    <div className="my-team-stat"><span className="my-team-stat-lbl">Members</span><span className="my-team-stat-val">{allMembers.length}</span></div>
                    <div className="my-team-stat"><span className="my-team-stat-lbl">Captain</span><span className="my-team-stat-val">{captainName}</span></div>
                    <div className="my-team-stat" style={{ gridColumn: '1/-1' }}><span className="my-team-stat-lbl">{isLeague ? 'League' : 'Tournament'} Rank</span><span className="my-team-stat-val my-team-stat-accent">{rank}</span></div>
                  </div>
                  {rosterMembers.length > 0 ? (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Team Roster · {rosterMembers.length} / {myTeam.maxPlayers || comp.maxPlayersPerTeam || 5} players</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {rosterMembers.map((m) => {
                          const name = m.displayName || m.username || 'Unknown Player';
                          const isCaptain = ['captain', 'leader'].includes(normalize(m.role)) || normalize(m.username) === normalize(myTeam.createdBy);
                          const initials = name.substring(0, 2).toUpperCase();
                          return (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ width: 30, height: 30, borderRadius: 6, background: isCaptain ? 'rgba(198,255,51,0.15)' : '#1e293b', color: isCaptain ? '#C6FF33' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginRight: 12, flexShrink: 0 }}>{initials}</div>
                              <div style={{ fontSize: 14, color: '#f8fafc', fontWeight: 500, flex: 1 }}>
                                {name}
                                {isCaptain
                                  ? <span style={{ fontSize: 10, background: 'rgba(198,255,51,0.15)', color: '#C6FF33', padding: '2px 7px', borderRadius: 4, marginLeft: 8, fontWeight: 600 }}>CAPTAIN</span>
                                  : <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', padding: '2px 7px', borderRadius: 4, marginLeft: 8 }}>PLAYER</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#4b5563', fontSize: 13, marginTop: 16 }}>No players in roster yet.</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="part-panel" id="panel-schedule">
            <div className="part-panel-header">
              <div className="part-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <span>Match Schedule</span>
              </div>
            </div>
            <div className="part-matches-list" id="part-matches-list">
              {displayMatches.length === 0 ? (
                <p style={{ color: '#4b5563', fontSize: 14, padding: '16px 0' }}>No matches scheduled yet.</p>
              ) : (
                displayMatches.map((m, i) => {
                  const status = m.status === 'scheduled' ? 'upcoming' : (m.status || 'upcoming');
                  const [cls, lbl] = statusMap[status] || ['msb msb-upcoming', 'Upcoming'];
                  const myNorm = normalize(myTeamName);
                  const t1Html = myNorm && normalize(m.team1) === myNorm ? <span className="my-hl">{m.team1}</span> : m.team1;
                  const t2Html = myNorm && normalize(m.team2) === myNorm ? <span className="my-hl">{m.team2}</span> : m.team2;
                  const score = m.status === 'completed' ? `${m.score1 ?? '—'} - ${m.score2 ?? '—'}` : (m.status === 'live' ? `${m.score1 || 0} - ${m.score2 || 0}` : null);
                  return (
                    <div className={`part-match-item${m.status === 'live' ? ' part-match-item-live' : ''}`} key={m.id || i}>
                      <div className="part-match-teams">
                        <div className="part-match-title">{t1Html} vs {t2Html}</div>
                        <div className="part-match-round">{m.round || '—'}</div>
                      </div>
                      {score ? <div className="part-match-score">{score}</div> : <div className="part-match-score part-match-score-dim">— : —</div>}
                      <div className="part-match-right">
                        <div className="part-match-time">{m.date || '—'}{m.time ? ` — ${m.time}` : ''}</div>
                        <span className={cls}>{lbl}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="part-section" id="part-standings-section">
          <div className="part-panel-header">
            <div className="part-panel-title-row">
              {isLeague ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="6" height="4" rx="1" /><rect x="15" y="3" width="6" height="4" rx="1" /><rect x="9" y="10" width="6" height="4" rx="1" /><line x1="6" y1="7" x2="6" y2="12" /><line x1="18" y1="7" x2="18" y2="12" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="12" y1="12" x2="12" y2="14" /></svg>
              )}
              <span>{isLeague ? 'Standings' : 'Tournament Bracket'}</span>
            </div>
          </div>
          <div id="part-standings-table">
            {!isLeague ? (() => {
              // §9 — the bracket is rendered from the authoritative match
              // records (verified results only). No winner is computed here.
              const rounds = {};
              displayMatches.forEach((m) => {
                const label = m.round || 'Round 1';
                if (!rounds[label]) rounds[label] = [];
                rounds[label].push(m);
              });
              const labels = Object.keys(rounds);
              if (!labels.length) {
                return (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <p style={{ color: '#9aa4b2', fontSize: 14, margin: '0 0 6px' }}>
                      This is a <strong style={{ color: '#fff' }}>{compFormat}</strong> tournament.
                    </p>
                    <span style={{ fontSize: 12, color: '#4b5563' }}>The bracket appears once the organizer generates fixtures.</span>
                  </div>
                );
              }
              return (
                <div style={{ display: 'flex', gap: 20, overflowX: 'auto', padding: '8px 0 16px', alignItems: 'flex-start' }}>
                  {labels.map((label) => (
                    <div key={label} style={{ minWidth: 230, flex: '1 0 230px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
                      {rounds[label].map((m) => {
                        const done = m.status === 'completed';
                        const winner1 = done && (m.winnerName ? normalize(m.winnerName) === normalize(m.team1) : Number(m.score1) > Number(m.score2));
                        const winner2 = done && (m.winnerName ? normalize(m.winnerName) === normalize(m.team2) : Number(m.score2) > Number(m.score1));
                        return (
                          <div key={m.id} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: winner1 ? '#C6FF33' : '#e2e8f0', fontWeight: winner1 ? 700 : 500 }}>
                              <span>{m.team1}</span><span>{done ? (m.score1 ?? '—') : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: winner2 ? '#C6FF33' : '#e2e8f0', fontWeight: winner2 ? 700 : 500, marginTop: 4 }}>
                              <span>{m.team2}</span><span>{done ? (m.score2 ?? '—') : '—'}</span>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {m.status}{m.date && m.date !== '—' ? ` · ${m.date}${m.time ? ` ${m.time}` : ''}` : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })() : (() => {
              const rows = backendStandings.length
                ? backendStandings.map((s, i) => ({
                  team: s.team,
                  mp: s.mp ?? 0,
                  w: s.w ?? 0,
                  l: s.l ?? 0,
                  pts: s.pts ?? s.points ?? 0,
                  rank: i + 1,
                  you: myTeamName && normalize(s.team) === normalize(myTeamName),
                }))
                : (() => {
                  const teams = (comp.teams || []).filter((t) => t.status === 'approved');
                  const table = {};
                  teams.forEach((t) => { table[t.name] = { team: t.name, mp: 0, w: 0, l: 0, pts: 0 }; });
                  (comp.matches || []).forEach((m) => {
                    if (m.status !== 'completed') return;
                    if (!table[m.team1]) table[m.team1] = { team: m.team1, mp: 0, w: 0, l: 0, pts: 0 };
                    if (!table[m.team2]) table[m.team2] = { team: m.team2, mp: 0, w: 0, l: 0, pts: 0 };
                    const t1 = table[m.team1]; const t2 = table[m.team2];
                    t1.mp += 1; t2.mp += 1;
                    if (m.score1 > m.score2) { t1.w += 1; t1.pts += 3; t2.l += 1; }
                    else if (m.score2 > m.score1) { t2.w += 1; t2.pts += 3; t1.l += 1; }
                    else { t1.pts += 1; t2.pts += 1; }
                  });
                  return Object.values(table).sort((a, b) => (b.pts - a.pts) || (b.w - a.w)).map((s, i) => ({ ...s, rank: i + 1, you: myTeamName && normalize(s.team) === normalize(myTeamName) }));
                })();
              if (!rows.length) return <p style={{ color: '#4b5563', fontSize: 14, padding: '16px 0' }}>No standing data yet.</p>;
              return (
                <div className="part-standings-wrap">
                  <table className="part-standings-table-el">
                    <thead><tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>L</th><th>PTS</th></tr></thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr className={s.you ? 'you-row' : ''} key={s.team}>
                          <td><span className={`s-rank-badge${s.rank <= 3 ? ` s-rank-${s.rank}` : ''}`}>{s.rank}</span></td>
                          <td><span className="s-team-cell"><span className="s-team-name">{s.team}</span>{s.you ? <span className="s-you-tag">You</span> : ''}</span></td>
                          <td style={{ color: '#9aa4b2' }}>{s.mp}</td>
                          <td className="s-green">{s.w}</td>
                          <td className="s-red">{s.l}</td>
                          <td className="s-pts">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      </main>


    </>
  );
}


