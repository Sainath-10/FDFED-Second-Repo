/**
 * NEXUS ESPORTS — Participant competition view
 *
 *
 * dispute-modal script: hero/about, live My Team + Match Schedule + Standings
 * (re-read from storage and refreshed every 3s), the banned-team redirect, and the
 * raise-dispute modal.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/comp-participant.css';

const normalize = (v) => String(v || '').trim().toLowerCase();

function fmtPrize(val) {
  if (!val || ['—', '-', '₹0'].includes(val) || String(val).toLowerCase().includes('no prize')) return 'No Prize Pool';
  const str = String(val).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

export default function CompParticipant() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const compId = params.get('id');

  const [tick, setTick] = useState(0);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [dTargetType, setDTargetType] = useState('');
  const [dTargetUser, setDTargetUser] = useState('');
  const [dReason, setDReason] = useState('');
  const [dEvidence, setDEvidence] = useState('');

  function freshComp() {
    const all = NexusData ? NexusData.loadCompetitions() : [];
    return all.find((c) => String(c.id) === String(compId)) || all.find((c) => c.role === 'participant') || {};
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

  const isLeague = (comp0.type || 'league') === 'league';
  const compName = comp0.name || 'Competition';
  const compGame = comp0.game || 'Unknown Game';
  const compStatus = comp0.status || 'ongoing';
  const compFormat = comp0.format || (isLeague ? 'Round Robin' : 'Single Elimination');
  const compLocation = comp0.location || 'Online';
  const compPrize = comp0.prizePool || comp0.prize || '₹0';
  const compDates = comp0.dates || 'TBD';
  const compParticipants = comp0.participants || comp0.registeredTeams || 0;
  const compPrizeFormatted = fmtPrize(compPrize);
  const compDesc = comp0.description || `${compName} is a competitive ${compGame} ${isLeague ? 'league' : 'tournament'}. Teams battle across ${isLeague ? 'a structured league format with standings' : 'a knockout bracket'} competing for ${compPrizeFormatted.toLowerCase() === 'no prize pool' ? 'victory' : `the ${compPrizeFormatted}`}.`;

 // Dynamic data recomputed each render (and on each poll tick).
  const comp = freshComp(); // eslint-disable-line react-hooks/exhaustive-deps
  const myTeam = freshMyTeam(comp); // eslint-disable-line react-hooks/exhaustive-deps
  const myTeamName = myTeam ? (myTeam.name || '') : '';
  const rawMatches = Array.isArray(comp.matches) ? comp.matches : [];

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
  const standingsArr = Array.isArray(comp.standings) ? comp.standings : [];
  let rank = '#—';
  if (standingsArr.length) {
    const idx = standingsArr.findIndex((s) => normalize(s.team) === normalize(teamName));
    if (idx >= 0) rank = `#${standingsArr[idx].rank || idx + 1}`;
  }

  const statusMap = { completed: ['msb msb-completed', 'Completed'], live: ['msb msb-live', '● Live'], upcoming: ['msb msb-upcoming', 'Upcoming'], scheduled: ['msb msb-upcoming', 'Upcoming'] };

 // Dispute modal data
  const participants = (NexusData && NexusData.getCompetitionParticipants) ? NexusData.getCompetitionParticipants(compId) : { teams: [], players: [], organizer: 'organizer' };
  const currentTeamName = (() => {
    const teams = comp.teams || [];
    const matchesUser = (value) => normalize(typeof value === 'string' ? value : (value && (value.username || value.name || value.id))) === normalize(session && session.username);
    const found = teams.find((t) => matchesUser(t.createdBy) || matchesUser(t.leaderId) || matchesUser(t.leaderUsername) || matchesUser(t.captain)
      || (Array.isArray(t.members) && t.members.some(matchesUser)) || (Array.isArray(t.players) && t.players.some(matchesUser)));
    return found ? normalize(found.name) : '';
  })();
  const userKey = normalize(session && session.username);

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
    const reason = dReason.trim();
    if (!dTargetType || !dTargetUser.trim() || reason.length < 10) {
      showToast('Please fill in all required fields (target and min. 10 chars reason).', 'error');
      return;
    }
    if (userKey && normalize(dTargetUser) === userKey) { showToast('You cannot raise a dispute against yourself.', 'error'); return; }
    if (NexusData && NexusData.addDispute) {
      const evidenceUrls = dEvidence.trim() ? dEvidence.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const result = NexusData.addDispute({
        competitionId: compId,
        reportedBy: (session && session.username) || 'anonymous',
        targetType: dTargetType,
        targetUserOrTeam: dTargetUser.trim(),
        reason,
        evidenceUrls,
        status: dTargetType === 'organizer' ? 'open_admin' : 'open_organizer',
        organizerWarnings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (result && result.ok === false) { showToast(result.error || 'Dispute blocked.', 'error'); return; }
    }
    setDisputeOpen(false);
    showToast('Dispute submitted');
  }

  return (
    <>
      <main className="part-main">
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
            <button className="hero-btn hero-btn-secondary" style={{ borderColor: 'rgba(248,113,113,0.5)', color: '#f87171' }} onClick={openDispute}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              Raise Dispute
            </button>
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
                      <div className="my-team-sub">Season {comp.season || '1'}</div>
                    </div>
                  </div>
                  <div className="my-team-stats-grid">
                    <div className="my-team-stat"><span className="my-team-stat-lbl">Members</span><span className="my-team-stat-val">{allMembers.length}</span></div>
                    <div className="my-team-stat"><span className="my-team-stat-lbl">Captain</span><span className="my-team-stat-val">{captainName}</span></div>
                    <div className="my-team-stat" style={{ gridColumn: '1/-1' }}><span className="my-team-stat-lbl">{isLeague ? 'League' : 'Tournament'} Rank</span><span className="my-team-stat-val my-team-stat-accent">{rank}</span></div>
                  </div>
                  {rosterMembers.length > 0 ? (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Team Roster · {rosterMembers.length} / 5 players</div>
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
              {rawMatches.length === 0 ? (
                <p style={{ color: '#4b5563', fontSize: 14, padding: '16px 0' }}>No matches scheduled yet.</p>
              ) : (
                rawMatches.map((m, i) => {
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
            {!isLeague ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <p style={{ color: '#9aa4b2', fontSize: 14, margin: '0 0 6px' }}>
                  This is a <strong style={{ color: '#fff' }}>{compFormat}</strong> tournament —<br />standings tables are not used.
                </p>
                <span style={{ fontSize: 12, color: '#4b5563' }}>Bracket view available once all teams are confirmed.</span>
              </div>
            ) : (() => {
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
              const rows = Object.values(table).sort((a, b) => (b.pts - a.pts) || (b.w - a.w)).map((s, i) => ({ ...s, rank: i + 1, you: myTeamName && normalize(s.team) === normalize(myTeamName) }));
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
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{targetLabel}</label>
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


