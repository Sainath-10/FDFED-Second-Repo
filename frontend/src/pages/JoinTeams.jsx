/**
 * NEXUS ESPORTS — Join Teams
 *
 * Lists the competition's registered teams from the backend so every player
 * sees the same teams, lets a player request to join one (with the private
 * join code when needed), and shows their own requests — including paying the
 * entry fee once a captain accepts, where each player pays.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ReportsAPI, TeamsAPI } from '../services/api.js';
import { isOrganizerOf, useCompetition } from '../services/competitions.js';
import useJoinCodeGate from '../hooks/useJoinCodeGate.jsx';
import useReportSync from '../hooks/useReportSync.js';
import PlayerFeeModal from '../components/PlayerFeeModal.jsx';
import { EmptyState, ErrorState, LoadingState, Notice, RemovedFromCompetition, formatDate, formatINR } from '../components/ui.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/join-teams.css';

const lower = (v) => String(v || '').toLowerCase();

export default function JoinTeams() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const id = params.get('id') || params.get('compId') || '';
  // An invite link (…&teamId=) opens straight to that one team.
  const invitedTeamId = params.get('teamId');
  const { loading, error, data: comp, reload } = useCompetition(id);
  const joinCodeGate = useJoinCodeGate(comp);

  const [myRequests, setMyRequests] = useState([]);
  const [removal, setRemoval] = useState(null);
  const [sending, setSending] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [paying, setPaying] = useState(false);

  const loadMine = useCallback(async () => {
    if (!session) return;
    const res = await TeamsAPI.myJoinRequests();
    if (res.ok && Array.isArray(res.data)) setMyRequests(res.data.filter((r) => r.competitionId === id));
  }, [session, id]);

  useEffect(() => { loadMine(); }, [loadMine]);
  useReportSync(useCallback(() => { reload(); loadMine(); }, [reload, loadMine]));

  useEffect(() => {
    if (!id || !session) return;
    ReportsAPI.removalStatus(id).then((res) => { if (res.ok) setRemoval(res.data); });
  }, [id, session]);

  if (!id) return <main className="join-page"><ErrorState message="No competition was selected." /></main>;
  if (removal?.removed) return <RemovedFromCompetition reason={removal.reason} />;
  if (loading && !comp) return <main className="join-page"><LoadingState label="Loading teams…" /></main>;
  if (error || !comp) return <main className="join-page"><ErrorState message={error || 'That competition could not be found.'} onRetry={reload} /></main>;

  const me = lower(session?.username);
  const teams = comp.activeTeams;
  const myTeam = teams.find((t) => t.members.some((m) => lower(m.username) === me)) || null;
  const organizer = isOrganizerOf(comp, me);
  const maxPerTeam = comp.maxPlayersPerTeam || 5;
  const regOpen = comp.registration.open;
  const openRequests = myRequests.filter((r) => ['pending', 'awaiting_payment'].includes(r.status));
  const requestedTeamIds = new Set(openRequests.map((r) => r.teamId));
  const playerFee = comp.feeType === 'per_player' ? comp.entryFeeAmount : 0;
  const invitedTeam = invitedTeamId ? teams.find((t) => t.id === invitedTeamId) || null : null;
  const shownTeams = invitedTeam ? [invitedTeam] : teams;
  const allTeamsHref = `/pages/join-teams.html?id=${encodeURIComponent(comp.id)}`;

  async function requestJoin(team) {
    if (!session) {
      const back = `/pages/join-teams.html?id=${encodeURIComponent(id)}${invitedTeamId ? `&teamId=${encodeURIComponent(invitedTeamId)}` : ''}`;
      navigate(`/pages/login.html?redirect=${encodeURIComponent(back)}`);
      return;
    }
    const code = await joinCodeGate.requireCode();
    if (code === null) return;
    setSending(team.id);
    const res = await TeamsAPI.createJoinRequest(team.id, comp.id, null, '', code || undefined);
    setSending('');
    if (!res.ok) { showToast(res.error || 'Unable to send the join request.', 'error'); return; }
    showToast(playerFee > 0 ? `Request sent. If the captain accepts, pay ${formatINR(playerFee)} to join.` : 'Join request sent. The captain will review it.');
    loadMine();
  }

  async function pay() {
    if (!checkout || paying) return;
    setPaying(true);
    const res = await TeamsAPI.payJoinRequest(checkout.id);
    setPaying(false);
    if (!res.ok) { showToast(res.error || 'Payment could not be completed.', 'error'); return; }
    showToast(`Payment received. You joined ${checkout.teamName}.`);
    setCheckout(null);
    reload();
    loadMine();
  }

  const createHref = myTeam
    ? `/pages/team/team-roster.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(myTeam.id)}`
    : `/pages/create-team.html?id=${encodeURIComponent(comp.id)}`;

  return (
    <main className="join-page">
      <Link to={`/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`} className="back-btn">← Back to competition</Link>

      <div className="comp-context">
        <div>
          <div className="comp-name">{comp.name} · {comp.game}</div>
          <div className="comp-sub">{comp.registration.label}{comp.registration.detail ? ` · ${comp.registration.detail}` : ''}</div>
        </div>
      </div>

      <div className="join-header-row">
        <div>
          <h1>{invitedTeam ? `Join ${invitedTeam.name}` : 'Join a team'}</h1>
          <p>
            {invitedTeam
              ? <>You were invited to this team. Send a request and the captain will review it. <Link to={allTeamsHref}>See all teams</Link></>
              : 'Request to join a team below, or create your own.'}
          </p>
        </div>
        {!organizer && (myTeam || regOpen) && (
          <Link to={createHref} className="create-team-cta">{myTeam ? 'View my team' : '+ Create team'}</Link>
        )}
      </div>

      {organizer && <Notice tone="info">You organize this competition, so you cannot join a team in it.</Notice>}
      {!regOpen && <Notice tone="warning">{comp.registration.label}. New join requests are closed.</Notice>}
      {invitedTeamId && !invitedTeam && <Notice tone="warning">The team in this invite link is no longer registered in this competition. Showing all teams instead.</Notice>}
      {myTeam && <Notice tone="success">You are on {myTeam.name}. A player can be on only one team per competition.</Notice>}

      {openRequests.length > 0 && (
        <section className="pending-requests-section" style={{ marginBottom: 28 }}>
          <div className="pending-header"><span>Your requests</span><span className="pending-badge">{openRequests.length}</span></div>
          <div className="ui-list">
            {openRequests.map((req) => (
              <div className="ui-row" key={req.id}>
                <div className="ui-avatar">{String(req.teamName || 'T').charAt(0).toUpperCase()}</div>
                <div className="ui-row-main">
                  <div className="ui-row-title">{req.teamName || 'Team'}</div>
                  <div className="ui-row-meta">Sent {formatDate(req.createdAt, true)}</div>
                </div>
                {req.status === 'awaiting_payment' ? (
                  <button type="button" className="btn-primary" onClick={() => setCheckout({ id: req.id, teamName: req.teamName, amount: req.amount || playerFee })}>
                    Accepted — pay {formatINR(req.amount || playerFee)}
                  </button>
                ) : <span className="status-pill pending">Waiting for captain</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {!invitedTeam && <div className="section-label">Registered teams ({teams.length}{comp.maxTeams ? ` / ${comp.maxTeams}` : ''})</div>}

      {teams.length === 0 ? (
        <EmptyState title="No teams registered yet" message={regOpen ? 'Be the first to create one.' : 'Registration is closed.'} />
      ) : (
        <div id="team-list">
          {shownTeams.map((team) => {
            const count = team.members.length;
            const full = count >= maxPerTeam;
            const isMine = myTeam && myTeam.id === team.id;
            let action;
            if (isMine) action = <span className="status-pill approved">Your team</span>;
            else if (organizer) action = null;
            else if (full) action = <button type="button" className="btn-join team-full-btn" disabled>Team full</button>;
            else if (myTeam) action = <button type="button" className="btn-join" disabled>In another team</button>;
            else if (requestedTeamIds.has(team.id)) action = <button type="button" className="btn-join" disabled>Requested</button>;
            else if (!regOpen) action = <button type="button" className="btn-join" disabled>Closed</button>;
            else action = <button type="button" className="btn-join" disabled={sending === team.id} onClick={() => requestJoin(team)}>{sending === team.id ? 'Sending…' : 'Request to join'}</button>;

            return (
              <div className={`request-card${invitedTeam && invitedTeam.id === team.id ? ' request-card-highlight' : ''}`} key={team.id}>
                <div className="request-card-left">
                  <div className="team-icon">{team.avatar}</div>
                  <div>
                    <div className="team-name">{team.name}</div>
                    <div className="team-info">
                      {count}/{maxPerTeam} players · {full ? <span className="slots-full">no slots open</span> : <span>{maxPerTeam - count} slot{maxPerTeam - count !== 1 ? 's' : ''} open</span>}
                    </div>
                    <div className="wanted-roles"><span>Captain:</span><span className="role-badge">@{team.leader}</span></div>
                  </div>
                </div>
                <div className="request-card-actions">{action}</div>
              </div>
            );
          })}
        </div>
      )}

      {checkout && (
        <PlayerFeeModal compName={comp.name} teamName={checkout.teamName} feeAmount={checkout.amount} busy={paying} onCancel={() => setCheckout(null)} onConfirm={pay} />
      )}
      {joinCodeGate.modal}
    </main>
  );
}
