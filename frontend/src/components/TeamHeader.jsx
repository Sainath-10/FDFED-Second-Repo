/**
 * NEXUS ESPORTS — team header
 *
 * The top of every team page: the team's identity, where it stands (players,
 * record, next match), the unregister action, and the tab bar. Captains and
 * players see the same header; only the actions differ.
 *
 * Unregistering:
 *  - a player can unregister until the competition ends. Before the start their
 *    own fee (per-player competitions) is refunded; after the start nothing is.
 *  - the captain can unregister the whole team before the start (every fee is
 *    refunded). After the start the captain stays with the team.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MatchesAPI, TeamsAPI } from '../services/api.js';
import { normalizeFixture } from '../lib/fixtures.mjs';
import TeamTabs from './TeamTabs.jsx';
import { ReasonDialog, formatINR } from './ui.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/team/team-dashboard.css';

const lower = (v) => String(v || '').trim().toLowerCase();
export const teamHue = (name) => [...String(name || '?')].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;

export function TeamAvatar({ name, size = 'lg' }) {
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return <span className={`td-avatar td-avatar-${size}`} style={{ '--team-hue': teamHue(name) }} aria-hidden="true">{initials}</span>;
}

/** The team's fixtures, played record and next match, from the saved matches. */
export function useTeamFixtures(compId, teamId, refreshKey) {
  const [matches, setMatches] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!compId) return undefined;
    const load = () => MatchesAPI.getByCompetition(compId).then((res) => {
      if (!cancelled && res.ok && Array.isArray(res.data)) setMatches(res.data.map(normalizeFixture));
    });
    load();
    const timer = window.setInterval(load, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [compId, refreshKey]);

  return useMemo(() => {
    const all = matches || [];
    const mine = all.filter((m) => teamId && (m.team1Id === teamId || m.team2Id === teamId));
    const record = { w: 0, d: 0, l: 0 };
    mine.filter((m) => m.status === 'completed').forEach((m) => {
      if (!m.winnerId) record.d += 1;
      else if (m.winnerId === teamId) record.w += 1;
      else record.l += 1;
    });
    const upcoming = mine
      .filter((m) => !['completed', 'bye', 'cancelled'].includes(m.status))
      .sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity));
    const next = upcoming[0] || null;
    const opponent = (m) => (m.team1Id === teamId ? m.team2 : m.team1);
    return { loaded: matches !== null, all, mine, record, next, upcoming, opponent };
  }, [matches, teamId]);
}

