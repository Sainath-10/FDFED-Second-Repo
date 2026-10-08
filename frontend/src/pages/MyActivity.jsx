/**
 * NEXUS ESPORTS — My Activity
 *
 * organized / participated /
 * team-lead competition buckets built from live data, with the per-role card
 * click behaviour, search filtering and a background API refresh.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/my-activity.css';

const normalize = (v) => String(v || '').trim().toLowerCase();

const ICONS = {
  calendar: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.33" strokeLinecap="round"><rect x="1" y="2" width="14" height="13" rx="2" /><line x1="1" y1="6" x2="15" y2="6" /><line x1="5" y1="1" x2="5" y2="3" /><line x1="11" y1="1" x2="11" y2="3" /></svg>),
  user: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.33" strokeLinecap="round"><path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /><path d="M2 15c0-3 2.7-5 6-5s6 2 6 5" /></svg>),
  pin: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.33" strokeLinecap="round"><path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z" /><circle cx="8" cy="6" r="1.5" /></svg>),
  trophy: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round"><path d="M4.5 1h7l-1 5a3.5 3.5 0 0 1-5 0L4.5 1z" /><path d="M2 1h2.5m9 0H14" /><path d="M8 9v5m-2 0h4" /></svg>),
};

function formatPrizePool(prize) {
  if (!prize || ['—', '-', '₹0'].includes(prize) || String(prize).toLowerCase().includes('no prize')) return 'No Prize Pool';
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

const badgeClass = (s) => ({ ongoing: 'act-badge-ongoing', completed: 'act-badge-completed', upcoming: 'act-badge-upcoming' }[s] || 'act-badge-ongoing');
const statusLabel = (s) => ({ ongoing: 'Ongoing', completed: 'Completed', upcoming: 'Upcoming' }[s] || s);
const teamRegClass = (s) => ({ pending: 'act-badge-upcoming', approved: 'act-badge-ongoing', rejected: 'act-badge-completed' }[s] || 'act-badge-upcoming');
const teamRegLabel = (s) => ({ pending: 'Team Pending', approved: 'Team Approved', rejected: 'Team Rejected' }[s] || 'Team Pending');

function ensureTeamShape(team, comp) {
  const safeTeam = { ...(team || {}) };
  safeTeam.members = Array.isArray(safeTeam.members) ? safeTeam.members : [];
  if (safeTeam.members.length === 0 && safeTeam.createdBy) {
    safeTeam.members = [{ username: safeTeam.createdBy, displayName: safeTeam.leader || safeTeam.createdBy, role: 'captain' }];
  }
  safeTeam.players = safeTeam.members.length || safeTeam.players || 0;
  safeTeam.competitionId = comp.id;
  return safeTeam;
}

function dedupeById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const id = String((item && item.id) || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildBuckets(allComps, session) {
  const userKey = normalize(session && session.username);
  const organized = [];
  const participated = [];
  const teamled = [];

  (allComps || []).forEach((comp) => {
    const teams = Array.isArray(comp.teams) ? comp.teams.map((team) => ensureTeamShape(team, comp)) : [];

    if (userKey) {
      const isCoOrganizer = Array.isArray(comp.organizers) && comp.organizers.map(normalize).includes(userKey);
      const isOwner = isCoOrganizer || normalize(comp.organizerId) === userKey || normalize(comp.createdBy) === userKey;
      if (isOwner) {
        const approvalStatus = (NexusData && NexusData.getApprovalStatus) ? NexusData.getApprovalStatus(comp) : 'approved';
        if (approvalStatus !== 'rejected') organized.push({ ...comp, role: 'organizer', approvalStatus });
      }

      const myTeam = teams.find((team) => normalize(team.createdBy || team.leaderUsername) === userKey);
      if (myTeam) {
        const teamStatus = normalize(myTeam.status || 'approved');
        if (teamStatus !== 'rejected') {
          teamled.push({ ...comp, role: 'teamlead', userCreated: true, members: myTeam.players, participants: myTeam.players, teamStatus, teamContext: { compId: comp.id, teamId: myTeam.id, teamName: myTeam.name } });
        }
      }

      const joinedTeam = teams.find((team) => {
        if (normalize(team.createdBy || team.leaderUsername) === userKey) return false;
        return (team.members || []).some((member) => normalize(member.username) === userKey);
      });
      if (joinedTeam) {
        participated.push({ ...comp, role: 'participant', teamJoined: joinedTeam.name, teamContext: { compId: comp.id, teamId: joinedTeam.id, teamName: joinedTeam.name } });
      }
      return;
    }

    if (comp.role === 'organizer') organized.push({ ...comp });
    if (comp.role === 'participant') participated.push({ ...comp });
    if (comp.role === 'teamlead') teamled.push({ ...comp });
  });

  return { organized: dedupeById(organized), participated: dedupeById(participated), teamled: dedupeById(teamled) };
}

export default function MyActivity() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!NexusData || typeof NexusData.fetchCompetitionsFromAPI !== 'function') return undefined;
    let cancelled = false;
    Promise.race([NexusData.fetchCompetitionsFromAPI(), new Promise((resolve) => setTimeout(resolve, 2000))])
      .then(() => { if (!cancelled) setVersion((v) => v + 1); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const buckets = useMemo(() => {
    const allComps = NexusData ? NexusData.loadCompetitions() : [];
    return buildBuckets(allComps, session);
  }, [session, version]);

  function openComp(comp) {
    if (comp.role === 'participant') { navigate(`/pages/comp-participant.html?id=${encodeURIComponent(comp.id)}`); return; }
    if (comp.role === 'teamlead') {
      const status = normalize(comp.teamStatus || 'approved');
      if (status !== 'approved') { showToast(`Your team registration is ${status}. Access is available after organiser approval.`, 'error'); return; }
      if (comp.teamContext && comp.teamContext.teamId) {
        navigate(`/pages/team/team-roster.html?compId=${encodeURIComponent(comp.teamContext.compId)}&teamId=${encodeURIComponent(comp.teamContext.teamId)}`);
      } else {
        navigate(`/pages/team/team-roster.html?teamId=${encodeURIComponent(comp.id)}`);
      }
      return;
    }
    navigate(`/pages/competition-detail.html?id=${encodeURIComponent(comp.id)}`);
  }

  function renderCard(comp, i, arr) {
    const typeClass = comp.type === 'league' ? 'act-badge-league' : 'act-badge-tournament';
    const typeLabel = comp.type === 'league' ? 'League' : 'Tournament';
    const participantValue = comp.participants || comp.members || 0;
    const participantLabel = comp.userCreated ? 'members' : 'participants';
    const wide = i === arr.length - 1 && arr.length % 2 !== 0 ? ' act-comp-card--wide' : '';
    const disabled = comp.role === 'teamlead' && normalize(comp.teamStatus || 'approved') !== 'approved';

    return (
      <div
        className={`act-comp-card${wide}`}
        key={comp.id}
        data-id={comp.id}
        data-name={String(comp.name || '').toLowerCase()}
        data-game={String(comp.game || '').toLowerCase()}
        onClick={() => openComp(comp)}
        style={disabled ? { cursor: 'not-allowed', opacity: 0.9 } : undefined}
      >
        <div className="act-card-top">
          <div className="act-card-meta">
            <p className="act-card-game">{comp.game || 'Unknown Game'}</p>
            <h3 className="act-card-title">{comp.name || 'Unnamed Competition'}</h3>
          </div>
          <div className="act-card-badges">
            <span className={`act-badge ${typeClass}`}>{typeLabel}</span>
            <span className={`act-badge ${badgeClass(comp.status)}`}>{statusLabel(comp.status)}</span>
            {comp.role === 'organizer' && (comp.approvalStatus === 'pending'
              ? <span className="act-badge" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid #fb923c', color: '#fb923c' }}>⏳ Pending Admin Approval</span>
              : <span className="act-badge act-approved">Approved (Live)</span>)}
            {comp.role === 'teamlead' && <span className={`act-badge ${teamRegClass(comp.teamStatus || 'pending')}`}>{teamRegLabel(comp.teamStatus || 'pending')}</span>}
            {comp.userCreated && <span className="act-badge" style={{ background: 'rgba(198,255,51,0.12)', border: '1px solid rgba(198,255,51,0.35)', color: '#c6ff33' }}>My Team</span>}
            {comp.teamJoined && comp.role === 'participant' && <span className="act-badge" style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', color: '#60a5fa' }}>{comp.teamJoined}</span>}
          </div>
        </div>
        <div className="act-card-details">
          <div className="act-detail-row">{ICONS.calendar}<span>{comp.dates || 'TBD'}</span></div>
          <div className="act-detail-row">{ICONS.user}<span>{participantValue} {participantLabel}</span></div>
          <div className="act-detail-row">{ICONS.pin}<span>{comp.location || 'Online'}</span></div>
        </div>
        <div className="act-card-footer">
          {ICONS.trophy}
          <span className="act-prize">{formatPrizePool(comp.prizePool || comp.prize)}</span>
        </div>
      </div>
    );
  }

  const q = query.toLowerCase().trim();
  const filterCards = (comps) => (q ? comps.filter((c) => String(c.name || '').toLowerCase().includes(q) || String(c.game || '').toLowerCase().includes(q)) : comps);

  const SECTIONS = [
    { gridId: 'organized-grid', countId: 'organized-count', title: 'Competitions Organized', noun: 'competition', comps: filterCards(buckets.organized) },
    { gridId: 'participated-grid', countId: 'participated-count', title: 'Competitions Participated', noun: 'tournament', comps: filterCards(buckets.participated) },
    { gridId: 'teamlead-grid', countId: 'teamlead-count', title: 'Competitions as Team Lead', noun: 'tournament', comps: filterCards(buckets.teamled) },
  ];

  return (
    <main className="activity-main">
      <div className="act-page-header">
        <div className="act-header-row">
          <div>
            <h1 className="act-page-title">Your Activity</h1>
            <p className="act-page-subtitle">Track all your competitions and tournaments.</p>
          </div>
          <Link to="/pages/create-competition.html" className="btn-create" id="btn-create-comp">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="2" x2="8" y2="14" /><line x1="2" y1="8" x2="14" y2="8" /></svg>
            Create Competition
          </Link>
        </div>
      </div>

      <div className="act-search-wrapper">
        <svg className="act-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="6" /><line x1="14" y1="14" x2="18" y2="18" />
        </svg>
        <input type="text" className="act-search-input" placeholder="Search competitions by name, game, or location..." id="act-search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {SECTIONS.map((s) => (
        <section className="act-section" key={s.gridId}>
          <div className="act-section-heading">
            <div className="act-section-icon">
              {s.gridId === 'organized-grid' && (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2h15l-2 9a5.5 5.5 0 0 1-11 0L4.5 2z" /><path d="M2.5 2h2m17 0h2" /><path d="M12 18v3m-4 0h8" /></svg>)}
              {s.gridId === 'participated-grid' && (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>)}
              {s.gridId === 'teamlead-grid' && (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>)}
            </div>
            <div>
              <h2 className="act-section-title">{s.title}</h2>
              <p className="act-section-count" id={s.countId}>{s.comps.length} {s.noun}{s.comps.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="act-comp-grid" id={s.gridId}>
            {s.comps.length === 0 ? (
              <p className="act-empty">No {s.noun}s yet.</p>
            ) : (
              s.comps.map((comp, i) => renderCard(comp, i, s.comps))
            )}
          </div>
        </section>
      ))}
    </main>
  );
}


