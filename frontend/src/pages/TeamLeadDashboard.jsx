/**
 * NEXUS ESPORTS — Team Lead Dashboard
 *
 * hero banner,
 * roster, add-players search/invite, join requests, invitations, settings, the invite
 * modal and the raise-dispute modal. Uses the shared NexusData + NexusTeamWorkflow
 * services.
 *
 * Deviation: the page carried its own static `.sidebar` and `.site-footer`;
 * here the shared sidebar + AppLayout footer are used (consistent with other pages).
 */
import { useEffect, useMemo, useState } from 'react';
import NexusData from '../services/data.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/team-lead-dashboard.css';

const POOL_GRAD = [
  'linear-gradient(135deg,#0d2235,#1a3a55)', 'linear-gradient(135deg,#1e0d35,#38185a)',
  'linear-gradient(135deg,#0d2015,#1a3d25)', 'linear-gradient(135deg,#2a1500,#4a2800)',
  'linear-gradient(135deg,#001a2a,#003350)', 'linear-gradient(135deg,#1a0a25,#30154a)',
  'linear-gradient(135deg,#2a1a1a,#4a2a20)', 'linear-gradient(135deg,#0d1a2a,#1a3350)',
  'linear-gradient(135deg,#1a2a1a,#2a4a2a)', 'linear-gradient(135deg,#2a2a0d,#4a4a1a)',
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
const INV_STATUSES = ['pending', 'accepted', 'declined', 'pending', 'pending', 'accepted'];
const PROFILE_RANKS = ['Radiant', 'Immortal', 'Grand Champion III', 'Grand Champion II', 'Champion III'];
const PROFILE_ROLES = ['IGL', 'Fragger', 'Support / Anchor', 'Flex / Mid', 'Striker'];
const PROFILE_REGIONS = ['Delhi', 'Mumbai', 'Hyderabad', 'Chennai', 'Bangalore', 'Sri City'];

const normalize = (v) => String(v || '').trim().toLowerCase();
const getSession = () => { try { return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch (e) { return null; } };
const hashCode = (value) => { const s = String(value || ''); let h = 0; for (let i = 0; i < s.length; i += 1) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h); };
const formatTime = (value) => { if (!value) return 'just now'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'just now' : d.toLocaleString(); };

function makeProfileFromUsername(username) {
  const seed = hashCode(username);
  const cleaned = String(username || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return {
    tag: username,
    pid: `#${cleaned.slice(0, 6) || 'NEXUS'}`,
    rank: PROFILE_RANKS[seed % PROFILE_RANKS.length],
    role: PROFILE_ROLES[seed % PROFILE_ROLES.length],
    region: PROFILE_REGIONS[seed % PROFILE_REGIONS.length],
    online: (seed % 2) === 0,
    seed,
  };
}

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return { compId: p.get('compId') || p.get('comp'), teamId: p.get('teamId') || p.get('id') };
}
function getWorkflowContext() {
  if (!NexusTeamWorkflow || typeof NexusTeamWorkflow.resolveTeamContext !== 'function') return null;
  const ctx = NexusTeamWorkflow.resolveTeamContext();
  return ctx && ctx.comp && ctx.team ? ctx : null;
}
function getActiveComp() {
  if (!NexusData || typeof NexusData.loadCompetitions !== 'function') return null;
  const { compId, teamId } = getUrlParams();
  const all = NexusData.loadCompetitions();
  if (compId) return all.find((c) => String(c.id) === String(compId)) || null;
  if (teamId) return all.find((c) => Array.isArray(c.teams) && c.teams.some((t) => String(t.id) === String(teamId))) || null;
  const workflow = getWorkflowContext();
  if (workflow && workflow.comp) return workflow.comp;
  const session = getSession();
  const userKey = normalize(session && session.username);
  if (!userKey) return null;
  return all.find((c) => Array.isArray(c.teams) && c.teams.some((t) => normalize(t.createdBy || t.leaderUsername) === userKey)) || null;
}
function getActiveTeam() {
  const comp = getActiveComp();
  const { teamId } = getUrlParams();
  if (comp && Array.isArray(comp.teams)) {
    if (teamId) { const t = comp.teams.find((x) => String(x.id) === String(teamId)); if (t) return t; }
    const session = getSession();
    const userKey = normalize(session && session.username);
    if (userKey) {
      const t = comp.teams.find((x) => normalize(x.createdBy) === userKey || normalize(x.leaderUsername) === userKey);
      if (t) return t;
    }
  }
  const workflow = getWorkflowContext();
  return (workflow && workflow.team) || null;
}
function getCompTeamIds() {
  const url = getUrlParams();
  if (url.compId && url.teamId) return { compId: url.compId, teamId: url.teamId };
  const wf = getWorkflowContext();
  if (wf && wf.context) return { compId: wf.context.compId, teamId: wf.context.teamId };
  const comp = getActiveComp();
  const team = getActiveTeam();
  return { compId: comp ? comp.id : null, teamId: team ? team.id : null };
}

export default function TeamLeadDashboard() {
  const [tab, setTab] = useState('roster');
  const [version, setVersion] = useState(0);
  const [invited, setInvited] = useState(() => new Set());
  const [filters, setFilters] = useState({ q: '', rank: '', role: '', region: '', avail: '' });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [modal, setModal] = useState({ tag: '', role: '', message: '' });
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [dispute, setDispute] = useState({ targetType: '', target: '', reason: '', evidence: '' });
  const [settings, setSettings] = useState({ name: '', game: '', tag: '', region: '', rosterSize: 12 });

  const comp = useMemo(() => getActiveComp(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const team = useMemo(() => getActiveTeam(), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (team) {
      setSettings({
        name: (team.name || 'My Team').trim(),
        game: (comp && comp.game) || team.game || 'Rocket League',
        tag: team.tag || (team.name || 'TM').slice(0, 3).toUpperCase(),
        region: (comp && (comp.location || comp.region)) || 'Sri City',
        rosterSize: team.rosterLimit || 12,
      });
    }
  }, [team, comp, version]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setInviteOpen(false); setDisputeOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const members = team && Array.isArray(team.members) ? team.members : [];
  const teamName = team ? (team.name || 'My Team').trim() : (comp ? comp.name : 'My Team');
  const game = (comp && comp.game) || (team && team.game) || 'Unknown Game';

  const candidates = useMemo(() => {
    const ctx = getWorkflowContext();
    if (ctx && NexusTeamWorkflow && typeof NexusTeamWorkflow.getAvailablePlayers === 'function') {
      return NexusTeamWorkflow.getAvailablePlayers(ctx.comp.id, ctx.team.id).map((p) => makeProfileFromUsername(p.username || p.displayName || 'player'));
    }
    return PLAYERS_DATA.slice();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const visiblePlayers = candidates.filter((p) => {
    const q = filters.q.toLowerCase().trim();
    if (q && !p.tag.toLowerCase().includes(q) && !p.role.toLowerCase().includes(q) && !p.region.toLowerCase().includes(q)) return false;
    if (filters.rank && !p.rank.toLowerCase().includes(filters.rank.toLowerCase())) return false;
    if (filters.role && !p.role.toLowerCase().includes(filters.role.toLowerCase().replace(' / ', '/'))) return false;
    if (filters.region && p.region.toLowerCase() !== filters.region.toLowerCase()) return false;
    if (filters.avail === 'Online Now' && !p.online) return false;
    return true;
  });

  const invites = useMemo(() => {
    const ctx = getWorkflowContext();
    if (ctx && NexusTeamWorkflow && typeof NexusTeamWorkflow.getInvites === 'function') return NexusTeamWorkflow.getInvites(ctx.comp.id, ctx.team.id);
    return PLAYERS_DATA.filter((p) => invited.has(p.tag));
  }, [version, invited]);

  const pendingRequests = useMemo(() => {
    const ctx = getWorkflowContext();
    if (ctx && NexusTeamWorkflow && typeof NexusTeamWorkflow.getJoinRequests === 'function') {
      return NexusTeamWorkflow.getJoinRequests(ctx.comp.id, ctx.team.id).filter((r) => r.status === 'pending');
    }
    return [];
  }, [version]);

  function doInvite(tag) {
    const ctx = getWorkflowContext();
    if (ctx && NexusTeamWorkflow && typeof NexusTeamWorkflow.sendInvite === 'function') {
      const result = NexusTeamWorkflow.sendInvite({ compId: ctx.comp.id, teamId: ctx.team.id, toUsername: tag, roleOffered: filters.role && filters.role !== 'By Role' ? filters.role : 'Player' });
      if (!result.ok) { showToast(result.error || 'Unable to send invitation right now.', 'error'); return; }
      showToast(`Invitation sent to ${tag}!`);
      setVersion((v) => v + 1);
      return;
    }
    setInvited((s) => new Set(s).add(tag));
    showToast('Invitation sent!');
  }

  function revokeInvite(ref) {
    const ctx = getWorkflowContext();
    if (ctx && NexusTeamWorkflow && typeof NexusTeamWorkflow.revokeInvite === 'function') {
      const result = NexusTeamWorkflow.revokeInvite({ compId: ctx.comp.id, teamId: ctx.team.id, inviteId: ref });
      if (!result.ok) { showToast(result.error || 'Unable to revoke invite.', 'error'); return; }
    } else {
      setInvited((s) => { const n = new Set(s); n.delete(ref); return n; });
    }
    showToast('Invitation revoked', 'error');
    setVersion((v) => v + 1);
  }

  function decide(requestId, action) {
    const ctx = getWorkflowContext();
    if (ctx && NexusTeamWorkflow && typeof NexusTeamWorkflow.decideJoinRequest === 'function') {
      const result = NexusTeamWorkflow.decideJoinRequest({ compId: ctx.comp.id, teamId: ctx.team.id, requestId, action });
      if (!result.ok) { showToast(result.error || 'Unable to update request.', 'error'); return; }
      showToast(action === 'accepted' ? 'Player accepted to team!' : 'Request declined', action === 'accepted' ? undefined : 'error');
      setVersion((v) => v + 1);
    }
  }

  function sendModalInvite() {
    const tag = modal.tag.trim();
    if (!tag) return;
    const ctx = getWorkflowContext();
    if (ctx && NexusTeamWorkflow && typeof NexusTeamWorkflow.sendInvite === 'function') {
      const result = NexusTeamWorkflow.sendInvite({ compId: ctx.comp.id, teamId: ctx.team.id, toUsername: tag, roleOffered: modal.role || 'Player', message: modal.message.trim() });
      if (!result.ok) { showToast(result.error || 'Unable to send invitation.', 'error'); return; }
    } else {
      setInvited((s) => new Set(s).add(tag));
    }
    setInviteOpen(false);
    setModal({ tag: '', role: '', message: '' });
    showToast(`Invitation sent to ${tag}!`);
    setVersion((v) => v + 1);
  }

  function copyLink() {
    const { compId, teamId } = getCompTeamIds();
    const base = `${window.location.origin}/pages/join-teams.html`;
    const params = new URLSearchParams();
    if (compId) params.set('id', compId);
    if (teamId) params.set('teamId', teamId);
    const url = params.toString() ? `${base}?${params.toString()}` : base;
    navigator.clipboard?.writeText(url).catch(() => {});
    showToast('Team link copied to clipboard!');
  }

  function saveSettings() {
    const { compId, teamId } = getCompTeamIds();
    if (compId && NexusData) {
      const all = NexusData.loadCompetitions();
      const c = all.find((x) => String(x.id) === String(compId));
      if (c && Array.isArray(c.teams) && teamId) {
        const t = c.teams.find((x) => String(x.id) === String(teamId));
        if (t) {
          if (settings.name) t.name = settings.name;
          t.rosterLimit = parseInt(settings.rosterSize, 10) || t.rosterLimit;
          NexusData.updateCompetition(c);
        }
      }
    }
    showToast('Settings saved!');
    setVersion((v) => v + 1);
  }

  function targetOptions() {
    if (!dispute.targetType) return [];
    const compId = getUrlParams().compId || 'sum-champ-2026';
    const p = NexusData && NexusData.getCompetitionParticipants ? NexusData.getCompetitionParticipants(compId) : { teams: [], players: [], organizer: 'organizer' };
    const session = getSession();
    const user = normalize(session && session.username);
    if (dispute.targetType === 'team') return (p.teams || []).map((t) => ({ value: t.name, label: `${t.name} (${t.status || 'registered'})` })).filter((n) => normalize(n.value) !== '');
    if (dispute.targetType === 'player') return (p.players || []).filter((u) => normalize(u) !== user).map((u) => ({ value: u, label: `@${u}` }));
    if (dispute.targetType === 'organizer') {
      const orgs = (Array.isArray(p.organizers) && p.organizers.length > 0) ? p.organizers : [p.organizer || 'organizer'];
      const comp = NexusData && NexusData.getCompetitionById ? NexusData.getCompetitionById(compId) : null;
      const creatorKey = normalize((comp && (comp.createdBy || comp.organizerId)) || orgs[0] || '');
      return orgs
        .filter((u) => normalize(u) !== user)
        .map((org) => {
          const isMain = normalize(org) === creatorKey || normalize(org) === normalize(comp && comp.createdBy) || normalize(org) === normalize(comp && comp.organizerId);
          const roleTag = isMain ? 'Organizer' : 'Co-Organizer';
          return { value: org, label: `${org} (${roleTag})` };
        });
    }
    return [{ value: p.organizer || 'organizer', label: `${p.organizer || 'organizer'} (Organizer)` }];
  }

  function submitDispute(e) {
    e.preventDefault();
    const compId = getUrlParams().compId || 'sum-champ-2026';
    const target = dispute.target.replace(/^@/, '').trim();
    if (!dispute.targetType || !target || dispute.reason.trim().length < 10) {
      showToast('Please fill in all required fields (target and min. 10 chars reason).', 'error');
      return;
    }
    if (NexusData && typeof NexusData.addDispute === 'function') {
      const session = getSession();
      const result = NexusData.addDispute({
        competitionId: compId,
        reportedBy: (session && session.username) || 'team_lead',
        targetType: dispute.targetType,
        targetUserOrTeam: target,
        reason: dispute.reason.trim(),
        evidenceUrls: dispute.evidence ? dispute.evidence.split(',').map((s) => s.trim()).filter(Boolean) : [],
        status: dispute.targetType === 'organizer' ? 'open_admin' : 'open_organizer',
        organizerWarnings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (result && result.ok === false) { showToast(result.error || 'Dispute blocked.', 'error'); return; }
    }
    setDisputeOpen(false);
    setDispute({ targetType: '', target: '', reason: '', evidence: '' });
    showToast('Dispute submitted');
  }

  const TABS = [
    ['roster', 'Roster'], ['add-players', 'Add Players'], ['join-requests', 'Join Requests'],
    ['invitations', 'Invitations Sent'], ['settings', 'Settings'],
  ];

  return (
    <div className="page-wrap">
      <main className="page-main">
        <div className="team-hero">
          <div className="hero-top">
            <div className="team-logo-box">
              <img id="hero-logo" src={assetUrl('f03e2b11537e425d8544ee3ca732bf73af5137c0.png')} alt="Team Logo" />
            </div>
            <div className="hero-info">
              {comp && comp.name ? <div id="hero-comp-subtitle" style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(198,255,51,0.75)', fontWeight: 700, marginBottom: 6, fontFamily: "'Lato',sans-serif" }}>{`📋 ${comp.name}`}</div> : null}
              <h1 className="hero-name" id="hero-name">{teamName.toUpperCase()}</h1>
              <div className="hero-meta">
                <span className="hero-game-tag" id="hero-game">{game}</span>
                <span className="hero-role-badge">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /><path d="M2 15c0-3 2.7-5 6-5s6 2 6 5" /></svg>
                  Team Leader
                </span>
                {team ? (
                  <span className="hero-game-tag" id="hero-team-status">{`Team ${{ approved: 'Approved', rejected: 'Rejected', banned: 'Banned' }[normalize(team.status || 'approved')] || 'Pending'}`}</span>
                ) : null}
              </div>
              <div className="hero-stats">
                <div className="hstat"><span className="hstat-label">Members</span><span className="hstat-value" id="hero-members">{members.length || '—'}</span></div>
                <div className="hstat"><span className="hstat-label">Active Members</span><span className="hstat-value" id="hero-active">{members.length || '—'}</span></div>
                <div className="hstat"><span className="hstat-label">Global Rank</span><span className="hstat-value accent" id="hero-rank">{(team && team.rank) || '#—'}</span></div>
                <div className="hstat"><span className="hstat-label">Win Rate</span><span className="hstat-value" id="hero-winrate">{team && team.winRate ? `${team.winRate}%` : '—%'}</span></div>
              </div>
              <div className="hero-actions">
                <button className="btn-invite" onClick={() => setInviteOpen(true)}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="7" y1="1" x2="7" y2="13" /><line x1="1" y1="7" x2="13" y2="7" /></svg>
                  Invite Player
                </button>
                <button className="btn-share" style={{ border: '1px solid #f87171', color: '#f87171' }} onClick={() => setDisputeOpen(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  Raise Dispute
                </button>
                <button className="btn-share" onClick={copyLink}>Copy Team Link</button>
              </div>
            </div>
          </div>

          <div className="tab-bar">
            {TABS.map(([id, label]) => (
              <button key={id} className={`ttab ${tab === id ? 'active' : ''}`} data-tab={id} onClick={() => setTab(id)}>
                {label}{id === 'join-requests' ? <span className="notif-dot" id="jr-badge" style={{ display: pendingRequests.length ? 'inline-flex' : 'none' }}>{pendingRequests.length}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="tab-content">
          {tab === 'roster' && (
            <div className="tab-panel active" id="panel-roster">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Active Roster</h2>
                  <p className="section-sub">{members.length} active player{members.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="roster-grid" id="roster-grid-dynamic">
                {members.map((m, i) => {
                  const isCaptain = m.role === 'captain';
                  const name = m.displayName || m.username || 'Player';
                  const joined = m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
                  return (
                    <div className={`player-card${isCaptain ? ' is-captain' : ''}`} key={`${name}-${i}`}>
                      {isCaptain && <div className="cap-star"><svg width="10" height="10" viewBox="0 0 10 10" fill="#000"><polygon points="5,1 6.2,3.8 9.5,4 7.5,6 8.1,9.5 5,7.7 1.9,9.5 2.5,6 0.5,4 3.8,3.8" /></svg></div>}
                      <div className="pc-emoji" style={{ background: POOL_GRAD[i % POOL_GRAD.length] }}>{POOL_EMOJI[i % POOL_EMOJI.length]}</div>
                      <div className="pc-name">{name}</div>
                      <span className="pc-role-pill">{isCaptain ? 'Captain' : 'Member'}</span>
                      <hr className="pc-divider" />
                      <div className="pc-stats">
                        <div><span className="pc-stat-val">—</span><span className="pc-stat-key">Win Rate</span></div>
                        <div><span className="pc-stat-val">—</span><span className="pc-stat-key">K/D</span></div>
                      </div>
                      <div className="pc-status"><span className="online-dot"></span>—</div>
                      <div className="pc-joined">Joined {joined}</div>
                    </div>
                  );
                })}
                <div className="add-card" onClick={() => setTab('add-players')}>
                  <div className="add-circle">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#99a1af" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </div>
                  <p>Add New Player</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'add-players' && (
            <div className="tab-panel active" id="panel-add-players">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Find Players</h2>
                  <p className="section-sub">Browse and invite players to join your team.</p>
                </div>
              </div>
              <div className="filter-row">
                <div className="search-box">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="15" y2="15" /></svg>
                  <input className="ap-input" id="ap-search" placeholder="Search by gamertag or player ID..." value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
                </div>
                <select className="flt-select" id="flt-rank" value={filters.rank} onChange={(e) => setFilters((f) => ({ ...f, rank: e.target.value }))}>
                  <option value="">All Ranks</option><option>Radiant</option><option>Immortal</option><option>Grand Champion</option><option>Champion</option>
                </select>
                <select className="flt-select" id="flt-role" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
                  <option value="">By Role</option><option>IGL</option><option>Fragger</option><option>Support / Anchor</option><option>Flex / Mid</option><option>Striker</option>
                </select>
                <select className="flt-select" id="flt-region" value={filters.region} onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}>
                  <option value="">By Region</option><option>Delhi</option><option>Mumbai</option><option>Hyderabad</option><option>Chennai</option><option>Bangalore</option><option>Sri City</option>
                </select>
                <select className="flt-select" id="flt-avail" value={filters.avail} onChange={(e) => setFilters((f) => ({ ...f, avail: e.target.value }))}>
                  <option value="">By Availability</option><option>Online Now</option><option>Available Weekends</option>
                </select>
              </div>
              <div className="player-list" id="player-list">
                {visiblePlayers.length === 0 && <p style={{ fontSize: 14, color: 'var(--text-muted)', padding: '32px 0' }}>No players match your filters.</p>}
                {visiblePlayers.map((p) => {
                  const gi = typeof p.seed === 'number' ? p.seed : PLAYERS_DATA.indexOf(p);
                  const isSent = invited.has(p.tag);
                  return (
                    <div className="player-row" key={p.tag}>
                      <div className="pr-ava-wrap">
                        <div className="pr-ava" style={{ background: POOL_GRAD[gi % POOL_GRAD.length] }}>{POOL_EMOJI[gi % POOL_EMOJI.length]}</div>
                        <div className={`pr-online${p.online ? ' on' : ''}`}></div>
                      </div>
                      <div className="pr-names"><div className="pr-tag">{p.tag}</div><div className="pr-pid">Player ID: {p.pid}</div></div>
                      <div className="pr-rank"><span style={{ fontSize: 16 }}>🏆</span><span className="pr-rank-val">{p.rank}</span></div>
                      <div className="pr-col"><span className="pr-col-label">Role</span><span className="pr-col-val">{p.role}</span></div>
                      <div className="pr-col"><span className="pr-col-label">Region</span><span className="pr-col-val">{p.region}</span></div>
                      <button className={`btn-invite-sm${isSent ? ' sent' : ''}`} disabled={isSent} onClick={() => doInvite(p.tag)}>{isSent ? 'Sent ✓' : 'Send Invite'}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'join-requests' && (
            <div className="tab-panel active" id="panel-join-requests">
              <div className="jr-bar">
                <div>
                  <h2 className="section-title">Pending Join Requests</h2>
                  <p className="section-sub">Review and manage incoming team applications for the upcoming season.</p>
                </div>
              </div>
              <div id="jr-list">
                {pendingRequests.map((req, i) => {
                  const displayName = req.displayName || req.username;
                  return (
                    <div className="jr-card" key={req.id}>
                      <div className="jr-ava-wrap">
                        <div className="jr-ava" style={{ background: POOL_GRAD[i % POOL_GRAD.length] }}>{POOL_EMOJI[i % POOL_EMOJI.length]}</div>
                        <span className="jr-lvl">PENDING</span>
                      </div>
                      <div className="jr-body">
                        <div className="jr-top">
                          <span className="jr-name">{displayName}</span>
                          <span className="jr-rank-pill">Join Request</span>
                          <span className="jr-time">{formatTime(req.requestedAt)}</span>
                        </div>
                        <div className="jr-meta"><div className="jr-meta-item">Username: {req.username}</div></div>
                        <div className="jr-quote">{req.message ? `"${req.message}"` : 'No message provided.'}</div>
                      </div>
                      <div className="jr-actions">
                        <button className="btn-decline" onClick={() => decide(req.id, 'declined')}>Decline</button>
                        <button className="btn-accept" onClick={() => decide(req.id, 'accepted')}>Accept</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {pendingRequests.length === 0 && <p className="jr-empty" id="jr-empty">No pending requests.</p>}
            </div>
          )}

          {tab === 'invitations' && (
            <div className="tab-panel active" id="panel-invitations">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Invitations Sent</h2>
                  <p className="section-sub">Track all outgoing invitations and their current status.</p>
                </div>
              </div>
              <div className="inv-list" id="inv-list">
                {invites.map((invite, index) => {
                  const stat = invite.status || INV_STATUSES[index % INV_STATUSES.length];
                  const sc = { pending: 'sp-pending', accepted: 'sp-accepted', declined: 'sp-declined' }[stat] || 'sp-pending';
                  const name = invite.toUsername || invite.tag;
                  const gi = index;
                  return (
                    <div className="inv-row" key={`${name}-${index}`}>
                      <div className="inv-ava" style={{ background: POOL_GRAD[gi % POOL_GRAD.length] }}>{POOL_EMOJI[gi % POOL_EMOJI.length]}</div>
                      <div className="inv-info"><div className="inv-name">{name}</div><div className="inv-role">{invite.roleOffered || invite.role || 'Player'}</div></div>
                      <span className={`status-pill ${sc}`}>{stat}</span>
                      <span className="inv-time">{formatTime(invite.sentAt)}</span>
                      {stat === 'pending' ? <button className="btn-revoke" onClick={() => revokeInvite(invite.id || name)}>Revoke</button> : null}
                    </div>
                  );
                })}
              </div>
              {invites.length === 0 && <p className="inv-empty" id="inv-empty">No invitations sent yet. Head to <a href="#" onClick={(e) => { e.preventDefault(); setTab('add-players'); }} style={{ color: 'var(--accent)' }}>Add Players</a> to get started.</p>}
            </div>
          )}

          {tab === 'settings' && (
            <div className="tab-panel active" id="panel-settings">
              <div className="settings-section">
                <div className="settings-section-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#c6ff33" strokeWidth="1.8" strokeLinecap="round"><circle cx="10" cy="10" r="3" /><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.3 3.3l1.4 1.4m10.6 10.6 1.4 1.4M3.3 16.7l1.4-1.4m10.6-10.6 1.4-1.4" /></svg>
                  General Settings
                </div>
                <div className="settings-grid">
                  <div className="settings-field"><label className="settings-label">Team Name</label><input className="settings-input" id="set-team-name" type="text" value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} /></div>
                  <div className="settings-field">
                    <label className="settings-label">Game / Title</label>
                    <select className="settings-select" id="set-game" value={settings.game} onChange={(e) => setSettings((s) => ({ ...s, game: e.target.value }))}>
                      <option>Rocket League</option><option>Valorant</option><option>League of Legends</option><option>Counter-Strike 2</option><option>Dota 2</option>
                    </select>
                  </div>
                  <div className="settings-field"><label className="settings-label">Team Tag / Short Code</label><input className="settings-input" id="set-tag" type="text" value={settings.tag} onChange={(e) => setSettings((s) => ({ ...s, tag: e.target.value }))} /></div>
                  <div className="settings-field">
                    <label className="settings-label">Region</label>
                    <select className="settings-select" id="set-region" value={settings.region} onChange={(e) => setSettings((s) => ({ ...s, region: e.target.value }))}>
                      <option>Sri City</option><option>Delhi</option><option>Mumbai</option><option>Hyderabad</option><option>Chennai</option><option>Bangalore</option><option>Online</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#c6ff33" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="14" height="8" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  Roster &amp; Privacy
                </div>
                <div className="settings-grid" style={{ marginBottom: 20 }}>
                  <div className="settings-field"><label className="settings-label">Roster Size Limit</label><input className="settings-input" id="set-roster-size" type="number" min="1" max="50" value={settings.rosterSize} onChange={(e) => setSettings((s) => ({ ...s, rosterSize: e.target.value }))} /></div>
                </div>
                {[['set-open-apps', 'Open to Applications', 'Allow other players to request to join your team', true], ['set-visibility', 'Team Visibility', 'Make your team publicly visible in the player directory', true], ['set-member-profiles', 'Show Member Profiles', 'Allow others to view individual member statistics', false]].map(([id, label, desc, def]) => (
                  <div className="settings-toggle-row" key={id}>
                    <div className="settings-toggle-info"><div className="settings-toggle-label">{label}</div><div className="settings-toggle-desc">{desc}</div></div>
                    <label className="toggle-switch"><input type="checkbox" id={id} defaultChecked={def} /><div className="toggle-track"><div className="toggle-thumb"></div></div></label>
                  </div>
                ))}
              </div>

              <div className="settings-section">
                <div className="settings-section-title">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#c6ff33" strokeWidth="1.8" strokeLinecap="round"><path d="M10 2a6 6 0 0 0-6 6c0 7-3 9-3 9h18s-3-2-3-9a6 6 0 0 0-6-6z" /><path d="M11.73 17a2 2 0 0 1-3.46 0" /></svg>
                  Notifications
                </div>
                {[['set-notif-join', 'Join Request Alerts', 'Get notified when players request to join your team', true], ['set-notif-match', 'Match Reminders', 'Remind team members 1 hour before scheduled matches', true], ['set-notif-inv', 'Invitation Responses', 'Get notified when players accept or decline your invitations', false]].map(([id, label, desc, def]) => (
                  <div className="settings-toggle-row" key={id}>
                    <div className="settings-toggle-info"><div className="settings-toggle-label">{label}</div><div className="settings-toggle-desc">{desc}</div></div>
                    <label className="toggle-switch"><input type="checkbox" id={id} defaultChecked={def} /><div className="toggle-track"><div className="toggle-thumb"></div></div></label>
                  </div>
                ))}
              </div>

              <div className="settings-actions">
                <button className="btn-save-settings" onClick={saveSettings}>Save Changes</button>
                <button className="btn-cancel-settings" onClick={() => setTab('roster')}>Cancel</button>
              </div>

              <div className="settings-section danger-zone" style={{ marginTop: 32 }}>
                <div className="settings-section-title" style={{ color: 'var(--red)' }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round"><path d="M10 2L2 17h16L10 2z" /><line x1="10" y1="9" x2="10" y2="12" /><circle cx="10" cy="15" r="0.5" fill="var(--red)" /></svg>
                  Danger Zone
                </div>
                <div className="danger-zone-content">
                  <p className="danger-zone-desc">Permanently delete this team and all its data. This action is irreversible and all members will be immediately removed from the tournament roster.</p>
                  <button className="btn-danger btn-danger-full" onClick={() => { if (window.confirm('Are you absolutely sure you want to disband this team? This cannot be undone.')) showToast('Team disbanded.', 'error'); }}>DISBAND TEAM PERMANENTLY</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {inviteOpen && (
        <div className="modal-overlay open" id="invite-modal" onClick={(e) => { if (e.target === e.currentTarget) setInviteOpen(false); }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setInviteOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="16" y2="16" /><line x1="16" y1="2" x2="2" y2="16" /></svg>
            </button>
            <div className="modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c6ff33" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></svg>
            </div>
            <div className="modal-title">Invite Player</div>
            <div className="modal-sub" id="modal-team-sub">{`${teamName} — Elite Tier Roster`}</div>
            <div className="modal-field">
              <label className="modal-label">Player Gamertag or ID</label>
              <div className="modal-input-wrap"><span className="modal-input-at">@</span><input className="modal-input" id="modal-gamertag" type="text" placeholder="nexus_id or username" value={modal.tag} onChange={(e) => setModal((m) => ({ ...m, tag: e.target.value }))} /></div>
            </div>
            <div className="modal-field">
              <label className="modal-label">Role Selection</label>
              <select className="modal-select" id="modal-role" value={modal.role} onChange={(e) => setModal((m) => ({ ...m, role: e.target.value }))}>
                <option value="">Choose a position...</option><option>IGL</option><option>Fragger</option><option>Support / Anchor</option><option>Flex / Mid</option><option>Striker</option><option>Entry Fragger</option>
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Invitation Message <span>Optional</span></label>
              <textarea className="modal-textarea" id="modal-message" placeholder="Add a personal note to the player..." value={modal.message} onChange={(e) => setModal((m) => ({ ...m, message: e.target.value }))} />
            </div>
            <button className="btn-send-invite" onClick={sendModalInvite}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="7" x2="13" y2="7" /><polyline points="8 2 13 7 8 12" /></svg>
              Send Invitation
            </button>
            <button className="btn-modal-cancel" onClick={() => setInviteOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {disputeOpen && (
        <div id="modal-raise-dispute" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setDisputeOpen(false); }}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, width: 'min(96vw,520px)', padding: 32, position: 'relative', boxShadow: '0 20px 60px #000a' }}>
            <button onClick={() => setDisputeOpen(false)} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', color: '#9aa4b2', fontSize: 20, cursor: 'pointer' }}>✕</button>
            <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: 20 }}>⚠ Raise a Dispute</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 13 }}>Select whether the dispute is against a Team, a Player, or the Organizer.</p>

            <form onSubmit={submitDispute}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Dispute Against *</label>
                <select id="dispute-target-type" required value={dispute.targetType} onChange={(e) => setDispute((d) => ({ ...d, targetType: e.target.value, target: '' }))} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
                  <option value="">— Select Target Entity —</option>
                  <option value="team">Team (Opponent)</option>
                  <option value="player">Player (Participant)</option>
                  <option value="organizer">Tournament Organizer</option>
                </select>
                {dispute.targetType && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: dispute.targetType === 'organizer' ? '#fb923c' : '#64748b' }}>
                    {dispute.targetType === 'organizer' ? '📢 Dispute against Organizer is routed directly to Platform Admin.' : '📋 Dispute sent to Tournament Organizer for review.'}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{dispute.targetType === 'organizer' ? 'Tournament Organizer *' : 'Choose Target *'}</label>
                <select id="dispute-target-user" required value={dispute.target} onChange={(e) => setDispute((d) => ({ ...d, target: e.target.value }))} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
                  {!dispute.targetType && <option value="">— Select Category First —</option>}
                  {dispute.targetType && <option value="">— Select —</option>}
                  {targetOptions().map((o) => {
                    const val = typeof o === 'object' ? o.value : o;
                    const lbl = typeof o === 'object' ? o.label : o;
                    return <option key={val || lbl} value={val}>{lbl}</option>;
                  })}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Reason / Description *</label>
                <textarea id="dispute-reason" required rows="4" placeholder="Describe the issue in detail (min. 10 characters)..." value={dispute.reason} onChange={(e) => setDispute((d) => ({ ...d, reason: e.target.value }))} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Evidence Links (optional)</label>
                <input id="dispute-evidence" type="text" placeholder="e.g. https://imgur.com/screenshot, https://youtube.com/clip" value={dispute.evidence} onChange={(e) => setDispute((d) => ({ ...d, evidence: e.target.value }))} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
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
    </div>
  );
}


