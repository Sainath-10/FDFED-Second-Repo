/**
 * NEXUS ESPORTS — Add Players
 *
 * The captain finds players as they type and sends invitations. Suggestions
 * come from the server and already leave out staff, organisers of this
 * competition, players on another team and anyone removed from it. The
 * backend re-checks all of that, the roster limit and the start-date lock.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import { fetchJoinRequestCount } from '../../store/teamSlice.js';
import { TeamsAPI } from '../../services/api.js';
import TeamHeader, { TeamAvatar } from '../../components/TeamHeader.jsx';
import UsernameSearch from '../../components/UsernameSearch.jsx';
import { Notice } from '../../components/ui.jsx';
import { teamGate } from './TeamGate.jsx';
import { showToast } from '../../lib/toast.js';

export default function AddPlayers() {
  const t = useTeamContext();
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const [suggested, setSuggested] = useState([]);
  const [invites, setInvites] = useState([]);
  const [version, setVersion] = useState(0);
  const [sendingTo, setSendingTo] = useState('');
  const teamId = t.team?.id;

  // Players the team can still invite, for the live search and the suggestions list.
  const searchAvailable = useCallback(async (query) => {
    const res = await TeamsAPI.getAvailablePlayers(teamId, query);
    if (!res.ok) throw new Error(res.error || 'Unable to search players.');
    return (res.data || []).map((p) => ({ ...p, disabled: p.invited }));
  }, [teamId]);

  useEffect(() => {
    if (!teamId || !t.canManage) return;
    TeamsAPI.getAvailablePlayers(teamId, '').then((res) => setSuggested(res.ok && Array.isArray(res.data) ? res.data.slice(0, 8) : []));
    TeamsAPI.getTeamInvites(teamId).then((res) => { if (res.ok && Array.isArray(res.data)) setInvites(res.data); });
    dispatch(fetchJoinRequestCount(teamId));
  }, [teamId, t.canManage, version, dispatch]);

  const gate = teamGate(t, { captainOnly: true, title: 'Add players' });
  if (gate) return gate;

  const { team, comp, members, isEnded, isStarted, rosterLocked } = t;
  const maxPlayers = comp.maxPlayersPerTeam || 5;
  const isFull = members.length >= maxPlayers;
  const pendingInvites = invites.filter((i) => i.status === 'pending');
  const pendingRequests = t.pendingJoinRequests;
  const perPlayerFee = comp.feeType === 'per_player' && Number(comp.entryFeeAmount) > 0;
  const blocked = rosterLocked || isFull;

  async function sendInvite(name) {
    const username = String(name || '').trim().replace(/^@/, '');
    if (!username) return;
    setSendingTo(username);
    const res = await TeamsAPI.createInvite(team.id, comp.id, username);
    setSendingTo('');
    if (!res.ok) { showToast(res.error || 'Unable to send the invitation.', 'error'); return; }
    setText('');
    showToast(`Invitation sent to @${username}. They accept it from their notifications.`);
    setVersion((v) => v + 1);
  }

  return (
    <main className="main-content">
      <TeamHeader active="add-players" />

      {isEnded && <Notice tone="warning">This competition has ended, so no more players can be invited.</Notice>}
      {!isEnded && isStarted && <Notice tone="info">The competition has started, so the roster is locked.</Notice>}
      {!rosterLocked && isFull && <Notice tone="danger">The team is full ({members.length} / {maxPlayers}). Remove a player to free a slot.</Notice>}

      <div className="td-two-col">
        <div>
          <section className="td-panel td-section">
            <h2 className="td-section-title">Invite a player</h2>
            <p className="td-section-sub" style={{ marginBottom: 14 }}>
              Start typing a username. Only players who can join this team are shown — never staff, this competition&apos;s organisers, or anyone already on a team here.
              {perPlayerFee && ` Each player pays their own ₹${Number(comp.entryFeeAmount).toLocaleString('en-IN')} entry fee when they accept.`}
            </p>
            <UsernameSearch
              id="invite-search"
              value={text}
              onChange={setText}
              onPick={sendInvite}
              search={searchAvailable}
              disabled={blocked || !!sendingTo}
              placeholder={blocked ? 'The roster is closed' : 'Search players by username…'}
              renderHint={(row) => (row.invited ? 'Already invited' : 'Send invite ↵')}
            />
            {sendingTo && <p className="td-section-sub" style={{ marginTop: 10 }}>Sending an invitation to @{sendingTo}…</p>}
          </section>

          {!blocked && suggested.length > 0 && (
            <section className="td-section">
              <div className="td-section-head">
                <div>
                  <h2 className="td-section-title">Available players</h2>
                  <p className="td-section-sub">A few players you can invite right now.</p>
                </div>
              </div>
              <div className="td-roster">
                {suggested.map((player) => (
                  <article className="td-player" key={player.username}>
                    <div className="td-player-top">
                      <TeamAvatar name={player.username} size="md" />
                      <div style={{ minWidth: 0 }}>
                        <div className="td-player-name">@{player.username}</div>
                        <div className="td-player-role">Registered player</div>
                      </div>
                    </div>
                    <div className="td-player-actions">
                      {player.invited
                        ? <span className="td-pill td-pill-muted">Invited</span>
                        : <button type="button" className="td-btn td-btn-sm td-btn-primary" disabled={sendingTo === player.username} onClick={() => sendInvite(player.username)}>{sendingTo === player.username ? 'Sending…' : 'Send invite'}</button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="td-side">
          <div className="td-panel">
            <h3 className="td-section-title" style={{ fontSize: 16, marginBottom: 8 }}>Roster status</h3>
            <div className="td-kv"><span>Players</span><strong>{members.length} / {maxPlayers}</strong></div>
            <div className="td-kv"><span>Open slots</span><strong style={{ color: 'var(--accent)' }}>{Math.max(0, maxPlayers - members.length)}</strong></div>
            <div className="td-kv"><span>Pending invites</span><strong>{pendingInvites.length}</strong></div>
            <div className="td-kv"><span>Join requests</span><strong>{pendingRequests}</strong></div>
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              <Link to={`/pages/team/join-requests.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`} className="td-btn td-btn-primary">Review join requests</Link>
              <Link to={`/pages/team/invitations-sent.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`} className="td-btn">View invitations</Link>
            </div>
          </div>
          {pendingInvites.length > 0 && (
            <div className="td-panel">
              <h3 className="td-section-title" style={{ fontSize: 16, marginBottom: 8 }}>Waiting for a reply</h3>
              {pendingInvites.slice(0, 6).map((inv) => (
                <div className="td-kv" key={inv.id}><span>@{inv.toUsername}</span><strong>Pending</strong></div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
