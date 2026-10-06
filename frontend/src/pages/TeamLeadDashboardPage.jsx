import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusData } from '../services/competitionService';
import { NexusAuth } from '../services/authService';
import { NexusTeamWorkflow } from '../services/teamService';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/team-lead-dashboard.css';

const POOL_GRAD = [
  'linear-gradient(135deg,#0d2235,#1a3a55)',
  'linear-gradient(135deg,#1e0d35,#38185a)',
  'linear-gradient(135deg,#0d2015,#1a3d25)',
  'linear-gradient(135deg,#2a1500,#4a2800)',
  'linear-gradient(135deg,#001a2a,#003350)',
  'linear-gradient(135deg,#1a0a25,#30154a)',
  'linear-gradient(135deg,#2a1a1a,#4a2a20)',
  'linear-gradient(135deg,#0d1a2a,#1a3350)',
  'linear-gradient(135deg,#1a2a1a,#2a4a2a)',
  'linear-gradient(135deg,#2a2a0d,#4a4a1a)',
];
const POOL_EMOJI = ['🎮', '⚡', '🦅', '🔥', '💎', '🌌', '🕵️', '🌠', '🛡️', '⚔️'];

const PLAYERS_DATA = [
  { tag: 'GhostViper_99', pid: '#GV9920', rank: 'Grand Champion III', role: 'Striker / IGL', region: 'Delhi', online: true },
  { tag: 'LunarSlayer', pid: '#LNSR01', rank: 'Grand Champion II', role: 'Support / Anchor', region: 'Sri City', online: false },
  { tag: 'Rogue_Tactician', pid: '#RGTC88', rank: 'Grand Champion III', role: 'Flex / Mid', region: 'Hyderabad', online: true },
  { tag: 'NeonPulse_X', pid: '#NPX441', rank: 'Champion III', role: 'Entry Fragger', region: 'Chennai', online: true },
  { tag: 'ZeroGravity', pid: '#ZG007', rank: 'Immortal II', role: 'IGL', region: 'Mumbai', online: false },
  { tag: 'PhantomAce', pid: '#PA992', rank: 'Radiant', role: 'Fragger', region: 'Bangalore', online: true },
];

const PROFILE_RANKS = ['Radiant', 'Immortal', 'Grand Champion III', 'Grand Champion II', 'Champion III'];
const PROFILE_ROLES = ['IGL', 'Fragger', 'Support / Anchor', 'Flex / Mid', 'Striker'];
const PROFILE_REGIONS = ['Delhi', 'Mumbai', 'Hyderabad', 'Chennai', 'Bangalore', 'Sri City'];

