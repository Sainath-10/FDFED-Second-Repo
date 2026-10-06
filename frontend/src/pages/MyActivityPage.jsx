import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { NexusData } from '../services/competitionService';
import { NexusAuth } from '../services/authService';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/my-activity.css';

const ICONS = {
  calendar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.33" strokeLinecap="round">
      <rect x="1" y="2" width="14" height="13" rx="2" />
      <line x1="1" y1="6" x2="15" y2="6" />
      <line x1="5" y1="1" x2="5" y2="3" />
      <line x1="11" y1="1" x2="11" y2="3" />
    </svg>
  ),
  user: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.33" strokeLinecap="round">
      <path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      <path d="M2 15c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  ),
  pin: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.33" strokeLinecap="round">
      <path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z" />
      <circle cx="8" cy="6" r="1.5" />
    </svg>
  ),
  trophy: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round">
      <path d="M4.5 1h7l-1 5a3.5 3.5 0 0 1-5 0L4.5 1z" />
      <path d="M2 1h2.5m9 0H14" />
      <path d="M8 9v5m-2 0h4" />
    </svg>
  )
};

function formatPrizePool(prize) {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) {
    return 'No Prize Pool';
  }
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function badgeClass(status) {
  return { ongoing: 'act-badge-ongoing', completed: 'act-badge-completed', upcoming: 'act-badge-upcoming' }[status] || 'act-badge-ongoing';
}

function statusLabel(status) {
  return { ongoing: 'Ongoing', completed: 'Completed', upcoming: 'Upcoming' }[status] || status;
}

function teamRegClass(status) {
  return {
    pending: 'act-badge-upcoming',
    approved: 'act-badge-ongoing',
    rejected: 'act-badge-completed'
  }[status] || 'act-badge-upcoming';
}

function teamRegLabel(status) {
  return {
    pending: 'Team Pending',
    approved: 'Team Approved',
    rejected: 'Team Rejected'
  }[status] || 'Team Pending';
}

function ensureTeamShape(team, comp) {
  const safeTeam = Object.assign({}, team || {});
  safeTeam.members = Array.isArray(safeTeam.members) ? safeTeam.members : [];

  if (safeTeam.members.length === 0 && safeTeam.createdBy) {
    safeTeam.members = [{
      username: safeTeam.createdBy,
      displayName: safeTeam.leader || safeTeam.createdBy,
      role: 'captain',
      joinedAt: safeTeam.created || new Date().toISOString()
    }];
  }

  safeTeam.players = safeTeam.members.length || safeTeam.players || 0;
  safeTeam.competitionId = comp.id;
  return safeTeam;
}

