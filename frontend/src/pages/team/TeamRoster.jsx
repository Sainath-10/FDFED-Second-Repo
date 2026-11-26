/**
 * NEXUS ESPORTS — Team Roster
 *
 * The team dashboard's home: who is on the team, open slots, and the
 * competition at a glance. The captain removes players (before the start) and
 * invites more; any player can unregister from the header. Loaded from the
 * backend, so it is the same on every device.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import { TeamsAPI } from '../../services/api.js';
import TeamHeader, { TeamAvatar } from '../../components/TeamHeader.jsx';
import CompetitionResults from '../../components/CompetitionResults.jsx';
import ReportButton from '../../components/ReportButton.jsx';
import { EmptyState, ErrorState, LoadingState, Notice, PageHeader, ReasonDialog, RemovedFromCompetition, copyText, formatDate } from '../../components/ui.jsx';
import { showToast } from '../../lib/toast.js';

export default function TeamRoster() {
  const t = useTeamContext();
  const [removeTarget, setRemoveTarget] = useState(null);

  if (t.loading && !t.team) return <main className="main-content"><LoadingState label="Loading your team…" /></main>;
  if (t.isRemoved) return <RemovedFromCompetition reason={t.removalReason} />;
  if (!t.team || !t.comp) {
    return (
      <main className="main-content">
        <PageHeader title="Team" />
        {t.error ? <ErrorState message={t.error} onRetry={t.refresh} /> : (
          <EmptyState
            title="You are not on a team yet"
            message="Create a team for a competition, or ask to join an existing one."
            action={<Link to="/pages/competitions.html" className="btn-primary">Browse competitions</Link>}
          />
        )}
      </main>
    );
  }

  const { team, comp, members, canManage, isEnded, isStarted, isLeader, rosterLocked } = t;
  const me = String(t.session?.username || '').toLowerCase();
  const maxPlayers = comp.maxPlayersPerTeam || 5;
  const openSlots = Math.max(0, maxPlayers - members.length);
  const addHref = `/pages/team/add-players.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;
  const perPlayerFee = comp.feeType === 'per_player' && Number(comp.entryFeeAmount) > 0;
  const joinLink = `${window.location.origin}/pages/join-teams.html?id=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`;
  const sorted = [...members].sort((a, b) => Number(b.role === 'captain') - Number(a.role === 'captain') || a.username.localeCompare(b.username));

  async function removePlayer(reason) {
    const res = await TeamsAPI.removeMember(team.id, removeTarget, reason);
    if (!res.ok) { showToast(res.error || 'Unable to remove this player.', 'error'); return; }
    showToast(`${removeTarget} was removed${perPlayerFee ? ' and their entry fee refunded' : ''}.`);
    setRemoveTarget(null);
    t.refresh();
  }

  return (
    <main className="main-content">
      <TeamHeader active="roster" />

      {isEnded && <CompetitionResults competitionId={comp.id} highlightTeamId={team.id} compact />}
      {isEnded && <Notice tone="warning">This competition has ended. The roster is final.</Notice>}
      {!isEnded && isStarted && (
        <Notice tone="info">
          The competition has started, so the roster is locked.
          {isLeader ? ' You lead the team until the end.' : ' You can still unregister from the header, but no fee is refunded after the start.'}
        </Notice>
      )}

      <div className="td-two-col">
        <section className="td-section">
          <div className="td-section-head">
            <div>
              <h2 className="td-section-title">Roster</h2>
              <p className="td-section-sub">{members.length} of {maxPlayers} players · {openSlots} slot{openSlots === 1 ? '' : 's'} open</p>
            </div>
            {canManage && !rosterLocked && openSlots > 0 && <Link to={addHref} className="td-btn td-btn-primary">+ Add players</Link>}
          </div>

          <div className="td-roster">
            {sorted.map((member) => {
              const isCaptain = member.role === 'captain';
              const isMe = member.username.toLowerCase() === me;
              return (
                <article className={`td-player${isCaptain ? ' is-captain' : ''}${isMe ? ' is-me' : ''}`} key={member.username}>
                  {isCaptain && <span className="td-player-badge">CAPTAIN</span>}
                  <div className="td-player-top">
                    <TeamAvatar name={member.username} size="md" />
                    <div style={{ minWidth: 0 }}>
                      <div className="td-player-name">@{member.username}</div>
                      <div className="td-player-role">{isCaptain ? 'Team captain' : 'Player'}{isMe ? ' · you' : ''}</div>
                    </div>
                  </div>
                  {(!isMe && !isEnded) || (canManage && !isCaptain && !rosterLocked) ? (
                    <div className="td-player-actions">
                      {canManage && !isCaptain && !rosterLocked && (
                        <button type="button" className="td-btn td-btn-sm td-btn-danger" onClick={() => setRemoveTarget(member.username)}>Remove</button>
                      )}
                      {!isMe && !isEnded && (
                        <ReportButton compId={comp.id} against={member.username} targetRole={isCaptain ? 'team_leader' : 'player'} source="team-roster" className="td-btn td-btn-sm" />
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}

            {/* The existing players plus a single "Open slot" card while there is room. */}
            {canManage && !rosterLocked && openSlots > 0 && (
              <Link className="td-player td-player-empty" to={addHref}>
                <span className="td-plus" aria-hidden="true">+</span>
                <span>Open slot</span>
                <small>{openSlots === 1 ? 'Invite a player · 1 place left' : `Invite a player · ${openSlots} places left`}</small>
              </Link>
            )}
          </div>
        </section>

        <aside className="td-side">
          <div className="td-panel">
            <h3 className="td-section-title" style={{ fontSize: 16, marginBottom: 8 }}>Competition</h3>
            <div className="td-kv"><span>Name</span><strong>{comp.name}</strong></div>
            <div className="td-kv"><span>Starts</span><strong>{formatDate(comp.startDate)}</strong></div>
            <div className="td-kv"><span>Ends</span><strong>{formatDate(comp.endDate)}</strong></div>
            <div className="td-kv"><span>Prize pool</span><strong>{Number(comp.prize) > 0 ? `₹${Number(comp.prize).toLocaleString('en-IN')}` : 'None'}</strong></div>
            {Number(comp.prize) > 0 && (
              <div className="td-kv">
                <span>Prize pool status</span>
                <strong style={{ color: comp.prizePoolPaid ? '#c6ff33' : '#fbbf24' }}>{comp.prizePoolPaid ? 'Paid · held in escrow' : 'Not paid yet'}</strong>
              </div>
            )}
            <Link className="td-btn" style={{ width: '100%', marginTop: 12 }} to={`/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`}>Open competition page</Link>
          </div>

          {canManage && !rosterLocked && (
            <div className="td-panel">
              <h3 className="td-section-title" style={{ fontSize: 16, marginBottom: 6 }}>Recruit players</h3>
              <p className="td-section-sub" style={{ marginBottom: 12 }}>Share this link. Players who open it can ask to join; you approve them under Join requests.</p>
              <button type="button" className="td-btn" style={{ width: '100%' }} onClick={async () => showToast((await copyText(joinLink)) ? 'Join link copied.' : 'Copy failed — copy it from the address bar of the join page.')}>Copy join link</button>
            </div>
          )}
        </aside>
      </div>

      <ReasonDialog
        open={!!removeTarget}
        title="Remove player"
        description={`You are removing @${removeTarget} from ${team.name}. The reason is shared with them and recorded.${perPlayerFee ? ' Their entry fee is refunded from escrow.' : ''}`}
        placeholder="e.g. Repeatedly missed scheduled matches without notice"
        minLength={5}
        confirmLabel="Remove player"
        onConfirm={removePlayer}
        onClose={() => setRemoveTarget(null)}
      />
    </main>
  );
}