function hashCode(value) {
  const str = String(value || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function makeProfileFromUsername(username) {
  const seed = hashCode(username);
  const cleaned = String(username || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return {
    tag: username,
    pid: '#' + (cleaned.slice(0, 6) || 'NEXUS'),
    rank: PROFILE_RANKS[seed % PROFILE_RANKS.length],
    role: PROFILE_ROLES[seed % PROFILE_ROLES.length],
    region: PROFILE_REGIONS[seed % PROFILE_REGIONS.length],
    online: (seed % 2) === 0,
    seed
  };
}

export default function TeamLeadDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [session] = useState(() => {
    if (NexusAuth && typeof NexusAuth.getSession === 'function') {
      const s = NexusAuth.getSession();
      if (s && s.username) return s;
    }
    try {
      const raw = localStorage.getItem('nexus.auth.session');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  });

  const [activeTab, setActiveTab] = useState('roster');
  const [comp, setComp] = useState(null);
  const [team, setTeam] = useState(null);

  // Filters for Add Players tab
  const [playerSearch, setPlayerSearch] = useState('');
  const [filterRank, setFilterRank] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterAvail, setFilterAvail] = useState('');
  const [invitedSet, setInvitedSet] = useState(new Set());

  // Settings tab form state
  const [teamName, setTeamName] = useState('');
  const [teamGame, setTeamGame] = useState('Rocket League');
  const [teamTag, setTeamTag] = useState('');
  const [teamRegion, setTeamRegion] = useState('Sri City');
  const [teamDesc, setTeamDesc] = useState('');
  const [recruiting, setRecruiting] = useState(true);

  // Invite Player Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [modalInviteInput, setModalInviteInput] = useState('');

  // Dispute Modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeTargetType, setDisputeTargetType] = useState('');
  const [disputeTargetUser, setDisputeTargetUser] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');

  const loadTeam = () => {
    if (!session || !session.username) return;
    const compId = searchParams.get('compId');
    const teamId = searchParams.get('teamId') || searchParams.get('id');

    const all = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    let foundComp = null;
    let foundTeam = null;

    if (compId) {
      foundComp = all.find(c => c.id === compId);
    }
    if (foundComp && teamId) {
      foundTeam = (foundComp.teams || []).find(t => t.id === teamId);
    } else if (teamId) {
      foundComp = all.find(c => Array.isArray(c.teams) && c.teams.some(t => t.id === teamId));
      if (foundComp) {
        foundTeam = foundComp.teams.find(t => t.id === teamId);
      }
    }

    if (!foundComp || !foundTeam) {
      const uKey = session.username.toLowerCase();
      for (const c of all) {
        if (Array.isArray(c.teams)) {
          const t = c.teams.find(teamItem =>
            (teamItem.createdBy || '').toLowerCase() === uKey ||
            (teamItem.leaderUsername || '').toLowerCase() === uKey
          );
          if (t) {
            foundComp = c;
            foundTeam = t;
            break;
          }
        }
      }
    }

    if (!foundComp && all.length > 0) {
      foundComp = all[0];
      if (foundComp.teams && foundComp.teams.length > 0) {
        foundTeam = foundComp.teams[0];
      }
    }

    setComp(foundComp);
    setTeam(foundTeam);

    if (foundTeam) {
      setTeamName(foundTeam.name || '');
      setTeamGame((foundComp && foundComp.game) || foundTeam.game || 'Rocket League');
      setTeamTag(foundTeam.tag || (foundTeam.name ? foundTeam.name.slice(0, 3).toUpperCase() : ''));
      setTeamRegion((foundComp && (foundComp.location || foundComp.region)) || 'Sri City');
      setTeamDesc(foundTeam.description || '');
      setRecruiting(foundTeam.recruiting !== false);
    }
  };

  useEffect(() => {
    if (!session || !session.username) {
      navigate('/login', { replace: true });
      return;
    }
    loadTeam();
  }, [session, searchParams]);

  if (!session) return null;

  const members = (team && Array.isArray(team.members)) ? team.members : [];
  const memberCount = members.length || (team ? team.players : 1) || 1;
  const joinRequests = (team && Array.isArray(team.joinRequests)) ? team.joinRequests : [];
  const invitations = (team && Array.isArray(team.invitations)) ? team.invitations : [];

  // Add Players list candidate pool
  let candidatePlayers = PLAYERS_DATA;
  if (comp && team && NexusTeamWorkflow && typeof NexusTeamWorkflow.getAvailablePlayers === 'function') {
    const rawCandidates = NexusTeamWorkflow.getAvailablePlayers(comp.id, team.id);
    if (rawCandidates.length > 0) {
      candidatePlayers = rawCandidates.map(p => makeProfileFromUsername(p.username || p.displayName || 'player'));
    }
  }

  const filteredPlayers = candidatePlayers.filter(p => {
    const q = playerSearch.toLowerCase().trim();
    const matchesQ = !q || p.tag.toLowerCase().includes(q) || p.pid.toLowerCase().includes(q);
    const matchesRank = !filterRank || p.rank === filterRank;
    const matchesRole = !filterRole || p.role.includes(filterRole);
    const matchesRegion = !filterRegion || p.region === filterRegion;
    const matchesAvail = !filterAvail || (filterAvail === 'Online Now' ? p.online : true);
    return matchesQ && matchesRank && matchesRole && matchesRegion && matchesAvail;
  });

  const handleSendInvite = (playerTag) => {
    if (!comp || !team) return;
    if (NexusTeamWorkflow && typeof NexusTeamWorkflow.sendTeamInvite === 'function') {
      const res = NexusTeamWorkflow.sendTeamInvite({
        compId: comp.id,
        teamId: team.id,
        targetUsername: playerTag
      });
      if (!res.ok) {
        showToast(res.error || 'Failed to send invite.', 'error');
        return;
      }
    }
    setInvitedSet(new Set(invitedSet).add(playerTag));
    showToast(`Invite sent to ${playerTag}!`);
    loadTeam();
  };

  const handleRevokeInvite = (inviteId) => {
    if (!comp || !team) return;
    if (NexusTeamWorkflow && typeof NexusTeamWorkflow.revokeInvite === 'function') {
      NexusTeamWorkflow.revokeInvite(comp.id, team.id, inviteId);
    }
    showToast('Invitation revoked.');
    loadTeam();
  };

  const handleAcceptRequest = (requestId) => {
    if (!comp || !team) return;
    if (NexusTeamWorkflow && typeof NexusTeamWorkflow.decideJoinRequest === 'function') {
      const res = NexusTeamWorkflow.decideJoinRequest({
        compId: comp.id,
        teamId: team.id,
        requestId,
        action: 'accepted'
      });
      if (!res.ok) {
        showToast(res.error || 'Failed to accept request.', 'error');
        return;
      }
    }
    showToast('Player joined team successfully!');
    loadTeam();
  };

  const handleDeclineRequest = (requestId) => {
    if (!comp || !team) return;
    if (NexusTeamWorkflow && typeof NexusTeamWorkflow.decideJoinRequest === 'function') {
      NexusTeamWorkflow.decideJoinRequest({
        compId: comp.id,
        teamId: team.id,
        requestId,
        action: 'declined'
      });
    }
    showToast('Join request declined.');
    loadTeam();
  };

  const handleRemoveMember = (username) => {
    if (!window.confirm(`Are you sure you want to remove @${username} from the team?`)) return;
    if (!comp || !team) return;

    const nextMembers = members.filter(m => (m.username || '').toLowerCase() !== username.toLowerCase());
    const updatedTeam = { ...team, members: nextMembers, players: nextMembers.length };
    const comps = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    const targetComp = comps.find(c => c.id === comp.id);
    if (targetComp && targetComp.teams) {
      const idx = targetComp.teams.findIndex(t => t.id === team.id);
      if (idx !== -1) {
        targetComp.teams[idx] = updatedTeam;
        NexusData.updateCompetition(targetComp);
      }
    }
    showToast(`@${username} removed from team roster.`);
    loadTeam();
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (!comp || !team) return;
    const updatedTeam = {
      ...team,
      name: teamName.trim() || team.name,
      game: teamGame,
      tag: teamTag.trim() || team.tag,
      description: teamDesc.trim(),
      recruiting
    };

    const comps = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    const targetComp = comps.find(c => c.id === comp.id);
    if (targetComp && targetComp.teams) {
      const idx = targetComp.teams.findIndex(t => t.id === team.id);
      if (idx !== -1) {
        targetComp.teams[idx] = updatedTeam;
        NexusData.updateCompetition(targetComp);
      }
    }
    showToast('Team settings saved successfully!');
    loadTeam();
  };

  // Target options for Dispute Modal
  const getDisputeTargets = () => {
    if (!comp) return [];
    const p = NexusData && typeof NexusData.getCompetitionParticipants === 'function'
      ? NexusData.getCompetitionParticipants(comp.id)
      : { teams: [], players: [], organizer: 'organizer' };

    const currentUsername = session.username.toLowerCase();
    const currentTeamName = (team ? team.name : '').toLowerCase();

    if (disputeTargetType === 'team') {
      return (p.teams || []).filter(t => (t.name || '').toLowerCase() !== currentTeamName).map(t => ({
        id: t.name,
        label: `${t.name} (${t.status || 'registered'})`
      }));
    }
    if (disputeTargetType === 'player') {
      return (p.players || []).filter(u => (u || '').toLowerCase() !== currentUsername).map(u => ({
        id: u,
        label: `@${u}`
      }));
    }
    if (disputeTargetType === 'organizer') {
      return [{
        id: p.organizer || 'organizer',
        label: `${p.organizer || 'Tournament Organizer'} (Organizer)`
      }];
    }
    return [];
  };

  const handleDisputeSubmit = (e) => {
    e.preventDefault();
    if (!disputeTargetType || !disputeTargetUser || disputeReason.trim().length < 10) {
      showToast('Please fill in all required fields (target and min. 10 chars reason).', 'error');
      return;
    }

    if (disputeTargetUser.toLowerCase() === session.username.toLowerCase()) {
      showToast('You cannot raise a dispute against yourself.', 'error');
      return;
    }

    const evidenceUrls = disputeEvidence ? disputeEvidence.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (NexusData && typeof NexusData.addDispute === 'function') {
      const res = NexusData.addDispute({
        competitionId: comp ? comp.id : 'comp-1',
        reportedBy: session.username,
        targetType: disputeTargetType,
        targetUserOrTeam: disputeTargetUser,
        reason: disputeReason.trim(),
        evidenceUrls,
        status: disputeTargetType === 'organizer' ? 'open_admin' : 'open_organizer',
        organizerWarnings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (res && res.ok === false) {
        showToast(res.error || 'Dispute blocked.', 'error');
        return;
      }
    }

    setShowDisputeModal(false);
    setDisputeTargetType('');
    setDisputeTargetUser('');
    setDisputeReason('');
    setDisputeEvidence('');
    showToast('Dispute submitted successfully.');
  };

  const handleSendModalInvite = (e) => {
    e.preventDefault();
    const tag = modalInviteInput.trim();
    if (!tag) {
      showToast('Please enter a username.', 'error');
      return;
    }
    handleSendInvite(tag);
    setModalInviteInput('');
    setShowInviteModal(false);
  };

  return (
    <Shell activeTab="activity">
      <div className="page-wrap">
        <main className="page-main">
          {/* HERO BANNER */}
          <div className="team-hero">
            <div className="hero-top">
              <div className="team-logo-box">
                <div style={{ fontSize: '32px' }}>⚡</div>
                <button
                  type="button"
                  className="logo-refresh"
                  title="Refresh"
                  onClick={loadTeam}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round">
                    <path d="M9.5 2A4.5 4.5 0 1 1 6 1" />
                    <polyline points="9.5 1 9.5 3.5 7 3.5" />
                  </svg>
                </button>
              </div>

              <div className="hero-info">
                {comp && (
                  <div
                    id="hero-comp-subtitle"
                    style={{
                      fontSize: '12px',
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                      color: 'rgba(198,255,51,0.75)',
                      fontWeight: 700,
                      marginBottom: '6px',
                      fontFamily: "'Lato', sans-serif"
                    }}
                  >
                    📋 {comp.name}
                  </div>
                )}
                <h1 className="hero-name" id="hero-name">
                  {team ? team.name.toUpperCase() : 'MY TEAM'}
                </h1>
                <div className="hero-meta">
                  <span className="hero-game-tag" id="hero-game">
                    {(comp && comp.game) || (team && team.game) || 'Rocket League'}
                  </span>
                  <span className="hero-role-badge">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                      <path d="M2 15c0-3 2.7-5 6-5s6 2 6 5" />
                    </svg>
                    Team Leader
                  </span>
                </div>
                <div className="hero-stats">
                  <div className="hstat">
                    <span className="hstat-label">Members</span>
                    <span className="hstat-value" id="hero-members">{memberCount}</span>
                  </div>
                  <div className="hstat">
                    <span className="hstat-label">Active Members</span>
                    <span className="hstat-value" id="hero-active">{memberCount}</span>
                  </div>
                  <div className="hstat">
                    <span className="hstat-label">Global Rank</span>
                    <span className="hstat-value accent" id="hero-rank">{team ? team.rank || '#14' : '#14'}</span>
                  </div>
                  <div className="hstat">
                    <span className="hstat-label">Win Rate</span>
                    <span className="hstat-value" id="hero-winrate">
                      {team && team.winRate ? `${team.winRate}%` : '68%'}
                    </span>
                  </div>
                </div>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="btn-invite"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="7" y1="1" x2="7" y2="13" />
                      <line x1="1" y1="7" x2="13" y2="7" />
                    </svg>
                    Invite Player
                  </button>
                  <button
                    type="button"
                    className="btn-share"
                    style={{ border: '1px solid #f87171', color: '#f87171' }}
                    onClick={() => setShowDisputeModal(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Raise Dispute
                  </button>
                </div>
              </div>
            </div>

            {/* TAB BAR */}
            <div className="tab-bar">
              <button
                type="button"
                className={`ttab ${activeTab === 'roster' ? 'active' : ''}`}
                onClick={() => setActiveTab('roster')}
              >
                Roster
              </button>
              <button
                type="button"
                className={`ttab ${activeTab === 'add-players' ? 'active' : ''}`}
                onClick={() => setActiveTab('add-players')}
              >
                Add Players
              </button>
              <button
                type="button"
                className={`ttab ${activeTab === 'join-requests' ? 'active' : ''}`}
                onClick={() => setActiveTab('join-requests')}
              >
                Join Requests <span className="notif-dot" id="jr-badge">{joinRequests.length}</span>
              </button>
              <button
                type="button"
                className={`ttab ${activeTab === 'invitations' ? 'active' : ''}`}
                onClick={() => setActiveTab('invitations')}
              >
                Invitations Sent
              </button>
              <button
                type="button"
                className={`ttab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>
          </div>

          {/* TAB CONTENT */}
          <div className="tab-content">
            {/* TAB 1 · ROSTER */}
            {activeTab === 'roster' && (
              <div className="tab-panel active" id="panel-roster">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Active Roster</h2>
                    <p className="section-sub">Your team members</p>
                  </div>
                </div>
                <div className="roster-grid" id="roster-grid-dynamic">
                  {members.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>
                      No members on this roster yet.
                    </div>
                  ) : (
                    members.map((m, idx) => {
                      const u = m.username || m.displayName || 'Player';
                      const isCaptain = (m.role || '').toLowerCase() === 'captain' || u.toLowerCase() === (session.username || '').toLowerCase();
                      const grad = POOL_GRAD[idx % POOL_GRAD.length];
                      const emoji = POOL_EMOJI[idx % POOL_EMOJI.length];

                      return (
                        <div className="roster-card" key={idx}>
                          <div className="rc-banner" style={{ background: grad }}>
                            <div className="rc-avatar-wrap">
                              <div className="rc-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', background: '#111' }}>
                                {emoji}
                              </div>
                            </div>
                          </div>
                          <div className="rc-body">
                            <div className="rc-top">
                              <div>
                                <h3 className="rc-name">@{u}</h3>
                                <p className="rc-role">{m.role || (isCaptain ? 'Team Captain' : 'Starter')}</p>
                              </div>
                              <span className={`rc-badge ${isCaptain ? 'captain' : 'starter'}`}>
                                {isCaptain ? 'Captain' : 'Starter'}
                              </span>
                            </div>
                            <div className="rc-stats">
                              <div className="rc-stat">
                                <span className="lbl">Status</span>
                                <span className="val" style={{ color: '#22c55e' }}>Active</span>
                              </div>
                              <div className="rc-stat">
                                <span className="lbl">Joined</span>
                                <span className="val">{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Active'}</span>
                              </div>
                            </div>
                            {!isCaptain && (
                              <button
                                type="button"
                                className="rc-remove-btn"
                                onClick={() => handleRemoveMember(u)}
                                style={{
                                  marginTop: '12px',
                                  width: '100%',
                                  padding: '8px',
                                  background: 'rgba(239,68,68,0.1)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                  color: '#f87171',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}
                              >
                                Remove Player
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2 · ADD PLAYERS */}
            {activeTab === 'add-players' && (
              <div className="tab-panel active" id="panel-add-players">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Find Players</h2>
                    <p className="section-sub">Browse and invite players to join your team.</p>
                  </div>
                </div>
                <div className="filter-row">
                  <div className="search-box">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="7" cy="7" r="5" />
                      <line x1="11" y1="11" x2="15" y2="15" />
                    </svg>
                    <input
                      className="ap-input"
                      id="ap-search"
                      placeholder="Search by gamertag or player ID..."
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                    />
                  </div>
                  <select className="flt-select" value={filterRank} onChange={(e) => setFilterRank(e.target.value)}>
                    <option value="">All Ranks</option>
                    <option>Radiant</option>
                    <option>Immortal</option>
                    <option>Grand Champion III</option>
                    <option>Grand Champion II</option>
                    <option>Champion III</option>
                  </select>
                  <select className="flt-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                    <option value="">By Role</option>
                    <option>IGL</option>
                    <option>Fragger</option>
                    <option>Support / Anchor</option>
                    <option>Flex / Mid</option>
                    <option>Striker</option>
                  </select>
                  <select className="flt-select" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
                    <option value="">By Region</option>
                    <option>Delhi</option>
                    <option>Mumbai</option>
                    <option>Hyderabad</option>
                    <option>Chennai</option>
                    <option>Bangalore</option>
                    <option>Sri City</option>
                  </select>
                  <select className="flt-select" value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)}>
                    <option value="">By Availability</option>
                    <option>Online Now</option>
                    <option>Available Weekends</option>
                  </select>
                </div>
                <div className="player-list" id="player-list">
                  {filteredPlayers.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No players match your filters.</div>
                  ) : (
                    filteredPlayers.map((p, idx) => {
                      const isInvited = invitedSet.has(p.tag);
                      return (
                        <div className="player-row" key={idx}>
                          <div className="pr-left">
                            <div className="pr-avatar" style={{ background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              🎮
                            </div>
                            <div>
                              <div className="pr-tag">
                                {p.tag} <span className="pr-id">{p.pid}</span>
                              </div>
                              <div className="pr-meta">
                                <span>{p.rank}</span> • <span>{p.role}</span> • <span>{p.region}</span>
                              </div>
                            </div>
                          </div>
                          <div className="pr-right">
                            <span className={`pr-status ${p.online ? 'online' : 'offline'}`}>
                              ● {p.online ? 'Online' : 'Offline'}
                            </span>
                            <button
                              type="button"
                              className={`btn-pr-invite ${isInvited ? 'invited' : ''}`}
                              onClick={() => !isInvited && handleSendInvite(p.tag)}
                              disabled={isInvited}
                            >
                              {isInvited ? 'Invited ✔' : 'Invite'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3 · JOIN REQUESTS */}
            {activeTab === 'join-requests' && (
              <div className="tab-panel active" id="panel-join-requests">
                <div className="jr-bar">
                  <div>
                    <h2 className="section-title">Pending Join Requests</h2>
                    <p className="section-sub">Review and manage incoming team applications for the upcoming season.</p>
                  </div>
                </div>
                <div id="jr-list">
                  {joinRequests.length === 0 ? (
                    <p className="jr-empty">No pending requests.</p>
                  ) : (
                    joinRequests.map((req, idx) => (
                      <div className="jr-row" key={idx}>
                        <div className="jr-left">
                          <div className="jr-av" style={{ background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            👤
                          </div>
                          <div>
                            <div className="jr-name">@{req.username || req.displayName || 'Player'}</div>
                            <div className="jr-meta">Requested on: {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recently'}</div>
                          </div>
                        </div>
                        <div className="jr-actions">
                          <button
                            type="button"
                            className="btn-jr-accept"
                            onClick={() => handleAcceptRequest(req.id)}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn-jr-decline"
                            onClick={() => handleDeclineRequest(req.id)}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4 · INVITATIONS SENT */}
            {activeTab === 'invitations' && (
              <div className="tab-panel active" id="panel-invitations">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Invitations Sent</h2>
                    <p className="section-sub">Track all outgoing invitations and their current status.</p>
                  </div>
                </div>
                <div className="inv-list" id="inv-list">
                  {invitations.length === 0 ? (
                    <p className="inv-empty">
                      No invitations sent yet. Head to{' '}
                      <span
                        onClick={() => setActiveTab('add-players')}
                        style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Add Players
                      </span>{' '}
                      to get started.
                    </p>
                  ) : (
                    invitations.map((inv, idx) => (
                      <div className="inv-row" key={idx}>
                        <div className="inv-left">
                          <div className="inv-av" style={{ background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✉
                          </div>
                          <div>
                            <div className="inv-name">@{inv.targetUsername || inv.username || 'Player'}</div>
                            <div className="inv-meta">Status: {inv.status || 'Pending'} • Sent: {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'Recently'}</div>
                          </div>
                        </div>
                        <div className="inv-actions">
                          <button
                            type="button"
                            className="btn-inv-revoke"
                            onClick={() => handleRevokeInvite(inv.id)}
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5 · SETTINGS */}
            {activeTab === 'settings' && (
              <div className="tab-panel active" id="panel-settings">
                <form onSubmit={handleSaveSettings}>
                  <div className="settings-section">
                    <div className="settings-section-title">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#c6ff33" strokeWidth="1.8" strokeLinecap="round">
                        <circle cx="10" cy="10" r="3" />
                        <path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.3 3.3l1.4 1.4m10.6 10.6 1.4 1.4M3.3 16.7l1.4-1.4m10.6-10.6 1.4-1.4" />
                      </svg>
                      General Settings
                    </div>
                    <div className="settings-grid">
                      <div className="settings-field">
                        <label className="settings-label">Team Name</label>
                        <input
                          className="settings-input"
                          id="set-team-name"
                          type="text"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                        />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label">Game / Title</label>
                        <select
                          className="settings-select"
                          id="set-game"
                          value={teamGame}
                          onChange={(e) => setTeamGame(e.target.value)}
                        >
                          <option>Rocket League</option>
                          <option>Valorant</option>
                          <option>League of Legends</option>
                          <option>Counter-Strike 2</option>
                          <option>Dota 2</option>
                        </select>
                      </div>
                      <div className="settings-field">
                        <label className="settings-label">Team Tag / Short Code</label>
                        <input
                          className="settings-input"
                          id="set-tag"
                          type="text"
                          value={teamTag}
                          onChange={(e) => setTeamTag(e.target.value)}
                        />
                      </div>
                      <div className="settings-field">
                        <label className="settings-label">Region</label>
                        <select
                          className="settings-select"
                          id="set-region"
                          value={teamRegion}
                          onChange={(e) => setTeamRegion(e.target.value)}
                        >
                          <option>Sri City</option>
                          <option>Delhi</option>
                          <option>Mumbai</option>
                          <option>Hyderabad</option>
                          <option>Chennai</option>
                          <option>Bangalore</option>
                        </select>
                      </div>
                      <div className="settings-field full">
                        <label className="settings-label">Team Bio / Description</label>
                        <textarea
                          className="settings-textarea"
                          id="set-desc"
                          rows="3"
                          value={teamDesc}
                          onChange={(e) => setTeamDesc(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#c6ff33" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" />
                        <line x1="22" y1="11" x2="16" y2="11" />
                      </svg>
                      Recruitment Status
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>Open for Join Requests</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Allow other players to discover and apply to your team</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={recruiting}
                        onChange={(e) => setRecruiting(e.target.checked)}
                        style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn-save-settings">
                      Save Settings
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* INVITE PLAYER MODAL */}
      {showInviteModal && (
        <div
          id="modal-invite"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => e.target.id === 'modal-invite' && setShowInviteModal(false)}
        >
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', width: 'min(96vw, 440px)', padding: '32px', position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              style={{ position: 'absolute', top: '16px', right: '18px', background: 'none', border: 'none', color: '#9aa4b2', fontSize: '20px', cursor: 'pointer' }}
            >
              ✕
            </button>
            <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: '20px' }}>Invite Player to Team</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '13px' }}>Enter the player's username or tag to send an invitation.</p>
            <form onSubmit={handleSendModalInvite}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Username / Gamertag</label>
                <input
                  type="text"
                  placeholder="e.g. GhostViper_99"
                  value={modalInviteInput}
                  onChange={(e) => setModalInviteInput(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '12px', background: 'var(--accent)', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RAISE DISPUTE MODAL */}
      {showDisputeModal && (
        <div
          id="modal-raise-dispute"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => e.target.id === 'modal-raise-dispute' && setShowDisputeModal(false)}
        >
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', width: 'min(96vw, 520px)', padding: '32px', position: 'relative', boxShadow: '0 20px 60px #000a' }}>
            <button
              type="button"
              onClick={() => setShowDisputeModal(false)}
              style={{ position: 'absolute', top: '16px', right: '18px', background: 'none', border: 'none', color: '#9aa4b2', fontSize: '20px', cursor: 'pointer' }}
            >
              ✕
            </button>
            <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: '20px' }}>⚠ Raise a Dispute</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '13px' }}>Select whether the dispute is against a Team, a Player, or the Organizer.</p>

            <form onSubmit={handleDisputeSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Dispute Against *</label>
                <select
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
                {disputeTargetType === 'organizer' && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#fb923c' }}>
                    📢 Dispute against Organizer is routed directly to Platform Admin.
                  </p>
                )}
                {disputeTargetType && disputeTargetType !== 'organizer' && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    📋 Dispute sent to Tournament Organizer for review.
                  </p>
                )}
              </div>

              {disputeTargetType && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Choose Target *</label>
                  <select
                    required
                    value={disputeTargetUser}
                    onChange={(e) => setDisputeTargetUser(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}
                  >
                    <option value="">— Select Target —</option>
                    {getDisputeTargets().map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Reason / Description *</label>
                <textarea
                  required
                  rows="4"
                  placeholder="Describe the issue in detail (min. 10 characters)..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Evidence Links (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. https://imgur.com/screenshot, https://youtube.com/clip"
                  value={disputeEvidence}
                  onChange={(e) => setDisputeEvidence(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#64748b' }}>Separate multiple links with a comma</p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
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
