/**
 * NEXUS ESPORTS — Join Teams
 *
 * the competition
 * context header, the create-team CTA (context-aware), the approved-team list with
 * per-team join states (Your Team / Team Full / In Another Team / Requested /
 * Request to Join), the pending-requests section, the per-player checkout modal,
 * ?teamId= direct-join, and the ended-competition lock.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/join-teams.css';

function renderTeamAvatar(avatar, name) {
  const fallback = name ? String(name).slice(0, 4).toUpperCase() : 'TEAM';
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

export default function JoinTeams() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const id = params.get('id') || params.get('compId') || null;
  const preferredTeamId = params.get('teamId');

  const [version, setVersion] = useState(0);
  const [checkout, setCheckout] = useState(null); // { comp, feeAmount }
  const listRef = useRef(null);

  const comp = useMemo(
    () => (id && NexusData ? NexusData.getCompetitionById(id) : null),
    [id, version],
  );

 // Rejected competitions are archived.
  useEffect(() => {
    if (!comp) return;
    const status = NexusData.getApprovalStatus ? NexusData.getApprovalStatus(comp) : 'approved';
    if (status === 'rejected') {
      showToast('This competition has been archived.', 'error');
      navigate('/pages/competitions.html');
    }
  }, [comp, navigate]);

 // Ended-competition lock (with cleanup).
  useEffect(() => {
    if (comp && NexusData.enforceNotEnded) {
      NexusData.enforceNotEnded(comp, '.btn-join,.create-team-cta,button[onclick*="handleJoin"],.btn-request');
    }
    return () => {
      const banner = document.getElementById('_ended_banner_');
      if (banner) banner.remove();
      document.body.style.marginTop = '';
    };
  }, [comp]);

  useEffect(() => {
    if (!comp) showToast('Competition context missing.', 'error');
  }, [comp]);

  function proceedJoinTeam(teamId) {
    const current = NexusData.getCompetitionById(comp.id);
    const result = NexusTeamWorkflow.submitJoinRequest({ compId: current.id, teamId });
    if (!result.ok) { showToast(result.error || 'Request failed.', 'error'); return; }
    showToast('Join request sent successfully!');
    setVersion((v) => v + 1);
  }

  function handleJoin(teamId) {
    if (!session) { navigate('/pages/login.html'); return; }
    if (!comp || !NexusTeamWorkflow || typeof NexusTeamWorkflow.submitJoinRequest !== 'function') {
      showToast('Unable to send request right now.', 'error');
      return;
    }
    const feeType = comp.feeType || 'free';
    const entryFeeAmount = comp.entryFeeAmount || 0;
    if (feeType === 'per_player' && entryFeeAmount > 0) {
      setCheckout({ comp, feeAmount: entryFeeAmount, pendingTeamId: teamId });
    } else {
      proceedJoinTeam(teamId);
    }
  }

 // ?teamId= — direct join (once, when a comp is available).
  const directJoinAttempted = useRef(false);
  useEffect(() => {
    if (directJoinAttempted.current || !comp || !preferredTeamId) return;
    directJoinAttempted.current = true;
    if (!session || !NexusTeamWorkflow || typeof NexusTeamWorkflow.directJoinTeam !== 'function') return;
    const result = NexusTeamWorkflow.directJoinTeam({ compId: comp.id, teamId: preferredTeamId });
    if (!result.ok) { showToast(result.error || 'Unable to join team.', 'error'); return; }
    showToast(`You have joined ${result.team && result.team.name ? result.team.name : 'the team'}.`);
    const compKey = (result.competition && result.competition.id) || comp.id;
    const teamKey = (result.team && result.team.id) || preferredTeamId;
    const isCaptain = result.team && result.team.createdBy && result.team.createdBy.toLowerCase() === session.username.toLowerCase();
    navigate(isCaptain
      ? `/pages/team/team-roster.html?compId=${encodeURIComponent(compKey)}&teamId=${encodeURIComponent(teamKey)}`
      : `/pages/comp-participant.html?id=${encodeURIComponent(compKey)}`);
  }, [comp, preferredTeamId, session, navigate]);

 // Highlight the preferred team card after render.
  useEffect(() => {
    if (!comp || !preferredTeamId || !listRef.current) return;
    const card = listRef.current.querySelector(`.request-card[data-team-id="${preferredTeamId}"]`);
    if (card) {
      card.classList.add('request-card-highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [comp, preferredTeamId, version]);

  if (!comp) {
    return <main className="join-page"><a href="/pages/comp-info.html" className="back-btn" onClick={(e) => { e.preventDefault(); navigate('/pages/competitions.html'); }}>Back to Competition</a></main>;
  }

  const userKey = session ? (session.username || '').toLowerCase() : '';
  const myTeam = (NexusTeamWorkflow && session && typeof NexusTeamWorkflow.findUserTeamInCompetition === 'function')
    ? NexusTeamWorkflow.findUserTeamInCompetition(comp.id, session.username)
    : null;
  const myTeamId = myTeam && myTeam.team ? myTeam.team.id : null;
  const maxPerTeam = comp.maxPlayersPerTeam || 5;
  const teamsToShow = (comp.teams || []).filter((t) => t.status === 'approved');

  const createHref = (() => {
    if (!session) return '/pages/login.html';
    if (myTeam && myTeam.context) {
      return `/pages/team/team-roster.html?compId=${encodeURIComponent(myTeam.context.compId)}&teamId=${encodeURIComponent(myTeam.context.teamId)}`;
    }
    return `/pages/create-team.html?id=${encodeURIComponent(comp.id)}`;
  })();
  const createLabel = myTeam && myTeam.context ? 'View My Team' : 'Create Team';

  const mine = [];
  (comp.teams || []).forEach((team) => {
    (team.joinRequests || []).forEach((req) => {
      if ((req.username || '').toLowerCase() === userKey && req.status === 'pending') {
        mine.push({ teamName: team.name, teamAvatar: team.avatar, request: req });
      }
    });
  });

  return (
    <main className="join-page">
      <Link to={`/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`} className="back-btn">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 8H4M4 8L8 12M4 8L8 4" />
        </svg>
        Back to Competition
      </Link>

      <div className="comp-context">
        <svg viewBox="0 0 24 24" fill="none" stroke="#c6ff33" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18m-6-2v2m0 14v-2M9 9h6m-6 6h6M5 9v6a7 7 0 0 0 14 0V9" />
        </svg>
        <div>
          <div className="comp-name" id="comp-context-name">{comp.name} - {comp.game}</div>
          <div className="comp-sub">Select a team to join or create a new team for this tournament</div>
        </div>
      </div>

      <div className="join-header-row">
        <div>
          <h1>Request to Join &amp; Play</h1>
          <p>Browse open teams looking for players, or create your own squad.</p>
        </div>
        <Link to={createHref} className="create-team-cta">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="7" y1="1" x2="7" y2="13" />
            <line x1="1" y1="7" x2="13" y2="7" />
          </svg>
          {createLabel}
        </Link>
      </div>

      <div className="section-label" style={{ marginTop: 20 }}>Open Teams Looking for Players</div>

      <div id="team-list" ref={listRef}>
        {teamsToShow.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ color: '#94A3B8', fontSize: 16 }}>No teams are currently registered in this tournament.</p>
            <p style={{ color: '#64748B', fontSize: 14, marginTop: 8 }}>Be the first to create one.</p>
          </div>
        ) : (
          teamsToShow.map((team) => {
            const members = Array.isArray(team.members) ? team.members.length : (team.players || 0);
            const openSlots = Math.max(0, maxPerTeam - members);
            const isFull = members >= maxPerTeam;
            const isCaptain = userKey && (team.createdBy || '').toLowerCase() === userKey;
            const hasPending = userKey && (team.joinRequests || []).some((req) => (req.username || '').toLowerCase() === userKey && req.status === 'pending');
            const userInAnotherTeam = !!myTeamId && team.id !== myTeamId;

            let joinBtn;
            if (isCaptain) joinBtn = <button className="btn-join" disabled>Your Team</button>;
            else if (isFull) joinBtn = <button className="btn-join team-full-btn" disabled>Team Full</button>;
            else if (userInAnotherTeam) joinBtn = <button className="btn-join" disabled>In Another Team</button>;
            else if (hasPending) joinBtn = <button className="btn-join" disabled>Requested</button>;
            else joinBtn = <button className="btn-join" onClick={() => handleJoin(team.id)}>Request to Join</button>;

            return (
              <div className="request-card" data-name={team.name} data-team-id={team.id} key={team.id || team.name}>
                <div className="request-card-left">
                  <div className="team-icon">{renderTeamAvatar(team.avatar, team.name)}</div>
                  <div>
                    <div className="team-name">{team.name}</div>
                    <div className="team-info">
                      {members}/{maxPerTeam} Players filled
                      {isFull ? <span className="slots-full">0 slots open</span> : <span>{openSlots} slot{openSlots !== 1 ? 's' : ''} open</span>}
                    </div>
                    <div className="wanted-roles">
                      <span>Team Tag:</span>
                      <span className="role-badge">{team.tag || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="request-card-actions">
                  <button className="btn-view-team" onClick={() => navigate(`/pages/team/team-roster.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`)}>View Team</button>
                  {joinBtn}
                </div>
              </div>
            );
          })
        )}
      </div>

      {mine.length > 0 && (
        <div className="pending-requests-section">
          <div className="pending-header">
            <svg className="clock-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>PENDING REQUESTS</span>
            <span className="pending-badge">{mine.length}</span>
          </div>
          <div className="pending-list">
            {mine.map((entry) => (
              <div className="pending-card" key={entry.request.id || entry.teamName}>
                <div className="pending-content">
                  <div className="team-icon">{renderTeamAvatar(entry.teamAvatar, entry.teamName)}</div>
                  <div className="pending-info">
                    <div className="pending-team-name">{entry.teamName}</div>
                    <div className="pending-time">Sent {entry.request.requestedAt ? new Date(entry.request.requestedAt).toLocaleString() : 'just now'}</div>
                  </div>
                </div>
                <button className="btn-cancel-request" disabled>Pending</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkout && (
        <div id="player-checkout-modal" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f172a', border: '1px solid #60a5fa', borderRadius: 16, width: 'min(90vw,460px)', padding: 32, boxShadow: '0 20px 60px #000a', color: '#f1f5f9' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 20, color: '#f1f5f9' }}>👤 Player Participation Fee</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>Player Entry Fee for "{checkout.comp.name}".</p>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#cbd5e1' }}>
                <span>Participation Fee Model:</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Per Player (Individual Entry)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#f1f5f9', borderTop: '1px dashed rgba(96,165,250,0.3)', paddingTop: 10, marginTop: 2 }}>
                <strong>Total Player Entry Fee:</strong>
                <strong style={{ color: '#60a5fa', fontSize: 20 }}>₹{checkout.feeAmount.toLocaleString('en-IN')}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setCheckout(null)} style={{ flex: 1, padding: 12, background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button
                onClick={() => {
                  const pendingTeam = checkout.pendingTeamId;
                  setCheckout(null);
                  proceedJoinTeam(pendingTeam);
                }}
                style={{ flex: 2, padding: 12, background: '#60a5fa', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                ✔ Pay ₹{checkout.feeAmount.toLocaleString('en-IN')} &amp; Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