export default function TeamHeader({ t, active, joinRequestCount, refreshKey }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const { team, comp, members, canManage, canChat, isEnded, isStarted, isLeader, isMember, context } = t;
  const fixtures = useTeamFixtures(comp?.id, team?.id, refreshKey);
  if (!team || !comp) return null;

  const maxPlayers = comp.maxPlayersPerTeam || 5;
  const status = lower(team.status);
  const removed = ['banned', 'rejected', 'disbanded'].includes(status);
  const perPlayerFee = comp.feeType === 'per_player' && Number(comp.entryFeeAmount) > 0;
  const teamFee = comp.feeType === 'per_team' && Number(comp.entryFeeAmount) > 0;
  const startDate = comp.startDate ? new Date(comp.startDate) : null;

  let pill = { tone: 'ok', label: 'Registered' };
  if (removed) pill = { tone: 'bad', label: status === 'banned' ? 'Banned' : status === 'disbanded' ? 'Unregistered' : 'Rejected' };
  else if (isEnded) pill = { tone: 'muted', label: 'Competition ended' };
  else if (isStarted) pill = { tone: 'live', label: 'Live · roster locked' };

  const canPlayerLeave = isMember && !isLeader && !isEnded && !removed;
  const canTeamLeave = isLeader && !isStarted && !isEnded && !removed;

  async function leave(reason) {
    const res = await TeamsAPI.leave(team.id, reason);
    if (!res.ok) { showToast(res.error || 'Unable to unregister.', 'error'); return; }
    setDialog(null);
    showToast(isStarted
      ? `You unregistered from ${team.name}. The competition had started, so no fee was refunded.`
      : `You unregistered from ${team.name}.${perPlayerFee ? ' Your entry fee was refunded.' : ''}`);
    navigate('/pages/my-activity.html');
  }

  async function disband(reason) {
    const res = await TeamsAPI.disband(team.id, reason, team.memberUsernames || []);
    if (!res.ok) { showToast(res.error || 'Unable to unregister the team.', 'error'); return; }
    setDialog(null);
    showToast(`${team.name} is unregistered.${perPlayerFee || teamFee ? ' Every fee paid for the team is refunded.' : ''} Your players were notified.`);
    navigate('/pages/my-activity.html');
  }

  const { record, next, opponent } = fixtures;
  const played = record.w + record.d + record.l;

  return (
    <>
      <div className="td-breadcrumb">
        <Link to="/pages/my-activity.html">My activity</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`}>{comp.name}</Link>
        <span aria-hidden="true">/</span>
        <span>{team.name}</span>
      </div>

      <header className="td-hero" style={{ '--team-hue': teamHue(team.name) }}>
        <div className="td-hero-main">
          <TeamAvatar name={team.name} />
          <div className="td-hero-copy">
            <div className="td-hero-tags">
              <span className={`td-pill td-pill-${pill.tone}`}><i aria-hidden="true" />{pill.label}</span>
              <span className="td-tag">{comp.game || 'Esports'}</span>
              <span className="td-tag">{comp.format || (comp.type === 'league' ? 'Round Robin' : 'Single Elimination')}</span>
            </div>
            <h1 className="td-title">{team.name}</h1>
            <p className="td-sub">
              {comp.name} · Captain <strong>@{team.leader}</strong>
              {isMember && <> · You are the <strong>{isLeader ? 'captain' : 'player'}</strong></>}
            </p>
          </div>
          {(canPlayerLeave || canTeamLeave) && (
            <div className="td-hero-actions">
              {canPlayerLeave && <button type="button" className="td-btn td-btn-danger" onClick={() => setDialog('leave')}>Unregister</button>}
              {canTeamLeave && <button type="button" className="td-btn td-btn-danger" onClick={() => setDialog('disband')}>Unregister team</button>}
            </div>
          )}
        </div>

        <div className="td-stats">
          <div className="td-stat">
            <span className="td-stat-label">Players</span>
            <strong className="td-stat-value">{members.length}<small>/{maxPlayers}</small></strong>
            <div className="td-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (members.length / maxPlayers) * 100)}%` }} /></div>
          </div>
          <div className="td-stat">
            <span className="td-stat-label">Record</span>
            <strong className="td-stat-value">{played ? <>{record.w}<small>W</small> {record.d}<small>D</small> {record.l}<small>L</small></> : '—'}</strong>
            <span className="td-stat-hint">{played ? `${played} match${played === 1 ? '' : 'es'} played` : 'No results yet'}</span>
          </div>
          <div className="td-stat td-stat-wide">
            <span className="td-stat-label">{isEnded ? 'Competition' : 'Next match'}</span>
            {isEnded ? (
              <strong className="td-stat-value td-stat-text">Finished</strong>
            ) : next ? (
              <>
                <strong className="td-stat-value td-stat-text">vs {opponent(next)}</strong>
                <span className="td-stat-hint">{next.round} · {next.timestamp ? `${next.date}${next.time ? `, ${next.time}` : ''}` : 'time to be confirmed'}</span>
              </>
            ) : (
              <>
                <strong className="td-stat-value td-stat-text">{fixtures.loaded && fixtures.mine.length ? 'No match pending' : 'Fixtures pending'}</strong>
                <span className="td-stat-hint">{startDate && !isStarted ? `Starts ${startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'The organiser publishes the schedule'}</span>
              </>
            )}
          </div>
          <div className="td-stat">
            <span className="td-stat-label">Entry fee</span>
            <strong className="td-stat-value td-stat-text">{comp.feeType === 'free' || !Number(comp.entryFeeAmount) ? 'Free' : formatINR(comp.entryFeeAmount)}</strong>
            <span className="td-stat-hint">{perPlayerFee ? 'per player' : teamFee ? 'per team' : 'no fee'}</span>
          </div>
        </div>
      </header>

      <TeamTabs active={active} context={context} canManage={canManage} canChat={canChat} isEnded={isEnded} joinRequestCount={joinRequestCount} />

      <ReasonDialog
        open={dialog === 'leave'}
        title={`Unregister from ${team.name}`}
        description={isStarted
          ? `The competition has started, so no fee is refunded. You leave the roster now and will not share any prize. The captain is notified.`
          : `You leave the roster now.${perPlayerFee ? ` The ${formatINR(comp.entryFeeAmount)} you paid is refunded in full.` : ''} The captain is notified.`}
        placeholder="Optional note for your captain"
        minLength={1}
        optional
        confirmLabel={isStarted ? 'Unregister without refund' : 'Unregister'}
        onConfirm={leave}
        onClose={() => setDialog(null)}
      />
      <ReasonDialog
        open={dialog === 'disband'}
        title={`Unregister ${team.name}`}
        description={`The whole team leaves ${comp.name}.${perPlayerFee || teamFee ? ' Every fee paid for this team is refunded in full.' : ''} Every player and the organiser are notified. This cannot be undone.`}
        placeholder="e.g. Half the roster cannot attend the match days"
        minLength={10}
        confirmLabel="Unregister team"
        onConfirm={disband}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
