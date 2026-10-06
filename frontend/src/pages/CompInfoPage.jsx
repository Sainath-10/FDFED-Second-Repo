import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import { NexusData } from '../services/competitionService';
import { NexusTeamWorkflow } from '../services/teamService';
import { NexusAuth } from '../services/authService';
import '../styles/pages/comp-info.css';

export default function CompInfoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const idFromUrl = searchParams.get('id');
  const [compId, setCompId] = useState(() => idFromUrl || sessionStorage.getItem('last_comp_id') || '');
  const [activeTab, setActiveTab] = useState('overview');

  // Dispute modal state
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeTargetType, setDisputeTargetType] = useState('');
  const [disputeTargetUser, setDisputeTargetUser] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');

  useEffect(() => {
    if (idFromUrl) {
      setCompId(idFromUrl);
      sessionStorage.setItem('last_comp_id', idFromUrl);
    }
  }, [idFromUrl]);

  const comp = compId ? NexusData.getCompetitionById(compId) : null;
  const session = NexusAuth.getSession();
  const userKey = (session?.username || '').trim().toLowerCase();

  const approvalStatus = comp ? NexusData.getApprovalStatus(comp) : 'approved';
  const isCoOrg = Array.isArray(comp?.organizers) && comp.organizers.map(o => String(o).trim().toLowerCase()).includes(userKey);
  const isOwner = !!(userKey && (isCoOrg || String(comp?.organizerId || comp?.createdBy || '').trim().toLowerCase() === userKey));

  if (!comp || (approvalStatus !== 'approved' && !isOwner)) {
    return (
      <Shell activeItem="competitions">
        <main className="comp-info-page" style={{ padding: '32px' }}>
          <Link to="/competitions" className="back-btn" style={{ marginBottom: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)', textDecoration: 'none' }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 8H4M4 8L8 12M4 8L8 4" />
            </svg>
            Back to Competitions
          </Link>
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
            <h2 style={{ color: 'var(--text-white)', marginBottom: '8px' }}>Competition Not Found</h2>
            <p style={{ color: 'var(--text-muted)' }}>This competition may have been removed or the link is invalid.</p>
          </div>
        </main>
      </Shell>
    );
  }

  // Find user's team context
  const myTeam = NexusTeamWorkflow.findUserTeamInCompetition(comp.id);
  const isTeamLeader = !!(myTeam && myTeam.team && String(myTeam.team.createdBy || '').trim().toLowerCase() === userKey);
  const teamStatus = myTeam && myTeam.team ? String(myTeam.team.status || '').toLowerCase() : '';

  const approvedTeams = (comp.teams || []).filter(t => t.status === 'approved');

  // Helpers
  const formatStatus = (st) => {
    const map = { ongoing: 'Ongoing', upcoming: 'Registration Open', completed: 'Completed', live: 'LIVE' };
    return map[st] || st || '—';
  };

  const formatType = (tp) => {
    const map = { tournament: 'Single Elimination', league: 'Round Robin' };
    return map[tp] || tp || '—';
  };

  // Standings calculation
  const buildStandings = () => {
    const teamNames = approvedTeams.map(t => t.name);
    const table = {};
    teamNames.forEach(name => {
      table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    });
    const matches = (comp.matches || []).slice();
    matches.forEach(match => {
      if (match.status !== 'completed') return;
      if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
      if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
      const t1 = table[match.team1];
      const t2 = table[match.team2];
      t1.mp += 1; t2.mp += 1;
      if (match.score1 > match.score2) {
        t1.w += 1; t2.l += 1; t1.points += 3;
        t1.last5.unshift('W'); t2.last5.unshift('L');
      } else if (match.score2 > match.score1) {
        t2.w += 1; t1.l += 1; t2.points += 3;
        t1.last5.unshift('L'); t2.last5.unshift('W');
      } else {
        t1.d += 1; t2.d += 1; t1.points += 1; t2.points += 1;
        t1.last5.unshift('D'); t2.last5.unshift('D');
      }
    });
    return Object.values(table)
      .map(row => {
        const extra = (comp.customPoints || {})[row.team] || 0;
        row.points = Math.max(0, row.points + extra);
        return Object.assign({}, row, { last5: row.last5.slice(0, 5) });
      })
      .sort((a, b) => (b.points - a.points) || (b.w - a.w))
      .map((row, index) => Object.assign({}, row, { rank: index + 1 }));
  };

  const standingsRows = buildStandings();

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Competition link copied to clipboard!');
      }).catch(() => {
        prompt('Copy this link:', url);
      });
    } else {
      prompt('Copy this link:', url);
    }
  };

  const handleRegisterClick = () => {
    if (approvalStatus !== 'approved') {
      showToast('Registration opens only after admin approval.', 'error');
      return;
    }
    if (!NexusAuth.isLoggedIn()) {
      navigate('/login');
      return;
    }
    if (myTeam && myTeam.context && teamStatus !== 'rejected') {
      navigate(`/comp-participant?id=${encodeURIComponent(myTeam.context.compId)}`);
      return;
    }
    navigate(`/join-teams?id=${comp.id}`);
  };

  const handleCreateClick = () => {
    if (approvalStatus !== 'approved') {
      showToast('Team creation opens only after admin approval.', 'error');
      return;
    }
    if (!NexusAuth.isLoggedIn()) {
      navigate('/login');
      return;
    }
    if (myTeam && myTeam.context && teamStatus !== 'rejected') {
      if (isTeamLeader) {
        navigate(`/team/team-roster?compId=${encodeURIComponent(myTeam.context.compId)}&teamId=${encodeURIComponent(myTeam.context.teamId)}`);
      } else {
        navigate(`/comp-participant?id=${encodeURIComponent(myTeam.context.compId)}`);
      }
      return;
    }
    navigate(`/create-team?id=${comp.id}`);
  };

  // Participant list for dispute
  const participants = NexusData.getCompetitionParticipants(comp.id);
  const myTeamName = myTeam?.team?.name ? myTeam.team.name.toLowerCase() : '';

  const getFilteredDisputeTargets = () => {
    if (disputeTargetType === 'team') {
      return (participants.teams || [])
        .filter(t => (t.name || '').toLowerCase() !== myTeamName)
        .map(t => ({ label: `${t.name} (${t.status || 'registered'})`, value: t.name }));
    }
    if (disputeTargetType === 'player') {
      return (participants.players || [])
        .filter(u => (u || '').toLowerCase() !== userKey)
        .map(u => ({ label: `@${u}`, value: u }));
    }
    if (disputeTargetType === 'organizer') {
      if ((participants.organizer || '').toLowerCase() === userKey) {
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
    if (userKey && disputeTargetUser.trim().toLowerCase() === userKey) {
      showToast('You cannot raise a dispute against yourself.', 'error');
      return;
    }

    const evidenceUrls = disputeEvidence ? disputeEvidence.split(',').map(s => s.trim()).filter(Boolean) : [];
    const result = NexusData.addDispute({
      competitionId: comp.id,
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

  const hasPrize = comp.prizePool && comp.prizePool !== 'No Prize Pool' && comp.prizePool !== '₹0' && comp.prizePool !== '—';
  const prizePhrase = hasPrize ? `the prize pool of ${comp.prizePool}` : 'glory and championship honors';
  const descriptionText = comp.description || `The ${comp.name} is a ${formatType(comp.type)} competition for ${comp.game}. Join teams from around the world to compete for ${prizePhrase}.`;

  const regDates = comp.registrationDates || {};
  const prizeList = comp.prizes || [];
  const icons = ['🥇', '🥈', '🥉'];

  const matchesList = (comp.matches || []).filter(m => m.status === 'completed' || m.status === 'live' || m.status === 'scheduled');

  const rulesList = comp.rules
    ? comp.rules.split('\n').filter(r => r.trim())
    : [
        'All participating teams must have valid NEXUS accounts.',
        `Format: ${formatType(comp.type)}. Max ${comp.maxTeams || '—'} teams.`,
        `Maximum ${comp.maxPlayersPerTeam || 5} players allowed per team.`,
        'Teams must be ready to play within 10 minutes of scheduled match time.',
        'All matches must be played on official NEXUS tournament servers.',
        `Entry fee: ${comp.entryFee || 'Free'}.`,
        'Prize money will be distributed within 14 business days of tournament conclusion.'
      ];

  return (
    <Shell activeItem="competitions">
      <main className="comp-info-page">
        {/* Back */}
        <Link to="/competitions" className="back-btn">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8H4M4 8L8 12M4 8L8 4" />
          </svg>
          Back to Competitions
        </Link>

        {/* Pending Banner if applicable */}
        {approvalStatus === 'pending' && (
          <div style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid #fb923c', borderRadius: '12px', padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '28px' }}>⏳</span>
            <div>
              <h4 style={{ margin: '0 0 4px', color: '#fb923c', fontSize: '16px', fontWeight: 700 }}>Pending Admin Approval</h4>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px' }}>
                This tournament's prize pool ({comp.prizePool || 'High Stakes'}) exceeds ₹50,000. It is currently under review by Platform Admin and will be published publicly once approved.
              </p>
            </div>
          </div>
        )}

        {/* Hero Banner */}
        <div className="comp-info-hero" id="comp-hero">
          <img id="comp-hero-img" src={comp.img || '/assets/b890c61489a080992ad7e99adabb1145e6d59606.png'} alt="" />
          <div className="comp-info-overlay">
            <div className="game" id="comp-hero-game">{comp.game || '—'}</div>
            <h1 id="comp-hero-name">{comp.name || 'Competition'}</h1>
          </div>
          {comp.badge && (
            <span className={`comp-badge ${comp.badgeClass || 'featured'}`} id="comp-hero-badge" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 3 }}>
              {comp.badge}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="comp-info-body">
          {/* Main Content */}
          <div className="comp-info-details">
            {/* Tabs */}
            <div className="tabs-nav">
              <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
              <button className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>Teams</button>
              <button className={`tab-btn ${activeTab === 'bracket' ? 'active' : ''}`} onClick={() => setActiveTab('bracket')}>Bracket</button>
              <button className={`tab-btn ${activeTab === 'standings' ? 'active' : ''}`} onClick={() => setActiveTab('standings')}>Standings</button>
              <button className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>Rules</button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="tab-panel active" id="tab-overview">
                <div className="comp-info-block">
                  <h2>About this Tournament</h2>
                  <p id="comp-description">{descriptionText}</p>
                </div>

                <div className="comp-info-block" style={{ marginTop: '20px' }}>
                  <h2>Schedule</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} id="comp-schedule">
                    <div className="info-row">
                      <span className="key">Registration Opens</span>
                      <span className="val" id="sched-reg-open">{regDates.open || '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="key">Registration Closes</span>
                      <span className="val" id="sched-reg-close">{regDates.close || '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="key">Competition Dates</span>
                      <span className="val" id="sched-dates">{comp.dates || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="comp-info-block" style={{ marginTop: '20px' }}>
                  <h2>Competition Limits</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="info-row">
                      <span className="key">Max Teams</span>
                      <span className="val" id="overview-max-teams">{comp.maxTeams ? `${comp.maxTeams} teams` : '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="key">Max Players per Team</span>
                      <span className="val" id="overview-max-players">{comp.maxPlayersPerTeam ? `${comp.maxPlayersPerTeam} players per team` : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <div className="tab-panel active" id="tab-teams">
                <div className="comp-info-block">
                  <h2 id="teams-heading">Registered Teams ({approvedTeams.length} / {comp.maxTeams || '—'})</h2>
                  <div className="teams-grid" id="comp-teams-grid">
                    {approvedTeams.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No teams have been accepted yet.</p>
                    ) : (
                      approvedTeams.map((t, idx) => (
                        <div className="team-card" key={idx}>
                          <div className="name">{t.name || 'Unknown Team'}</div>
                          <div className="players">{t.players || '—'} Players</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bracket Tab */}
            {activeTab === 'bracket' && (
              <div className="tab-panel active" id="tab-bracket">
                <div className="comp-info-block">
                  <h2>Tournament Bracket</h2>
                  <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--text-muted)' }} id="comp-format-desc">
                    {formatType(comp.type)} format. {comp.entryFee ? `Entry fee: ${comp.entryFee}.` : ''} Up to {comp.maxTeams || '—'} teams.
                  </p>
                  <div className="bracket-row" id="comp-bracket-row">
                    {matchesList.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No matches scheduled yet.</p>
                    ) : (
                      matchesList.map((m, idx) => {
                        const isLive = m.status === 'live';
                        const isDone = m.status === 'completed';
                        const isT1Banned = NexusData.isTeamBannedInComp(m.team1, comp);
                        const isT2Banned = NexusData.isTeamBannedInComp(m.team2, comp);

                        return (
                          <div className="bracket-match" key={idx}>
                            <div className="round-label">{m.round || 'Match'} · {isLive ? '🔴 LIVE' : (isDone ? 'Completed' : 'Scheduled')}</div>
                            <div className={`bracket-team ${isDone && m.score1 >= m.score2 ? 'winner' : ''}`}>
                              <span>
                                {isT1Banned ? (
                                  <>
                                    <del style={{ color: '#ef4444' }}>{m.team1 || 'TBD'}</del>{' '}
                                    <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 700 }}>(BANNED)</span>
                                  </>
                                ) : (m.team1 || 'TBD')}
                              </span>
                              <span className="score">{isDone ? m.score1 : '—'}</span>
                            </div>
                            <div className={`bracket-team ${isDone && m.score2 > m.score1 ? 'winner' : ''}`}>
                              <span>
                                {isT2Banned ? (
                                  <>
                                    <del style={{ color: '#ef4444' }}>{m.team2 || 'TBD'}</del>{' '}
                                    <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 700 }}>(BANNED)</span>
                                  </>
                                ) : (m.team2 || 'TBD')}
                              </span>
                              <span className="score">{isDone ? m.score2 : '—'}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Standings Tab */}
            {activeTab === 'standings' && (
              <div className="tab-panel active" id="tab-standings">
                <div className="comp-info-block">
                  <h2 style={{ marginBottom: '20px' }}>Standings</h2>

                  <div className="standings-table-header">
                    <span className="col-rank">RANK</span>
                    <span className="col-team">TEAM</span>
                    <span className="col-mp">MP</span>
                    <span className="col-w">W</span>
                    <span className="col-l">L</span>
                    <span className="col-d">D</span>
                    <span className="col-pts">POINTS</span>
                    <span className="col-last5">LAST 5</span>
                  </div>
                  <div id="standings-rows">
                    {standingsRows.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '18px' }}>
                        Standings will be updated as the tournament progresses.
                      </p>
                    ) : (
                      standingsRows.map((row) => {
                        const last = row.last5.length ? row.last5 : ['-', '-', '-', '-', '-'];
                        return (
                          <div className="standings-row" key={row.rank}>
                            <span className="col-rank">
                              <span className={`rank-badge ${row.rank === 1 ? 'rank-1' : ''}`}>
                                {String(row.rank).padStart(2, '0')}
                              </span>
                            </span>
                            <span className="col-team">{row.team}</span>
                            <span className="col-mp">{row.mp}</span>
                            <span className="col-w stat-green">{row.w}</span>
                            <span className="col-l">{row.l}</span>
                            <span className="col-d">{row.d}</span>
                            <span className="col-pts stat-green">{row.points}</span>
                            <span className="col-last5">
                              <span className="last-five">
                                {last.map((res, i) => (
                                  <span
                                    key={i}
                                    className={`last-chip ${res === 'W' ? 'last-win' : res === 'L' ? 'last-loss' : 'last-draw'}`}
                                  >
                                    {res === 'W' ? '✔' : res === 'L' ? 'X' : '-'}
                                  </span>
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
            )}

            {/* Rules Tab */}
            {activeTab === 'rules' && (
              <div className="tab-panel active" id="tab-rules">
                <div className="comp-info-block">
                  <h2>Tournament Rules</h2>
                  <div id="comp-rules" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '15px', color: 'var(--text-muted)', lineHeight: '24px' }}>
                    {rulesList.map((r, i) => (
                      <p key={i}>{i + 1}. {r}</p>
                    ))}
                    {comp.maxPlayersPerTeam && !rulesList.some(r => r.toLowerCase().includes('player')) && (
                      <p>{rulesList.length + 1}. Maximum {comp.maxPlayersPerTeam} players allowed per team.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Panel */}
          <aside className="comp-sidebar-panel">
            {/* Quick Info */}
            <div className="comp-sidebar-block">
              <h3>Tournament Info</h3>
              <div className="info-row">
                <span className="key">Status</span>
                <span className="val" id="info-status" style={{ color: 'var(--accent)' }}>{formatStatus(comp.status)}</span>
              </div>
              <div className="info-row">
                <span className="key">Game</span>
                <span className="val" id="info-game">{comp.game || '—'}</span>
              </div>
              <div className="info-row">
                <span className="key">Format</span>
                <span className="val" id="info-format">{formatType(comp.type)}</span>
              </div>
              <div className="info-row">
                <span className="key">Teams</span>
                <span className="val" id="info-teams">{approvedTeams.length} / {comp.maxTeams || '—'}</span>
              </div>
              <div className="info-row">
                <span className="key">Date</span>
                <span className="val" id="info-date">{comp.dates || '—'}</span>
              </div>
              <div className="info-row">
                <span className="key">Prize Pool</span>
                <span className="val" id="info-prize" style={{ color: 'var(--accent)', fontSize: '18px' }}>{comp.prizePool || '—'}</span>
              </div>
            </div>

            {/* Prize Breakdown */}
            <div className="comp-sidebar-block" id="prize-breakdown-block">
              <h3>Prize Breakdown</h3>
              <div className="prize-breakdown" id="comp-prize-breakdown">
                {prizeList.length === 0 ? (
                  <div className="prize-row">
                    <span className="place">🥇 1st Place</span>
                    <span className="amount">{comp.prizePool || '—'}</span>
                  </div>
                ) : (
                  prizeList.map((p, i) => (
                    <div className="prize-row" key={i}>
                      <span className="place">{icons[i] || ''} {p.place}</span>
                      <span className="amount">{p.amount || '—'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="comp-sidebar-block" id="comp-cta-block" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
              {isOwner ? (
                <>
                  <Link
                    to={`/competition-detail?id=${comp.id}`}
                    id="btn-manage-comp"
                    className="btn-primary"
                    style={{ width: '100%', textAlign: 'center', display: 'block', padding: '14px', fontSize: '15px', cursor: 'pointer', border: 'none', textDecoration: 'none', boxSizing: 'border-box' }}
                  >
                    ✏ Manage Competition
                  </Link>
                  <button
                    id="btn-dispute"
                    className="btn-outline"
                    style={{ width: '100%', textAlign: 'center', display: 'block', padding: '13px', fontSize: '14px', cursor: 'pointer', background: 'none', borderColor: '#f87171', color: '#f87171', fontWeight: 600 }}
                    onClick={() => setIsDisputeOpen(true)}
                  >
                    ⚠ Raise Dispute
                  </button>
                  <button
                    id="btn-share-comp"
                    className="btn-outline"
                    style={{ width: '100%', textAlign: 'center', display: 'block', padding: '11px', fontSize: '13px', cursor: 'pointer', background: 'none', opacity: 0.8 }}
                    onClick={handleShare}
                  >
                    🔗 Share Link
                  </button>
                </>
              ) : myTeam && teamStatus !== 'rejected' ? (
                <>
                  {teamStatus === 'banned' ? (
                    <button
                      id="btn-register-team"
                      className="btn-primary"
                      disabled
                      style={{ width: '100%', textAlign: 'center', display: 'block', padding: '14px', fontSize: '15px', cursor: 'not-allowed', background: '#1a1015', color: '#ef4444', border: '1px solid #ef4444' }}
                    >
                      🚫 Team Banned from Tournament
                    </button>
                  ) : teamStatus === 'pending' ? (
                    <>
                      <button
                        id="btn-register-team"
                        className="btn-primary"
                        disabled
                        style={{ width: '100%', textAlign: 'center', display: 'block', padding: '14px', fontSize: '15px' }}
                      >
                        Pending Approval
                      </button>
                      <button
                        id="btn-create-team"
                        className="btn-outline"
                        disabled
                        style={{ width: '100%', textAlign: 'center', display: 'block', padding: '13px', fontSize: '14px' }}
                      >
                        Pending Approval
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        id="btn-register-team"
                        className="btn-primary"
                        onClick={handleRegisterClick}
                        style={{ width: '100%', textAlign: 'center', display: 'block', padding: '14px', fontSize: '15px', cursor: 'pointer', border: 'none' }}
                      >
                        View My Team
                      </button>
                      {isTeamLeader && (
                        <button
                          id="btn-create-team"
                          className="btn-outline"
                          onClick={handleCreateClick}
                          style={{ width: '100%', textAlign: 'center', display: 'block', padding: '13px', fontSize: '14px', cursor: 'pointer', background: 'none' }}
                        >
                          Manage My Team
                        </button>
                      )}
                      <button
                        id="btn-dispute"
                        className="btn-outline"
                        style={{ width: '100%', textAlign: 'center', display: 'block', padding: '13px', fontSize: '14px', cursor: 'pointer', background: 'none', borderColor: '#f87171', color: '#f87171', fontWeight: 600 }}
                        onClick={() => setIsDisputeOpen(true)}
                      >
                        ⚠ Raise Dispute
                      </button>
                    </>
                  )}
                  <button
                    id="btn-share-comp"
                    className="btn-outline"
                    style={{ width: '100%', textAlign: 'center', display: 'block', padding: '11px', fontSize: '13px', cursor: 'pointer', background: 'none', opacity: 0.8 }}
                    onClick={handleShare}
                  >
                    🔗 Share Link
                  </button>
                </>
              ) : (
                <>
                  <button
                    id="btn-register-team"
                    className="btn-primary"
                    onClick={handleRegisterClick}
                    style={{ width: '100%', textAlign: 'center', display: 'block', padding: '14px', fontSize: '15px', cursor: 'pointer', border: 'none' }}
                  >
                    Join Teams
                  </button>
                  <button
                    id="btn-create-team"
                    className="btn-outline"
                    onClick={handleCreateClick}
                    style={{ width: '100%', textAlign: 'center', display: 'block', padding: '13px', fontSize: '14px', cursor: 'pointer', background: 'none' }}
                  >
                    Create a New Team
                  </button>
                  <button
                    id="btn-share-comp"
                    className="btn-outline"
                    style={{ width: '100%', textAlign: 'center', display: 'block', padding: '11px', fontSize: '13px', cursor: 'pointer', background: 'none', opacity: 0.8 }}
                    onClick={handleShare}
                  >
                    🔗 Share Link
                  </button>
                  {teamStatus === 'rejected' && (
                    <p style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
                      ⚠ Your previous team registration was rejected. You may join or create a new team.
                    </p>
                  )}
                </>
              )}
            </div>
          </aside>
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
