import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import { NexusTeamWorkflow } from '../services/teamService';
import { NexusAuth } from '../services/authService';
import '../styles/pages/comp-participant.css';

export default function CompParticipantPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const idFromUrl = searchParams.get('id');
  const [tick, setTick] = useState(0);

  // Dispute modal state
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeTargetType, setDisputeTargetType] = useState('');
  const [disputeTargetUser, setDisputeTargetUser] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');

  // Auto-refresh every 3s
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const allComps = NexusData.loadCompetitions();
  const comp = allComps.find(c => String(c.id) === String(idFromUrl))
    || allComps.find(c => c.role === 'participant')
    || {};

  const myTeamBundle = comp.id ? NexusTeamWorkflow.findUserTeamInCompetition(comp.id) : null;
  const myTeam = myTeamBundle?.team || null;

  const session = NexusAuth.getSession();
  const currentUsername = (session?.username || '').trim().toLowerCase();

  // If team is banned from this tournament, block access and redirect back to comp-info
  useEffect(() => {
    if (myTeam && String(myTeam.status || '').toLowerCase() === 'banned') {
      showToast('Your team has been banned from this tournament.', 'error');
      navigate(`/comp-info?id=${comp.id || idFromUrl || ''}`, { replace: true });
    }
  }, [myTeam, comp.id, idFromUrl, navigate, showToast]);

  const fmtPrize = (val) => {
    if (!val || val === '—' || val === '-' || val === '₹0' || String(val).toLowerCase().includes('no prize')) {
      return 'No Prize Pool';
    }
    const str = String(val).trim();
    return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
  };

  const isLeague = (comp.type || 'league') === 'league';
  const compName = comp.name || 'Competition';
  const compGame = comp.game || 'Unknown Game';
  const compStatus = comp.status || 'ongoing';
  const compFormat = comp.format || (isLeague ? 'Round Robin' : 'Single Elimination');
  const compLocation = comp.location || 'Online';
  const compPrize = comp.prizePool || comp.prize || '₹0';
  const compDates = comp.dates || 'TBD';
  const compParticipants = comp.participants || comp.registeredTeams || 0;
  const compPrizeFormatted = fmtPrize(compPrize);
  const compDesc = comp.description
    || `${compName} is a competitive ${compGame} ${isLeague ? 'league' : 'tournament'}. Teams battle across ${isLeague ? 'a structured league format with standings' : 'a knockout bracket'} competing for ${compPrizeFormatted.toLowerCase() === 'no prize pool' ? 'victory' : `the ${compPrizeFormatted}`}.`;

  // My Team details
  const teamName = myTeam?.name || 'My Team';
  const abbr = teamName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'MT';

  const allMembers = Array.isArray(myTeam?.members) ? myTeam.members : [];
  const captainMember = allMembers.find(m => ['captain', 'leader'].includes(String(m.role || '').toLowerCase()));
  const captainName = captainMember?.displayName || captainMember?.username || myTeam?.createdBy || 'Team Captain';

  const rosterMembers = allMembers.filter(m => {
    const isCaptain = ['captain', 'leader'].includes(String(m.role || '').toLowerCase())
      || String(m.username || '').toLowerCase() === String(myTeam?.createdBy || '').toLowerCase();
    const st = String(m.status || '').toLowerCase();
    return isCaptain || !st || st === 'approved' || st === 'active';
  });

  const memberCount = allMembers.length;

  const standings = Array.isArray(comp.standings) ? comp.standings : [];
  let rank = '#—';
  if (standings.length) {
    const idx = standings.findIndex(s => String(s.team || '').toLowerCase() === teamName.toLowerCase());
    if (idx >= 0) rank = '#' + (standings[idx].rank || idx + 1);
  }

  // Match Schedule
  const rawMatches = Array.isArray(comp.matches) ? comp.matches : [];
  const statusMap = {
    completed: ['msb msb-completed', 'Completed'],
    live: ['msb msb-live', '● Live'],
    upcoming: ['msb msb-upcoming', 'Upcoming'],
    scheduled: ['msb msb-upcoming', 'Upcoming'],
  };

  // League Standings calculation
  const approvedTeams = (comp.teams || []).filter(t => t.status === 'approved');
  const table = {};
  approvedTeams.forEach(t => {
    table[t.name] = { team: t.name, mp: 0, w: 0, l: 0, pts: 0 };
  });
  rawMatches.forEach(m => {
    if (m.status !== 'completed') return;
    if (!table[m.team1]) table[m.team1] = { team: m.team1, mp: 0, w: 0, l: 0, pts: 0 };
    if (!table[m.team2]) table[m.team2] = { team: m.team2, mp: 0, w: 0, l: 0, pts: 0 };
    const t1 = table[m.team1];
    const t2 = table[m.team2];
    t1.mp++;
    t2.mp++;
    if (m.score1 > m.score2) {
      t1.w++;
      t1.pts += 3;
      t2.l++;
    } else if (m.score2 > m.score1) {
      t2.w++;
      t2.pts += 3;
      t1.l++;
    } else {
      t1.pts++;
      t2.pts++;
    }
  });

  const myTeamNorm = teamName.toLowerCase();
  const standingsRows = Object.values(table)
    .sort((a, b) => (b.pts - a.pts) || (b.w - a.w))
    .map((s, i) => ({ ...s, rank: i + 1, you: myTeam && String(s.team || '').toLowerCase() === myTeamNorm }));

  // Participant list for dispute
  const participants = NexusData.getCompetitionParticipants(comp.id || idFromUrl);
  const myTeamName = myTeam?.name ? myTeam.name.toLowerCase() : '';

  const getFilteredDisputeTargets = () => {
    if (disputeTargetType === 'team') {
      return (participants.teams || [])
        .filter(t => (t.name || '').toLowerCase() !== myTeamName)
        .map(t => ({ label: `${t.name} (${t.status || 'registered'})`, value: t.name }));
    }
    if (disputeTargetType === 'player') {
      return (participants.players || [])
        .filter(u => (u || '').toLowerCase() !== currentUsername)
        .map(u => ({ label: `@${u}`, value: u }));
    }
    if (disputeTargetType === 'organizer') {
      if ((participants.organizer || '').toLowerCase() === currentUsername) {
        return [];
      }
      return [{ label: `${participants.organizer} (Organizer)`, value: participants.organizer }];
    }
    return [];
  };

  const handleSubmitDispute = (e) => {
    e.preventDefault();
    if (!disputeTargetType || !disputeTargetUser || disputeReason.trim().length < 10) {
      showToast('Please fill in all required fields (target and min. 10 chars reason).', 'error');
      return;
    }
    if (currentUsername && disputeTargetUser.trim().toLowerCase() === currentUsername) {
      showToast('You cannot raise a dispute against yourself.', 'error');
      return;
    }

    const evidenceUrls = disputeEvidence ? disputeEvidence.split(',').map(s => s.trim()).filter(Boolean) : [];
    const result = NexusData.addDispute({
      competitionId: comp.id || idFromUrl,
      reportedBy: session?.username || 'anonymous',
      targetType: disputeTargetType,
      targetUserOrTeam: disputeTargetUser.trim(),
      reason: disputeReason.trim(),
      evidenceUrls,
      status: disputeTargetType === 'organizer' ? 'open_admin' : 'open_organizer',
      organizerWarnings: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (result && result.ok === false) {
      showToast(result.error || 'Dispute blocked.', 'error');
      return;
    }

    setIsDisputeOpen(false);
    setDisputeTargetType('');
    setDisputeTargetUser('');
    setDisputeReason('');
    setDisputeEvidence('');
    showToast('Dispute submitted successfully.');
  };

  return (
    <Shell activeItem="activity">
      <main className="part-main">
        {/* Hero */}
        <div className="part-hero" id="part-hero">
          <div className="part-hero-left">
            <div className="part-hero-tags" id="part-hero-tags">
              <span className="hero-tag-status">{compStatus.toUpperCase()}</span>
              <span className="hero-tag-game">{compGame}</span>
            </div>
            <h1 className="part-hero-title" id="part-hero-title">{compName}</h1>
            <div className="part-hero-meta" id="part-hero-meta">
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {compDates}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                {compPrizeFormatted}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
                {compParticipants} participants
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                  <circle cx="12" cy="11" r="3" />
                </svg>
                {compLocation}
              </span>
            </div>
          </div>
          <div className="part-hero-actions" id="part-hero-actions">
            <Link className="hero-btn hero-btn-secondary" to={`/comp-info?id=${comp.id || idFromUrl || ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </Link>
            <button
              className="hero-btn hero-btn-secondary"
              style={{ borderColor: 'rgba(248,113,113,0.5)', color: '#f87171' }}
              onClick={() => setIsDisputeOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Raise Dispute
            </button>
            {isLeague && (
              <button
                className="hero-btn hero-btn-secondary"
                onClick={() => document.getElementById('part-standings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                View Standings
              </button>
            )}
          </div>
        </div>

        {/* About Panel */}
        <div className="part-about-panel" id="part-about-panel">
          <div className="about-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            About This Competition
          </div>
          <p className="about-panel-desc">{compDesc}</p>
          <div className="about-meta-blocks">
            <div className="about-meta-block">
              <span className="about-meta-label">Type</span>
              <span className="about-meta-val">{isLeague ? 'League' : 'Tournament'}</span>
            </div>
            <div className="about-meta-block">
              <span className="about-meta-label">Format</span>
              <span className="about-meta-val">{compFormat}</span>
            </div>
            <div className="about-meta-block">
              <span className="about-meta-label">Location</span>
              <span className="about-meta-val">{compLocation}</span>
            </div>
            <div className="about-meta-block">
              <span className="about-meta-label">Organizer</span>
              <span className="about-meta-val">{comp.organizer || comp.organizerName || comp.createdBy || 'ArenaHub Events'}</span>
            </div>
          </div>
        </div>

        {/* Two-col body: My Team + Match Schedule */}
        <div className="part-body">
          <div className="part-panel" id="panel-myteam">
            <div className="part-panel-header">
              <div className="part-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>My Team</span>
              </div>
            </div>
            <div id="my-team-content">
              {!myTeam ? (
                <p style={{ color: '#4b5563', fontSize: '14px', padding: '16px 0' }}>
                  You are not currently registered in a team for this competition.
                </p>
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
                    <div className="my-team-stat">
                      <span className="my-team-stat-lbl">Members</span>
                      <span className="my-team-stat-val">{memberCount}</span>
                    </div>
                    <div className="my-team-stat">
                      <span className="my-team-stat-lbl">Captain</span>
                      <span className="my-team-stat-val">{captainName}</span>
                    </div>
                    <div className="my-team-stat" style={{ gridColumn: '1/-1' }}>
                      <span className="my-team-stat-lbl">{isLeague ? 'League' : 'Tournament'} Rank</span>
                      <span className="my-team-stat-val my-team-stat-accent">{rank}</span>
                    </div>
                  </div>
                  {rosterMembers.length > 0 ? (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        Team Roster · {rosterMembers.length} / 5 players
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {rosterMembers.map((m, idx) => {
                          const name = m.displayName || m.username || 'Unknown Player';
                          const isCaptain = ['captain', 'leader'].includes(String(m.role || '').toLowerCase())
                            || String(m.username || '').toLowerCase() === String(myTeam.createdBy || '').toLowerCase();
                          const initials = name.substring(0, 2).toUpperCase();
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: isCaptain ? 'rgba(198,255,51,0.15)' : '#1e293b', color: isCaptain ? '#C6FF33' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, marginRight: '12px', flexShrink: 0 }}>
                                {initials}
                              </div>
                              <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 500, flex: 1 }}>
                                {name}
                                {isCaptain ? (
                                  <span style={{ fontSize: '10px', background: 'rgba(198,255,51,0.15)', color: '#C6FF33', padding: '2px 7px', borderRadius: '4px', marginLeft: '8px', fontWeight: 600 }}>CAPTAIN</span>
                                ) : (
                                  <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', padding: '2px 7px', borderRadius: '4px', marginLeft: '8px' }}>PLAYER</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#4b5563', fontSize: '13px', marginTop: '16px' }}>No players in roster yet.</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="part-panel" id="panel-schedule">
            <div className="part-panel-header">
              <div className="part-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Match Schedule</span>
              </div>
            </div>
            <div className="part-matches-list" id="part-matches-list">
              {rawMatches.length === 0 ? (
                <p style={{ color: '#4b5563', fontSize: '14px', padding: '16px 0' }}>No matches scheduled yet.</p>
              ) : (
                rawMatches.map((m, idx) => {
                  const statusKey = m.status === 'scheduled' ? 'upcoming' : (m.status || 'upcoming');
                  const [cls, lbl] = statusMap[statusKey] || ['msb msb-upcoming', 'Upcoming'];
                  const t1Norm = String(m.team1 || '').toLowerCase();
                  const t2Norm = String(m.team2 || '').toLowerCase();
                  const isT1Mine = myTeamNorm && t1Norm === myTeamNorm;
                  const isT2Mine = myTeamNorm && t2Norm === myTeamNorm;

                  const scoreText = m.status === 'completed'
                    ? `${m.score1 ?? '—'} - ${m.score2 ?? '—'}`
                    : m.status === 'live'
                    ? `${m.score1 || 0} - ${m.score2 || 0}`
                    : null;

                  const timeStr = (m.date || '—') + (m.time ? ' — ' + m.time : '');

                  return (
                    <div className={`part-match-item${m.status === 'live' ? ' part-match-item-live' : ''}`} key={idx}>
                      <div className="part-match-teams">
                        <div className="part-match-title">
                          {isT1Mine ? <span className="my-hl">{m.team1}</span> : m.team1} vs{' '}
                          {isT2Mine ? <span className="my-hl">{m.team2}</span> : m.team2}
                        </div>
                        <div className="part-match-round">{m.round || '—'}</div>
                      </div>
                      {scoreText ? (
                        <div className="part-match-score">{scoreText}</div>
                      ) : (
                        <div className="part-match-score part-match-score-dim">— : —</div>
                      )}
                      <div className="part-match-right">
                        <div className="part-match-time">{timeStr}</div>
                        <span className={cls}>{lbl}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Standings */}
        <div className="part-section" id="part-standings-section">
          <div className="part-panel-header">
            <div className="part-panel-title-row">
              {isLeague ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="6" height="4" rx="1" />
                  <rect x="15" y="3" width="6" height="4" rx="1" />
                  <rect x="9" y="10" width="6" height="4" rx="1" />
                  <line x1="6" y1="7" x2="6" y2="12" />
                  <line x1="18" y1="7" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="18" y2="12" />
                  <line x1="12" y1="12" x2="12" y2="14" />
                </svg>
              )}
              <span>{isLeague ? 'Standings' : 'Tournament Bracket'}</span>
            </div>
          </div>
          <div id="part-standings-table">
            {!isLeague ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ color: '#9aa4b2', fontSize: '14px', margin: '0 0 6px' }}>
                  This is a <strong style={{ color: '#fff' }}>{compFormat}</strong> tournament —<br />standings tables are not used.
                </p>
                <span style={{ fontSize: '12px', color: '#4b5563' }}>Bracket view available once all teams are confirmed.</span>
              </div>
            ) : standingsRows.length === 0 ? (
              <p style={{ color: '#4b5563', fontSize: '14px', padding: '16px 0' }}>No standing data yet.</p>
            ) : (
              <div className="part-standings-wrap">
                <table className="part-standings-table-el">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>MP</th>
                      <th>W</th>
                      <th>L</th>
                      <th>PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standingsRows.map((s) => (
                      <tr key={s.rank} className={s.you ? 'you-row' : ''}>
                        <td>
                          <span className={`s-rank-badge${s.rank <= 3 ? ' s-rank-' + s.rank : ''}`}>{s.rank}</span>
                        </td>
                        <td>
                          <span className="s-team-cell">
                            <span className="s-team-name">{s.team}</span>
                            {s.you && <span className="s-you-tag">You</span>}
                          </span>
                        </td>
                        <td style={{ color: '#9aa4b2' }}>{s.mp}</td>
                        <td className="s-green">{s.w}</td>
                        <td className="s-red">{s.l}</td>
                        <td className="s-pts">{s.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Raise Dispute Modal */}
      {isDisputeOpen && (
        <div
          id="modal-raise-dispute"
          style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => {
            if (e.target.id === 'modal-raise-dispute') setIsDisputeOpen(false);
          }}
        >
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', width: 'min(96vw, 520px)', padding: '32px', position: 'relative', boxShadow: '0 20px 60px #000a' }}>
            <button
              onClick={() => setIsDisputeOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '18px', background: 'none', border: 'none', color: '#9aa4b2', fontSize: '20px', cursor: 'pointer' }}
            >
              ✕
            </button>
            <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: '20px' }}>⚠ Raise a Dispute</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '13px' }}>
              Select whether the dispute is against a Team, a Player, or the Organizer.
            </p>

            <form onSubmit={handleSubmitDispute}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Dispute Against *</label>
                <select
                  id="dispute-target-type"
                  required
                  value={disputeTargetType}
                  onChange={(e) => {
                    setDisputeTargetType(e.target.value);
                    setDisputeTargetUser('');
                  }}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}
                >
                  <option value="">— Select Target Entity —</option>
                  <option value="team">Team (Opponent)</option>
                  <option value="player">Player (Participant)</option>
                  <option value="organizer">Tournament Organizer</option>
                </select>
                {disputeTargetType === 'team' && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    📋 Dispute sent to Tournament Organizer for review.
                  </p>
                )}
                {disputeTargetType === 'player' && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    📋 Dispute sent to Tournament Organizer for review.
                  </p>
                )}
                {disputeTargetType === 'organizer' && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#fb923c' }}>
                    📢 Dispute against Organizer is routed directly to Platform Admin.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '16px' }} id="target-select-container">
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>
                  {disputeTargetType === 'team'
                    ? 'Choose Tournament Team *'
                    : disputeTargetType === 'player'
                    ? 'Choose Tournament Player *'
                    : disputeTargetType === 'organizer'
                    ? 'Tournament Organizer *'
                    : 'Choose Target *'}
                </label>
                <select
                  id="dispute-target-user"
                  required
                  value={disputeTargetUser}
                  onChange={(e) => setDisputeTargetUser(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}
                >
                  <option value="">
                    {!disputeTargetType
                      ? '— Select Category First —'
                      : getFilteredDisputeTargets().length === 0
                      ? '— No targets available —'
                      : '— Select a Target —'}
                  </option>
                  {getFilteredDisputeTargets().map((tgt, i) => (
                    <option key={i} value={tgt.value}>{tgt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Reason / Description *</label>
                <textarea
                  id="dispute-reason"
                  required
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe the issue in detail (min. 10 characters)..."
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Evidence Links (optional)</label>
                <input
                  id="dispute-evidence"
                  type="text"
                  value={disputeEvidence}
                  onChange={(e) => setDisputeEvidence(e.target.value)}
                  placeholder="e.g. https://imgur.com/screenshot, https://youtube.com/clip"
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#64748b' }}>Separate multiple links with a comma</p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsDisputeOpen(false)}
                  style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '12px', background: '#f87171', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                >
                  Submit Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
