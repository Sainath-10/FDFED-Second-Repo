/**
 * NEXUS ESPORTS — Notifications
 *
 * The signed-in user's notifications from the backend, with the actions that
 * belong to them: accept or decline a team invitation, a join request or a
 * co-organizer invitation, and pay an entry fee after a captain accepts.
 * Each action calls the real endpoint; the result shown is the server's answer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CompetitionsAPI, NotificationsAPI, TeamsAPI } from '../services/api.js';
import PlayerFeeModal from '../components/PlayerFeeModal.jsx';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, formatDate, formatINR } from '../components/ui.jsx';
import useReportSync from '../hooks/useReportSync.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/notifications.css';
import { ACTIONABLE, MONEY_TYPES, linkOf } from '../lib/notificationLinks.js';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Needs action' },
  { id: 'approved', label: 'Accepted' },
  { id: 'rejected', label: 'Declined' },
  { id: 'info', label: 'Updates' },
];

const ANSWER_IN_PLACE = ['team-join-request', 'team-invite', 'co-organizer-invite', 'team-join-payment'];

function bucketOf(item) {
  if (ACTIONABLE.includes(item.type) && item.status === 'pending') return 'pending';
  if (item.status === 'approved') return 'approved';
  if (item.status === 'rejected') return 'rejected';
  return 'info';
}

export default function Notifications() {
  const session = useSelector((state) => state.auth.session);
  const username = session?.username || '';
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [paying, setPaying] = useState(null);
  const [inviteFee, setInviteFee] = useState(null);

  const load = useCallback(async () => {
    if (!username) return;
    const res = await NotificationsAPI.getForUser(username);
    if (res.ok) { setItems(Array.isArray(res.data) ? res.data : []); setError(''); } else setError(res.error || 'Unable to load notifications.');
  }, [username]);
  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, approved: 0, rejected: 0, info: 0 };
    (items || []).forEach((i) => { c.all += 1; c[bucketOf(i)] += 1; });
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Matches the title, message, raw status/type and the tab label ("needs action", "declined", …).
    const haystack = (i) => `${i.title || ''} ${i.body || ''} ${i.status || ''} ${String(i.type || '').replace(/[-_]/g, ' ')} ${TABS.find((t) => t.id === bucketOf(i))?.label || ''}`.toLowerCase();
    return (items || []).filter((i) => (tab === 'all' || bucketOf(i) === tab) && (!q || haystack(i).includes(q)));
  }, [items, tab, query]);

  async function finish(item, status) {
    await NotificationsAPI.setStatus(item.id, status);
    load();
  }

  /** Runs an action; when the server says it was already handled, the notification is closed too. */
  async function run(item, call, success, status) {
    setBusy(item.id);
    const res = await call();
    setBusy('');
    if (!res.ok) {
      showToast(res.error || 'That action failed.', 'error');
      if (/already handled|already been|was revoked|no longer|not found|do not have a pending/i.test(res.error || '')) finish(item, 'info');
      return false;
    }
    showToast(success);
    await finish(item, status);
    return true;
  }

  async function accept(item) {
    const m = item.meta || {};
    if (item.type === 'team-join-request') return run(item, () => TeamsAPI.updateJoinRequest(m.requestId, 'accepted'), 'Request accepted.', 'approved');
    if (item.type === 'co-organizer-invite') return run(item, () => CompetitionsAPI.acceptOrganizerInvite(m.compId), 'You are now a co-organizer.', 'approved');
    if (item.type === 'team-join-payment') { setPaying(item); return true; }
    if (item.type === 'team-invite') {
      // Where each player pays, accepting an invitation takes the entry fee: confirm it first.
      const comp = m.compId ? await CompetitionsAPI.getById(m.compId) : null;
      const fee = comp?.ok && comp.data.feeType === 'per_player' ? Number(comp.data.entryFeeAmount) || 0 : 0;
      if (fee > 0) { setInviteFee({ item, fee }); return true; }
      return run(item, () => TeamsAPI.updateInvite(m.inviteId, 'accepted'), 'You joined the team.', 'approved');
    }
    return false;
  }

  async function decline(item) {
    const m = item.meta || {};
    if (item.type === 'team-join-request') return run(item, () => TeamsAPI.updateJoinRequest(m.requestId, 'declined'), 'Request declined.', 'rejected');
    if (item.type === 'team-invite') return run(item, () => TeamsAPI.updateInvite(m.inviteId, 'declined'), 'Invitation declined.', 'rejected');
    if (item.type === 'co-organizer-invite') return run(item, () => CompetitionsAPI.declineOrganizerInvite(m.compId), 'Invitation declined.', 'rejected');
    return false;
  }

  async function markAllRead() {
    const res = await NotificationsAPI.markAllRead(username);
    if (!res.ok) { showToast(res.error || 'Unable to mark notifications as read.', 'error'); return; }
    showToast('All notifications marked as read.');
    load();
  }

  async function remove(item) {
    const res = await NotificationsAPI.delete(item.id);
    if (!res.ok) { showToast(res.error || 'Unable to delete the notification.', 'error'); return; }
    load();
  }

  return (
    <main className="main-content">
      <PageHeader
        title="Notifications"
        subtitle="Invitations, requests, results and payments."
        actions={<button type="button" className="btn-cancel" onClick={markAllRead} disabled={!counts.all}>Mark all read</button>}
      />

      <div className="search-wrap">
        <div className="search-inner">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5L18 18" />
          </svg>
          <input id="notif-search" type="search" aria-label="Search notifications" placeholder="Search by title, message or status…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="ui-tabs">
        {TABS.map((t) => (
          <button type="button" key={t.id} className={`ui-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}<span className="count">{counts[t.id]}</span></button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && items === null && <LoadingState label="Loading notifications…" />}
      {!error && items && visible.length === 0 && <EmptyState title={items.length ? 'Nothing in this view' : 'No notifications yet'} message="Team invitations, competition updates, results, payouts and refunds appear here." />}

      <div className="notif-list">
        {visible.map((item) => {
          const bucket = bucketOf(item);
          const link = linkOf(item);
          // Only these can be answered right here; other requests (e.g. finance reviews) open their page.
          const actionable = bucket === 'pending' && ANSWER_IN_PLACE.includes(item.type);
          return (
            <div key={item.id} className={`notif-item status-${bucket === 'info' ? 'info' : bucket}${item.read ? '' : ' unread'}`}>
              {!item.read && <div className="notif-dot" />}
              <div className={`notif-status-label status-${bucket === 'info' ? 'info' : bucket}-bg`}>{bucket === 'pending' ? 'ACTION' : bucket === 'info' ? (MONEY_TYPES.includes(item.type) ? 'PAYMENT' : 'UPDATE') : bucket.toUpperCase()}</div>
              <div className="notif-content-wrap">
                <div className="notif-title-row">
                  <h3>{item.title}</h3>
                  <span className="notif-time-alt">{formatDate(item.createdAt, true)}</span>
                </div>
                <p className="notif-body-text notif-body-multiline">{item.body}</p>
                <div className="notif-actions-row">
                  {actionable && item.type === 'team-join-payment' && (
                    <button type="button" className="btn-notif-accept" disabled={busy === item.id} onClick={() => accept(item)}>Pay {formatINR(item.meta?.amount)} and join</button>
                  )}
                  {actionable && item.type !== 'team-join-payment' && (
                    <>
                      <button type="button" className="btn-notif-accept" disabled={busy === item.id} onClick={() => accept(item)}>Accept</button>
                      <button type="button" className="btn-notif-reject" disabled={busy === item.id} onClick={() => decline(item)}>Decline</button>
                    </>
                  )}
                  {link && <Link className="notif-info-link" to={link.to} onClick={() => { if (!item.read) NotificationsAPI.markRead(item.id); }}>{link.label} →</Link>}
                  {!actionable && <button type="button" className="btn-table-secondary" onClick={() => remove(item)}>Delete</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {paying && (
        <PlayerFeeModal
          teamName={paying.meta?.teamName}
          feeAmount={paying.meta?.amount}
          busy={busy === paying.id}
          onCancel={() => setPaying(null)}
          onConfirm={async () => { const ok = await run(paying, () => TeamsAPI.payJoinRequest(paying.meta?.requestId), 'Payment received. You joined the team.', 'approved'); if (ok) setPaying(null); }}
        />
      )}
      <ConfirmDialog
        open={!!inviteFee}
        tone="primary"
        title="Accept invitation"
        message={inviteFee ? `Joining this team takes your ${formatINR(inviteFee.fee)} entry fee into escrow. It is refunded if you leave before the competition starts or if it is cancelled. (Mock mode: no real money moves.)` : ''}
        confirmLabel={inviteFee ? `Pay ${formatINR(inviteFee.fee)} and join` : 'Join'}
        onConfirm={async () => { const ok = await run(inviteFee.item, () => TeamsAPI.updateInvite(inviteFee.item.meta?.inviteId, 'accepted'), 'You joined the team.', 'approved'); if (ok) setInviteFee(null); }}
        onClose={() => setInviteFee(null)}
      />
    </main>
  );
}
