/**
 * NEXUS ESPORTS — Join Requests
 *
 * Requests to join this team, from the backend. Accepting adds the player, or —
 * where each player pays — waits for their payment, which is what adds them.
 * The result shown always comes from the server's answer.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import { TeamsAPI } from '../../services/api.js';
import TeamHeader from '../../components/TeamHeader.jsx';
import { EmptyState, ErrorState, LoadingState, formatDate, formatINR } from '../../components/ui.jsx';
import { teamGate } from './TeamGate.jsx';
import useReportSync from '../../hooks/useReportSync.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/team/join-requests.css';

export default function JoinRequests() {
  const t = useTeamContext();
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const teamId = t.team?.id;

  const load = useCallback(async () => {
    if (!teamId) return;
    const res = await TeamsAPI.getJoinRequests(teamId);
    if (res.ok) { setRequests(Array.isArray(res.data) ? res.data : []); setError(''); } else setError(res.error || 'Unable to load join requests.');
  }, [teamId]);

  useEffect(() => { if (t.canManage) load(); }, [load, t.canManage]);
  useReportSync(t.canManage ? load : null);

  const gate = teamGate(t, { captainOnly: true, title: 'Join requests' });
  if (gate) return gate;

  const { team, comp, rosterLocked } = t;
  const playerFee = comp.feeType === 'per_player' ? Number(comp.entryFeeAmount) || 0 : 0;
  const pending = (requests || []).filter((r) => r.status === 'pending');
  const awaiting = (requests || []).filter((r) => r.status === 'awaiting_payment');

  async function decide(request, status) {
    setBusy(request.id);
    const res = await TeamsAPI.updateJoinRequest(request.id, status);
    setBusy('');
    if (!res.ok) { showToast(res.error || 'Unable to update this request.', 'error'); return; }
    const result = res.data || {};
    if (status === 'declined') showToast(`${request.fromUsername}'s request was declined.`);
    else if (result.status === 'awaiting_payment') showToast(`${request.fromUsername} was accepted and joins after paying ${formatINR(result.amount || playerFee)}.`);
    else showToast(`${request.fromUsername} joined ${team.name}.`);
    load();
    t.refresh();
  }

  return (
    <main className="main-content">
      <TeamHeader t={t} active="join-requests" joinRequestCount={pending.length} />
      <div className="td-section-head">
        <div>
          <h2 className="td-section-title">Join requests</h2>
          <p className="td-section-sub">Players who asked to join your team.</p>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && requests === null && <LoadingState label="Loading join requests…" />}
      {!error && requests && pending.length === 0 && awaiting.length === 0 && (
        <EmptyState title="All caught up" message="There are no pending join requests." />
      )}

      <div className="ui-list">
        {pending.map((req) => (
          <div className="ui-row" key={req.id}>
            <div className="ui-avatar">{String(req.fromUsername || 'U').charAt(0).toUpperCase()}</div>
            <div className="ui-row-main">
              <div className="ui-row-title">@{req.fromUsername}</div>
              <div className="ui-row-meta">Requested {formatDate(req.createdAt, true)}{req.message ? ` · “${req.message}”` : ''}</div>
              {playerFee > 0 && <div className="ui-row-meta" style={{ color: '#fbbf24' }}>They pay {formatINR(playerFee)} after you accept.</div>}
            </div>
            <div className="ui-row-actions">
              <button type="button" className="btn-table-primary" disabled={rosterLocked || busy === req.id} onClick={() => decide(req, 'accepted')}>Accept</button>
              <button type="button" className="btn-table-danger" disabled={busy === req.id} onClick={() => decide(req, 'declined')}>Decline</button>
            </div>
          </div>
        ))}
        {awaiting.map((req) => (
          <div className="ui-row" key={req.id}>
            <div className="ui-avatar">{String(req.fromUsername || 'U').charAt(0).toUpperCase()}</div>
            <div className="ui-row-main">
              <div className="ui-row-title">@{req.fromUsername}</div>
              <div className="ui-row-meta">Accepted — waiting for them to pay {formatINR(playerFee)}.</div>
            </div>
            <span className="status-pill pending">Awaiting payment</span>
          </div>
        ))}
      </div>
    </main>
  );
}