function dedupeById(items) {
  const seen = new Set();
  return (items || []).filter(item => {
    const id = String(item && item.id || '');
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

  (allComps || []).forEach(comp => {
    const teams = Array.isArray(comp.teams) ? comp.teams.map(team => ensureTeamShape(team, comp)) : [];

    if (userKey) {
      const isCoOrganizer = Array.isArray(comp.organizers) && comp.organizers.map(normalize).includes(userKey);
      const isOwner = isCoOrganizer || (normalize(comp.organizerId) === userKey) || (normalize(comp.createdBy) === userKey) || (normalize(comp.organizerId) && normalize(comp.organizerId) === normalize(session && session.id));
      if (isOwner) {
        const approvalStatus = NexusData && typeof NexusData.getApprovalStatus === 'function'
          ? NexusData.getApprovalStatus(comp)
          : 'approved';
        if (approvalStatus !== 'rejected') {
          organized.push(Object.assign({}, comp, { role: 'organizer', approvalStatus }));
        }
      }

      const myTeam = teams.find(team => normalize(team.createdBy || team.leaderUsername) === userKey);
      if (myTeam) {
        const teamStatus = normalize(myTeam.status || 'approved');
        if (teamStatus !== 'rejected') {
          teamled.push(Object.assign({}, comp, {
            role: 'teamlead',
            userCreated: true,
            members: myTeam.players,
            participants: myTeam.players,
            teamStatus,
            teamContext: {
              compId: comp.id,
              teamId: myTeam.id,
              teamName: myTeam.name
            }
          }));
        }
      }

      const joinedTeam = teams.find(team => {
        if (normalize(team.createdBy || team.leaderUsername) === userKey) return false;
        return (team.members || []).some(member => normalize(member.username) === userKey);
      });

      if (joinedTeam) {
        participated.push(Object.assign({}, comp, {
          role: 'participant',
          teamJoined: joinedTeam.name,
          teamContext: {
            compId: comp.id,
            teamId: joinedTeam.id,
            teamName: joinedTeam.name
          }
        }));
      }

      return;
    }

    if (comp.role === 'organizer') organized.push(Object.assign({}, comp));
    if (comp.role === 'participant') participated.push(Object.assign({}, comp));
    if (comp.role === 'teamlead') teamled.push(Object.assign({}, comp));
  });

  return {
    organized: dedupeById(organized),
    participated: dedupeById(participated),
    teamled: dedupeById(teamled)
  };
}

export default function MyActivityPage() {
  const navigate = useNavigate();
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

  const [searchQuery, setSearchQuery] = useState('');
  const [buckets, setBuckets] = useState({ organized: [], participated: [], teamled: [] });

  const loadData = () => {
    const allComps = NexusData.loadCompetitions ? NexusData.loadCompetitions() : [];
    const b = buildBuckets(allComps, session);
    setBuckets(b);
  };

  useEffect(() => {
    if (!session || !session.username) {
      navigate('/login', { replace: true });
      return;
    }

    loadData();

    if (NexusData && typeof NexusData.fetchCompetitionsFromAPI === 'function') {
      Promise.race([
        NexusData.fetchCompetitionsFromAPI(),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]).then(() => loadData()).catch(() => {});
    }
  }, [session, navigate]);

  if (!session) return null;

  const handleCardClick = (comp) => {
    if (comp.role === 'participant') {
      navigate(`/comp-participant?id=${encodeURIComponent(comp.id)}`);
    } else if (comp.role === 'teamlead') {
      const status = normalize(comp.teamStatus || 'approved');
      if (status !== 'approved') {
        showToast(`Your team registration is ${status}. Access is available after organiser approval.`, 'error');
      } else if (comp.teamContext && comp.teamContext.teamId) {
        navigate(`/team/team-roster?compId=${encodeURIComponent(comp.teamContext.compId)}&teamId=${encodeURIComponent(comp.teamContext.teamId)}`);
      } else {
        navigate(`/team/team-roster?teamId=${encodeURIComponent(comp.id)}`);
      }
    } else {
      navigate(`/competition-detail?id=${encodeURIComponent(comp.id)}`);
    }
  };

  const filterComps = (list) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.game || '').toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q)
    );
  };

  const renderCard = (comp, isWide) => {
    const typeClass = comp.type === 'league' ? 'act-badge-league' : 'act-badge-tournament';
    const typeLabel = comp.type === 'league' ? 'League' : 'Tournament';
    const participantLabel = comp.userCreated ? 'members' : 'participants';
    const participantValue = comp.participants || comp.members || 0;
    const isLeadNotApproved = comp.role === 'teamlead' && normalize(comp.teamStatus || 'approved') !== 'approved';

    return (
      <div
        key={comp.id}
        className={`act-comp-card ${isWide ? 'act-comp-card--wide' : ''}`}
        onClick={() => handleCardClick(comp)}
        style={isLeadNotApproved ? { cursor: 'not-allowed', opacity: 0.9 } : { cursor: 'pointer' }}
      >
        <div className="act-card-top">
          <div className="act-card-meta">
            <p className="act-card-game">{comp.game || 'Unknown Game'}</p>
            <h3 className="act-card-title">{comp.name || 'Unnamed Competition'}</h3>
          </div>
          <div className="act-card-badges">
            <span className={`act-badge ${typeClass}`}>{typeLabel}</span>
            <span className={`act-badge ${badgeClass(comp.status)}`}>{statusLabel(comp.status)}</span>
            {comp.role === 'organizer' && (
              comp.approvalStatus === 'pending' ? (
                <span className="act-badge" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid #fb923c', color: '#fb923c' }}>
                  ⏳ Pending Admin Approval
                </span>
              ) : (
                <span className="act-badge act-approved">Approved (Live)</span>
              )
            )}
            {comp.role === 'teamlead' && (
              <span className={`act-badge ${teamRegClass(comp.teamStatus || 'pending')}`}>
                {teamRegLabel(comp.teamStatus || 'pending')}
              </span>
            )}
            {comp.userCreated && (
              <span className="act-badge" style={{ background: 'rgba(198,255,51,0.12)', border: '1px solid rgba(198,255,51,0.35)', color: '#c6ff33' }}>
                My Team
              </span>
            )}
            {comp.teamJoined && comp.role === 'participant' && (
              <span className="act-badge" style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', color: '#60a5fa' }}>
                {comp.teamJoined}
              </span>
            )}
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
  };

  const renderSectionGrid = (list, noun) => {
    const filtered = filterComps(list);
    if (filtered.length === 0) {
      return <p className="act-empty">No {noun}s yet.</p>;
    }
    return (
      <div className="act-comp-grid">
        {filtered.map((comp, i) => {
          const isLast = i === filtered.length - 1;
          const isOdd = filtered.length % 2 !== 0;
          return renderCard(comp, isLast && isOdd);
        })}
      </div>
    );
  };

  return (
    <Shell activeTab="activity">
      <main className="activity-main">
          <div className="act-page-header">
            <div className="act-header-row">
              <div>
                <h1 className="act-page-title">Your Activity</h1>
                <p className="act-page-subtitle">Track all your competitions and tournaments.</p>
              </div>
              <Link to="/create-competition" className="btn-create" id="btn-create-comp">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="2" x2="8" y2="14" />
                  <line x1="2" y1="8" x2="14" y2="8" />
                </svg>
                Create Competition
              </Link>
            </div>
          </div>

          <div className="act-search-wrapper">
            <svg className="act-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="9" r="6" />
              <line x1="14" y1="14" x2="18" y2="18" />
            </svg>
            <input
              type="text"
              className="act-search-input"
              placeholder="Search competitions by name, game, or location..."
              id="act-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Competitions Organized */}
          <section className="act-section" id="section-organized">
            <div className="act-section-heading">
              <div className="act-section-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 2h15l-2 9a5.5 5.5 0 0 1-11 0L4.5 2z" />
                  <path d="M2.5 2h2m17 0h2" />
                  <path d="M12 18v3m-4 0h8" />
                </svg>
              </div>
              <div>
                <h2 className="act-section-title">Competitions Organized</h2>
                <p className="act-section-count" id="organized-count">
                  {buckets.organized.length} competition{buckets.organized.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {renderSectionGrid(buckets.organized, 'competition')}
          </section>

          {/* Competitions Participated */}
          <section className="act-section" id="section-participated">
            <div className="act-section-heading">
              <div className="act-section-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div>
                <h2 className="act-section-title">Competitions Participated</h2>
                <p className="act-section-count" id="participated-count">
                  {buckets.participated.length} tournament{buckets.participated.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {renderSectionGrid(buckets.participated, 'tournament')}
          </section>

          {/* Competitions as Team Lead */}
          <section className="act-section" id="section-teamlead">
            <div className="act-section-heading">
              <div className="act-section-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6FF33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h2 className="act-section-title">Competitions as Team Lead</h2>
                <p className="act-section-count" id="teamlead-count">
                  {buckets.teamled.length} tournament{buckets.teamled.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {renderSectionGrid(buckets.teamled, 'tournament')}
          </section>
        </main>
    </Shell>
  );
}
