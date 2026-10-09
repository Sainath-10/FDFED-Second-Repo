/**
 * NEXUS ESPORTS — Competition Detail
 *
 *
 * organizer's competition management view. Preserves: the hero + action buttons
 * (ended-aware), the stats row, the registered-teams table with approve/reject,
 * the paginated match schedule, the league/tournament bracket, and the (exported)
 * manage-organizers modal.
 *
 * Notes on the implementation carried over:
 * - `comp.role === 'organizer'` gates the team approve/reject actions;
 * - the organizer add/remove endpoints were hardcoded to :3000 in the file
 * (the rest of the app uses :3001) — preserved verbatim;
 * - `renderStandings` in the file is dead code (never called, no matching
 * DOM), so it is not ported.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/competition-detail.css';

const STATUS_COLORS = { ongoing: '#c6ff33', completed: '#9aa4b2', upcoming: '#60a5fa' };
const STATUS_LABELS = { ongoing: 'ONGOING', completed: 'COMPLETED', upcoming: 'UPCOMING' };
const LIMIT = 3;

function formatPrizePool(prize) {
  if (!prize || ['—', '-', '₹0'].includes(prize) || String(prize).toLowerCase().includes('no prize')) return 'No Prize Pool';
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

function renderTeamAvatar(avatar, name) {
  const fallback = name ? String(name).charAt(0).toUpperCase() : '🛡️';
  if (!avatar) return fallback;
  const str = String(avatar).trim();
  if (str.startsWith('<svg') && str.endsWith('</svg>')) {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: str }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
      />
    );
  }
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/') || str.startsWith('data:image/')) {
    return <img src={str} alt={name || 'Team'} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />;
  }
  if (str.length <= 4) return str;
  return fallback;
}

const DEFAULT_BANNERS = [
  [['valorant'], '8764f3a5ce7a0eb0275743600c60fb0c727893c8.png'],
  [['counter-strike', 'cs2', 'cs:go', 'csgo'], 'c4f97eccde97e10ac89b61ec5fb36fdce0ab2477.png'],
  [['league of legends', 'lol'], '95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png'],
  [['apex'], 'f03e2b11537e425d8544ee3ca732bf73af5137c0.png'],
];
function getDefaultBanner(gameName) {
  const g = String(gameName || '').toLowerCase();
  for (const [keys, file] of DEFAULT_BANNERS) {
    if (keys.some((k) => g.includes(k))) return assetUrl(file);
  }
  return assetUrl('b890c61489a080992ad7e99adabb1145e6d59606.png');
}

function roundPriority(r, tournament) {
  const s = String(r || '').toLowerCase().replace(/\s/g, '');
  if (s.includes('group')) return 1;
  if (s.includes('elim')) return 2;
  if (tournament && s.includes('roundof16')) return 2.5;
  if (s.includes('quarter') || s.includes('quater')) return 3;
  if (s.includes('semi')) return 4;
  if (s.includes('final')) return 5;
  return 99;
}

export default function CompetitionDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const id = params.get('id') || '';
  const [version, setVersion] = useState(0);
  const [matchPage, setMatchPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [newOrg, setNewOrg] = useState('');

  const comp = useMemo(
    () => (id && NexusData ? NexusData.getCompetitionById(id) : null),
    [id, version],
  );

  useEffect(() => {
    if (!id) navigate('/pages/my-activity.html');
  }, [id, navigate]);

  useEffect(() => {
    if (comp && NexusData && NexusData.enforceNotEnded) {
      NexusData.enforceNotEnded(comp, '.act-btn-approve,.act-btn-reject,.disp-btn-resolve,.btn-schedule');
    }
    return () => {
      const banner = document.getElementById('_ended_banner_');
      if (banner) banner.remove();
      document.body.style.marginTop = '';
    };
  }, [comp]);

  useEffect(() => {
    if (comp) document.title = `NEXUS ESPORTS — ${comp.name}`;
  }, [comp]);

  if (!comp) {
    return (
      <main className="comp-main" id="comp-main">
        <div className="comp-hero" id="comp-hero">
          <div className="comp-hero-content">
            <div className="comp-hero-tags" id="comp-hero-tags"><span className="hero-tag">Unknown</span></div>
            <h1 className="comp-hero-title" id="comp-hero-title">Competition Not Found</h1>
            <div className="comp-hero-meta" id="comp-hero-meta"></div>
          </div>
        </div>
      </main>
    );
  }

  const isEnded = !!(comp.ended || comp.status === 'completed');
  const teams = comp.teams || [];
  const approvedCount = teams.filter((t) => t.status === 'approved').length;
  const matches = comp.matches || [];

  const bannerImg = comp.img ? assetUrl(comp.img) : getDefaultBanner(comp.game);
  const heroStyle = bannerImg
    ? { background: `linear-gradient(rgba(10, 15, 20, 0.75), rgba(10, 15, 20, 0.95)), url('${bannerImg}') center/cover no-repeat` }
    : { background: `linear-gradient(135deg, ${comp.bannerColor || '#1a2e1a'} 0%, #0a0a0a 70%)` };

  let pendingDisputesCount = 0;
  if (NexusData && typeof NexusData.loadDisputes === 'function') {
    pendingDisputesCount = NexusData.loadDisputes().filter((d) =>
      d.competitionId === comp.id && ['open_organizer', 'under_review', 'open', 'awaiting'].includes(d.status)).length;
  } else if (Array.isArray(comp.disputes)) {
    pendingDisputesCount = comp.disputes.filter((d) => ['open_organizer', 'under_review', 'open', 'awaiting'].includes(d.status)).length;
  }

  const organizerCount = Array.isArray(comp.organizers) && comp.organizers.length > 0 ? comp.organizers.length : 1;
  const hasEntryFee = comp.feeType && comp.feeType !== 'free' && Number(comp.entryFeeAmount || 0) > 0;

  function approveTeam(teamId) {
    const c = NexusData.getCompetitionById(id);
    if (!c) return;
    if (NexusData.isCompEnded && NexusData.isCompEnded(c)) { showToast('Competition has ended — team approvals are locked.', 'error'); return; }
    const by = (session && session.username) || 'organizer';
    if (NexusData.setTeamRegistrationStatus) NexusData.setTeamRegistrationStatus(id, teamId, 'approved', by);
    else { const t = c.teams.find((x) => x.id === teamId); if (t) { t.status = 'approved'; NexusData.updateCompetition(c); } }
    setVersion((v) => v + 1);
  }

  function rejectTeam(teamId) {
    const c = NexusData.getCompetitionById(id);
    if (!c) return;
    if (NexusData.isCompEnded && NexusData.isCompEnded(c)) { showToast('Competition has ended — team approvals are locked.', 'error'); return; }
    const by = (session && session.username) || 'organizer';
    if (NexusData.setTeamRegistrationStatus) NexusData.setTeamRegistrationStatus(id, teamId, 'rejected', by);
    else { const t = c.teams.find((x) => x.id === teamId); if (t) { t.status = 'rejected'; NexusData.updateCompetition(c); } }
    setVersion((v) => v + 1);
  }

  function submitAddOrganizer() {
    const org = newOrg.trim().replace(/^@/, '');
    if (!org) { showToast('Please enter an organizer username or ID.', 'error'); return; }
    if (NexusData && NexusData.addCoOrganizer) {
      const res = NexusData.addCoOrganizer(comp.id, org);
      if (!res.ok) { showToast(res.error || 'Unable to add organizer.', 'error'); return; }
    }
 // Best-effort sync against the :3000 endpoint.
    try {
      fetch(`http://localhost:3000/competitions/${comp.id}/organizers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'team_lead' },
        body: JSON.stringify({ organizerId: org }),
      }).catch(() => {});
    } catch (e) { /* ignore */ }
    setNewOrg('');
    setVersion((v) => v + 1);
    showToast(`Co-Organizer @${org} added successfully to this tournament!`);
  }

  function submitRemoveOrganizer(orgId) {
    if (NexusData && NexusData.removeCoOrganizer) {
      const res = NexusData.removeCoOrganizer(comp.id, orgId);
      if (!res.ok) { showToast(res.error || 'Unable to remove organizer.', 'error'); return; }
    }
    try {
      fetch(`http://localhost:3000/competitions/${comp.id}/organizers/${orgId}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'team_lead' },
      }).catch(() => {});
    } catch (e) { /* ignore */ }
    setVersion((v) => v + 1);
    showToast(`Co-Organizer @${orgId} removed from this tournament.`);
  }

 // Match pagination slice
  const matchSlice = matches.slice(matchPage * LIMIT, matchPage * LIMIT + LIMIT);
  const creator = comp.createdBy || comp.organizerId || 'Primary Organizer';
  const orgs = Array.isArray(comp.organizers) && comp.organizers.length > 0
    ? Array.from(new Set([creator, ...comp.organizers]))
    : [creator];

 // Bracket rounds
  const bracketRounds = {};
  matches.forEach((m) => {
    const key = comp.type === 'league' ? (m.round || 'Group Stage') : m.round;
    if (!bracketRounds[key]) bracketRounds[key] = [];
    bracketRounds[key].push(m);
  });
  const sortedRoundKeys = Object.keys(bracketRounds).sort((a, b) => roundPriority(a, comp.type !== 'league') - roundPriority(b, comp.type !== 'league') || a.localeCompare(b));

  function bannedName(name) {
    const isBanned = NexusData && NexusData.isTeamBannedInComp && NexusData.isTeamBannedInComp(name, comp);
    if (!isBanned) return name;
    return (<><del style={{ color: '#ef4444' }}>{name}</del> <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 700 }}>(BANNED)</span></>);
  }

  return (
    <>
      <main className="comp-main" id="comp-main">
        <div className="comp-hero" id="comp-hero" style={heroStyle}>
          <div className="comp-hero-content">
            <div className="comp-hero-tags" id="comp-hero-tags">
              <span className="hero-tag hero-tag-status" style={{ color: STATUS_COLORS[comp.status] || '#c6ff33' }}>{(STATUS_LABELS[comp.status] || String(comp.status).toUpperCase())}</span>
              <span className="hero-tag-sep">•</span>
              <span className="hero-tag hero-tag-game">{String(comp.game).toUpperCase()}</span>
            </div>
            <h1 className="comp-hero-title" id="comp-hero-title">{comp.name}</h1>
            <div className="comp-hero-meta" id="comp-hero-meta">
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="2" width="14" height="13" rx="2" /><line x1="1" y1="6" x2="15" y2="6" /><line x1="5" y1="1" x2="5" y2="3" /><line x1="11" y1="1" x2="11" y2="3" /></svg>
                {comp.dates}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z" /><circle cx="8" cy="6" r="1.5" /></svg>
                {comp.location}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /><path d="M2 15c0-3 2.7-5 6-5s6 2 6 5" /></svg>
                {comp.participants} Participants
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4.5 1h7l-1 5a3.5 3.5 0 0 1-5 0L4.5 1z" /><path d="M2 1h2.5m9 0H14" /><path d="M8 9v5m-2 0h4" /></svg>
                {formatPrizePool(comp.prizePool)}
              </span>
              <span className="hero-meta-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" /></svg>
                {comp.season}
              </span>
            </div>
          </div>

          <div className="comp-hero-actions" id="comp-hero-actions">
            {hasEntryFee && (
              <Link to={`/pages/organizer-revenue.html?id=${comp.id}`} className="hero-btn hero-btn-secondary" style={{ borderColor: 'rgba(96,165,250,0.45)', color: '#bfdbfe' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 9v6M18 9v6" /></svg>
                TRANSACTIONS
              </Link>
            )}
            {isEnded ? (
              <>
                <Link to={`/pages/comp-standings.html?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                  VIEW STANDINGS
                </Link>
                <span className="hero-btn" style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c', cursor: 'default', pointerEvents: 'none' }}>
                  🏁 COMPETITION ENDED
                </span>
              </>
            ) : (
              <>
                <Link to={`/pages/comp-manage-teams.html?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
                  MANAGE TEAMS
                </Link>
                <Link to={`/pages/comp-manage-matches.html?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  MANAGE MATCHES
                </Link>
                <Link to={`/pages/comp-standings.html?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                  VIEW STANDINGS
                </Link>
                <Link to={`/pages/comp-manage-organizers.html?id=${comp.id}`} className="hero-btn hero-btn-secondary" style={{ borderColor: 'rgba(198,255,51,0.4)', color: '#c6ff33', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  + ADD / MANAGE ORGANIZERS ({organizerCount})
                </Link>
                <Link to={`/pages/comp-dispute-review.html?id=${comp.id}`} className="hero-btn hero-btn-secondary" style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  DISPUTES ({pendingDisputesCount})
                </Link>
                <Link to={`/pages/edit-competition.html?id=${comp.id}`} className="hero-btn hero-btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  EDIT COMPETITION
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="comp-stats-row" id="comp-stats-row">
          <div className="stat-card"><span className="stat-label">{comp.type === 'tournament' ? 'TOURNAMENT' : 'LEAGUE'}</span><span className="stat-val">{comp.name}</span></div>
          <div className="stat-card"><span className="stat-label">TITLE</span><span className="stat-val"><span className="stat-game-icon">🎮</span> {comp.game}</span></div>
          <div className="stat-card"><span className="stat-label">MATCHES</span><span className="stat-val stat-accent">{comp.totalMatches}</span></div>
          <div className="stat-card"><span className="stat-label">TEAMS</span><span className="stat-val stat-accent">{approvedCount} / {comp.maxTeams || 16}</span></div>
          <div className="stat-card stat-card-highlight"><span className="stat-label">STATUS</span><span className="stat-val stat-accent">{String(comp.status).toUpperCase()}</span></div>
        </div>

        <div className="comp-body">
          <div className="comp-panel">
            <div className="comp-panel-header">
              <div className="comp-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
                <span>Registered Teams</span>
              </div>
              <span className="comp-panel-count" id="teams-count-label">Showing all {teams.length} teams ({approvedCount} approved)</span>
            </div>
            <div className="comp-teams-table" id="comp-teams-table">
              {teams.length === 0 ? (
                <div className="empty-state">No teams registered yet.</div>
              ) : (
                <div className="teams-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {teams.map((t) => {
                    const statusMap = { approved: 'APPROVED', pending: 'PENDING', rejected: 'REJECTED' };
                    const statusCls = { approved: 'status-approved', pending: 'status-pending', rejected: 'status-rejected' };
                    const canManage = comp.role === 'organizer' && t.status === 'pending';
                    return (
                      <div className="team-row" key={t.id || t.name}>
                        <div className="team-avatar" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pages/team/team-roster.html?compId=${comp.id}&teamId=${t.id}`)}>{renderTeamAvatar(t.avatar, t.name)}</div>
                        <div className="team-info" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pages/team/team-roster.html?compId=${comp.id}&teamId=${t.id}`)}>
                          <span className="team-name">{t.name}</span>
                          <span className="team-players">{t.players || 0} Players</span>
                        </div>
                        <span className={`team-status ${statusCls[t.status] || ''}`}>{statusMap[t.status] || String(t.status).toUpperCase()}</span>
                        <div className="team-actions">
                          {canManage && (
                            <>
                              <button className="act-btn act-btn-approve" onClick={() => approveTeam(t.id)}>Approve</button>
                              <button className="act-btn act-btn-reject" onClick={() => rejectTeam(t.id)}>Reject</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Link className="comp-view-all" id="link-manage-teams" to={`/pages/comp-manage-teams.html?id=${comp.id}`}>View All Registered Teams →</Link>
          </div>

          <div className="comp-panel">
            <div className="comp-panel-header">
              <div className="comp-panel-title-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <span>Match Schedule</span>
              </div>
              <div className="comp-panel-nav">
                <button className="comp-nav-btn" id="match-prev" disabled={matchPage === 0} onClick={() => { if (matchPage > 0) setMatchPage((p) => p - 1); }}>‹</button>
                <button className="comp-nav-btn" id="match-next" disabled={(matchPage + 1) * LIMIT >= matches.length} onClick={() => { if ((matchPage + 1) * LIMIT < matches.length) setMatchPage((p) => p + 1); }}>›</button>
              </div>
            </div>
            <div className="comp-matches-list" id="comp-matches-list">
              {matches.length === 0 ? (
                <div className="empty-state">No matches scheduled yet.</div>
              ) : (
                matchSlice.map((m) => {
                  const isLive = m.status === 'live';
                  const isComp = m.status === 'completed';
                  return (
                    <div className={`match-item ${isLive ? 'match-item-live' : ''}`} key={m.id || `${m.round}-${m.team1}-${m.team2}`}>
                      <div className="match-round">{m.round} {isLive && <span className="live-tag">LIVE</span>}</div>
                      <div className="match-teams-row">
                        {isComp ? (
                          <>
                            <span className="match-team">{m.team1}</span>
                            <span className="match-score">{m.score1} – {m.score2}</span>
                            <span className="match-team">{m.team2}</span>
                          </>
                        ) : (
                          <>
                            <span className="match-team">{m.team1}</span>
                            <span className="match-vs">VS</span>
                            <span className="match-team">{m.team2}</span>
                          </>
                        )}
                      </div>
                      <div className="match-meta">{m.date} · {m.time}</div>
                      {isLive && <Link to={`/pages/comp-match-results.html?id=${comp.id}`} className="match-result-btn">MATCH RESULTS</Link>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="comp-bracket-section" id="comp-bracket-section" style={{ display: matches.length ? 'block' : 'none' }}>
          <div className="comp-panel-header">
            <div className="comp-panel-title-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="6" height="4" rx="1" /><rect x="15" y="3" width="6" height="4" rx="1" /><rect x="9" y="10" width="6" height="4" rx="1" /><rect x="9" y="17" width="6" height="4" rx="1" /><line x1="6" y1="7" x2="6" y2="12" /><line x1="18" y1="7" x2="18" y2="12" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="12" y1="12" x2="12" y2="14" /><line x1="12" y1="21" x2="12" y2="24" /></svg>
              <span id="bracket-section-title">{comp.type === 'league' ? 'League Bracket' : 'Tournament Bracket'}</span>
            </div>
          </div>
          <div className="comp-bracket-info" id="comp-bracket-info">
            {matches.length === 0 ? (
              <p style={{ color: '#9aa4b2', fontSize: 14 }}>No matches scheduled yet.</p>
            ) : (
              <div className="bracket-grid">
                {sortedRoundKeys.map((round) => (
                  <div className="bracket-round" key={round}>
                    <div className="bracket-round-label">{round}</div>
                    {bracketRounds[round].map((m) => {
                      const isComp = m.status === 'completed';
                      const isLive = m.status === 'live';
                      return (
                        <div className={`bracket-match ${isLive && comp.type === 'league' ? 'bracket-match-live' : ''}`} key={m.id || `${round}-${m.team1}-${m.team2}`}>
                          <div className={`bracket-team ${isComp && m.score1 > m.score2 ? 'bracket-winner' : ''}`}>
                            <span>{bannedName(m.team1)}</span>{isComp && <span>{m.score1}</span>}
                          </div>
                          <div className={`bracket-team ${isComp && m.score2 > m.score1 ? 'bracket-winner' : ''}`}>
                            <span>{bannedName(m.team2)}</span>{isComp && <span>{m.score2}</span>}
                          </div>
                          {isLive && comp.type === 'league' && (
                            <span style={{ background: '#c6ff33', color: '#000', fontSize: 9, padding: '1px 6px', borderRadius: 999, fontWeight: 800, marginLeft: 6 }}>LIVE</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {modalOpen && (
          <div id="organizers-modal" className="custom-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#131b24', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 26, maxWidth: 500, width: '90%', boxShadow: '0 12px 36px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ color: '#fff', margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><span>👥</span> Tournament Organizers</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 0' }}>Add and manage co-organizers for this tournament.</p>
                </div>
                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9aa4b2', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add Co-Organizer</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>@</span>
                    <input type="text" id="modal-new-organizer" className="form-input" placeholder="Enter username or User ID" value={newOrg} onChange={(e) => setNewOrg(e.target.value)} style={{ paddingLeft: 28, width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, paddingTop: 8, paddingBottom: 8 }} />
                  </div>
                  <button className="btn-table-primary" onClick={submitAddOrganizer} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, background: '#c6ff33', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer' }}>+ Add</button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Organizers</label>
                <div id="modal-organizers-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {orgs.map((org) => {
                    const isOwner = org === creator;
                    return (
                      <div key={org} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>👤</span>
                          <div>
                            <div style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>@{org}</div>
                            <div style={{ fontSize: 11, color: isOwner ? '#c6ff33' : 'var(--text-muted)', fontWeight: isOwner ? 700 : 400 }}>
                              {isOwner ? 'Primary Creator / Owner' : 'Co-Organizer'}
                            </div>
                          </div>
                        </div>
                        {!isOwner ? (
                          <button type="button" onClick={() => submitRemoveOrganizer(org)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Protected</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 20, textAlign: 'right' }}>
                <button className="btn-table-secondary" onClick={() => setModalOpen(false)} style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8 }}>Done</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}


