/**
 * NEXUS ESPORTS — Finance moderation console.
 *
 * The finance moderator is the neutral party between organizers and players:
 * they approve escrow releases after verified results, place holds on suspicious
 * competitions, force-cancel with full refunds, distribute forfeited prize pools
 * and reverse settlements when fraud is proven. Every action needs a reason and
 * lands in the admin audit log. All money movement is simulated in mock mode.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PaymentMailbox from '../../components/PaymentMailbox.jsx';
import { ConfirmAction, EscrowStats, LifecycleSteps, MockBanner, Notice, PayoutPreview, Pill, TransactionTable } from '../../components/PaymentUI.jsx';
import { paymentRequest, money, rupees, formatDateTime, competitionState, TERMINAL_STATES, TX_TYPES } from '../../services/payments.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/admin/dashboard.css';
import '../../styles/pages/payments.css';

const LOW_TRUST = 60;

/** Why a competition needs a finance moderator's attention (empty = nothing to do). */
function reasons(c) {
  const out = [];
  const closed = TERMINAL_STATES.includes(c.paymentStatus);
  if (c.paymentStatus === 'COMPLETED') {
    if (c.openDisputes > 0) out.push({ tone: 'bad', label: `${c.openDisputes} open dispute${c.openDisputes > 1 ? 's' : ''}` });
    else if (c.financeHold) out.push({ tone: 'warn', label: 'Completed · on hold' });
    else if (c.disputeWindowEndsAt && new Date(c.disputeWindowEndsAt) > new Date()) out.push({ tone: 'info', label: `Dispute window until ${formatDateTime(c.disputeWindowEndsAt)}` });
    else out.push({ tone: 'accent', label: 'Ready to settle' });
  } else if (c.financeHold) out.push({ tone: 'warn', label: 'On hold' });
  if (c.overdue) out.push({ tone: 'bad', label: 'Past end date · not ended' });
  if (c.escrow?.status === 'HELD') out.push({ tone: 'warn', label: `Held prize ${money(c.escrow.balanceMinor)}` });
  if (!closed && c.organizerPaid && !c.prizePoolPaid) out.push({ tone: 'warn', label: `Prize unfunded · due ${formatDateTime(c.prizeDeadline)}` });
  if (!closed && Number(c.organizerTrustScore) < LOW_TRUST) out.push({ tone: 'bad', label: `Low-trust organizer (${c.organizerTrustScore})` });
  return out;
}

function NoteForm({ tx, onDone }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  if (!tx) return null;
  return (
    <form className="pay-confirm" style={{ margin: 16 }} onSubmit={async (event) => {
      event.preventDefault(); setSaving(true);
      try { await paymentRequest(`/transactions/${tx.id}/review`, 'POST', { note }); showToast('Reconciliation note saved to the audit log.'); onDone(); }
      catch (err) { showToast(err.message, 'error'); }
      finally { setSaving(false); }
    }}>
      <label className="pay-label" htmlFor="tx-note">Reconciliation note · {TX_TYPES[tx.type] || tx.type} · {money(tx.amountMinor)} · @{tx.userUsername}</label>
      <textarea id="tx-note" className="pay-textarea" required maxLength={2000} value={note} autoFocus onChange={(e) => setNote(e.target.value)} />
      <div className="pay-actions">
        <button className="pay-btn" disabled={saving || !note.trim()}>{saving ? 'Saving…' : 'Save note'}</button>
        <button type="button" className="pay-btn ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

/** Lets neutral finance restore or lower an organizer's trust score, with an audited reason. */
function TrustReview({ ledger, busy, act }) {
  const current = Number(ledger.organizerTrustScore ?? 100);
  const [score, setScore] = useState(String(current));
  const fieldId = useId();
  useEffect(() => { setScore(String(current)); }, [current]);
  const value = Number(score);
  const valid = score.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 100 && value !== current;
  return (
    <section className={`pay-card ${current < 50 ? 'highlight' : ''}`}>
      <h3 className="pay-card-title">Organizer trust score</h3>
      <p className="pay-card-text">@{ledger.organizer} is at <strong>{current}</strong>. Below 50 they cannot create competitions. Cancellations cost 10 points and proven fraud 25. Restore points when a cancellation was not their fault.</p>
      <label className="pay-label" htmlFor={fieldId}>New score (0–100)</label>
      <input id={fieldId} className="pay-textarea" style={{ minHeight: 0, maxWidth: 140 }} type="number" min="0" max="100" step="1" inputMode="numeric" value={score} onChange={(e) => setScore(e.target.value)} />
      <ConfirmAction label="Update trust score" requireReason minLength={10} busy={busy} disabled={!valid}
        description={`Changes @${ledger.organizer}'s score from ${current} to ${valid ? value : '…'}. They are notified with your reason.`}
        onConfirm={(reason) => act('organizer-trust', { score: value, reason }, `Trust score updated to ${value}.`)} />
    </section>
  );
}

function FinanceCase({ id, onClose, onChanged }) {
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [noteTx, setNoteTx] = useState(null);
  const [mailKey, setMailKey] = useState(0);
  const path = (suffix) => `/competitions/${encodeURIComponent(id)}/${suffix}`;

  const load = useCallback(async () => {
    try { setLedger(await paymentRequest(path('ledger'))); setError(''); }
    catch (err) { setError(err.message); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { setLedger(null); setNotice(null); load(); }, [load]);

  async function act(suffix, body, success) {
    setBusy(true); setNotice(null);
    try {
      await paymentRequest(path(suffix), 'POST', body);
      await load(); onChanged(); setMailKey((k) => k + 1);
      setNotice({ tone: 'success', text: success }); showToast(success);
      return true;
    } catch (err) {
      setNotice({ tone: 'error', text: err.message }); showToast(err.message, 'error');
      return false;
    } finally { setBusy(false); }
  }

  if (error) return <Notice tone="error">{error} <button type="button" className="pay-btn ghost sm" onClick={onClose}>Back to queue</button></Notice>;
  if (!ledger) return <div className="pay-empty">Loading case…</div>;

  const state = competitionState(ledger.paymentStatus);
  const closed = TERMINAL_STATES.includes(ledger.paymentStatus);
  const completed = ledger.paymentStatus === 'COMPLETED';
  const windowOpen = !!ledger.disputeWindowEndsAt && new Date(ledger.disputeWindowEndsAt) > new Date();
  const checklist = [
    { ok: completed || ledger.paymentStatus === 'PRIZE_RELEASED', label: 'Organizer submitted final results' },
    { ok: (completed || ledger.paymentStatus === 'PRIZE_RELEASED') && !windowOpen, label: windowOpen ? `Players can dispute until ${formatDateTime(ledger.disputeWindowEndsAt)}` : 'Dispute window closed' },
    { ok: ledger.prizePoolPaid, label: 'Prize pool deposited in escrow' },
    { ok: !ledger.financeHold, label: 'No finance hold' },
    { ok: !ledger.openDisputes, label: ledger.openDisputes ? `${ledger.openDisputes} dispute(s) still open` : 'All disputes resolved' },
  ];
  const ready = completed && checklist.every((item) => item.ok);

  return (
    <section aria-labelledby="case-title" style={{ marginBottom: 40 }}>
      <div className="pay-card highlight" style={{ marginBottom: 20 }}>
        <div className="pay-card-head">
          <div>
            <span className="pay-label">Finance case</span>
            <h2 className="admin-title-xl" id="case-title" style={{ fontSize: 28, marginTop: 4 }}>{ledger.competition}</h2>
            <div className="pay-header-meta">
              <Pill tone={state.tone}>{state.label}</Pill>
              {ledger.financeHold && <Pill tone="warn">On hold</Pill>}
              <span className="pay-card-text">Organizer @{ledger.organizer} · trust score <strong style={{ color: Number(ledger.organizerTrustScore) < LOW_TRUST ? '#f87171' : 'var(--text-white)' }}>{ledger.organizerTrustScore}</strong></span>
            </div>
          </div>
          <div className="pay-actions">
            <Link className="pay-btn ghost sm" to={`/pages/competition-detail.html?id=${encodeURIComponent(id)}`}>Competition</Link>
            <button type="button" className="pay-btn ghost sm" onClick={onClose}>Back to queue</button>
          </div>
        </div>
        <dl className="pay-dl">
          <dt>Starts</dt><dd>{formatDateTime(ledger.startDate)}</dd>
          <dt>Prize funding deadline</dt><dd>{formatDateTime(ledger.prizeDeadline)}</dd>
          <dt>Platform fee</dt><dd>{rupees(ledger.platformFeeAmount)} · {ledger.platformFeePaid ? 'paid' : 'unpaid'}</dd>
          <dt>Entry fee</dt><dd>{ledger.feeType === 'free' || !ledger.entryFeeAmount ? 'Free' : `${rupees(ledger.entryFeeAmount)} ${ledger.feeType === 'per_player' ? 'per player' : 'per team'}`}</dd>
          {ledger.abandonedReason && <><dt>Reason on record</dt><dd>{ledger.abandonedReason}</dd></>}
        </dl>
      </div>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <LifecycleSteps ledger={ledger} />
      <EscrowStats ledger={ledger} />

      <div className="pay-grid">
        {(completed || ledger.paymentStatus === 'PRIZE_RELEASED') && (
          <section className={`pay-card ${ready ? 'highlight' : ''}`}>
            <h3 className="pay-card-title">Settlement</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {checklist.map((item) => (
                <li key={item.label} className="pay-card-text" style={{ color: item.ok ? 'var(--text-light)' : '#fbbf24' }}>
                  <span aria-hidden="true">{item.ok ? '✓' : '•'}</span> {item.label}
                </li>
              ))}
            </ul>
            {completed && <>
              <Notice tone={ready ? 'info' : 'warn'}>
                <strong>Not paid out yet.</strong> {money(ledger.escrow?.balanceMinor)} is still held in escrow. Nothing moves until you click <strong>Approve &amp; release payouts</strong>; leaving this case does not settle it.
                {windowOpen && <> Approval unlocks when the dispute window closes ({formatDateTime(ledger.disputeWindowEndsAt)}). For testing, use <strong>Close dispute window now</strong>.</>}
              </Notice>
              <PayoutPreview preview={ledger.payoutPreview} />
              <p className="pay-card-text">Approving pays each prize position to the winning team, split equally between its players, and releases {money(ledger.escrow?.registrationsMinor - (ledger.escrow?.refundsMinor || 0))} of registration revenue to the organizer. Before releasing, the server re-checks the final standings, that every registered team was scheduled, and that no organizer is on a winning team. Every winner, refunded player and the organizer gets a notification.</p>
              {windowOpen && <ConfirmAction label="Close dispute window now (testing)" variant="ghost" busy={busy}
                description="Mock-only testing tool: ends the dispute window early so you can test settlement."
                onConfirm={() => act('mock/close-dispute-window', undefined, 'Dispute window closed (testing tool).')} />}
              <ConfirmAction label="Approve & release payouts" busy={busy} disabled={!ready}
                description="This releases the escrow. It can only be undone by a fraud reversal."
                onConfirm={() => act('settle', undefined, 'Escrow released: prizes paid and registration revenue sent to the organizer (simulated).')} />
            </>}
            {ledger.paymentStatus === 'PRIZE_RELEASED' && <Notice tone="success"><strong>Settled.</strong> Escrow balance is {money(ledger.escrow?.balanceMinor)}: prizes went to the winners, registration revenue to the organizer{ledger.escrow?.refundsMinor ? ', and refunds/returns were paid out' : ''}. Everyone involved was notified.</Notice>}
          </section>
        )}

        {ledger.overdue && (
          <section className="pay-card highlight">
            <h3 className="pay-card-title">Overdue</h3>
            <p className="pay-card-text">The end date ({formatDateTime(ledger.endDate)}) has passed but the organizer has not ended the competition, so players' money is stuck in escrow. If every fixture is complete, end it on the organizer's behalf; otherwise force-cancel to refund the players.</p>
            <ConfirmAction label="End on organizer's behalf" busy={busy} disabled={!ledger.canEnd}
              description="Locks the results and opens the dispute window, exactly as if the organizer had ended it."
              onConfirm={() => act('end', undefined, 'Competition ended on the organizer’s behalf. The dispute window is open.')} />
          </section>
        )}

        {!closed && (
          <section className="pay-card">
            <h3 className="pay-card-title">{ledger.financeHold ? 'Remove hold' : 'Place hold'}</h3>
            <p className="pay-card-text">{ledger.financeHold ? 'Lift the hold once the concern is resolved so settlement can proceed.' : 'Pause any payout while you investigate a complaint, suspicious results or a payment mismatch.'}</p>
            <ConfirmAction label={ledger.financeHold ? 'Remove hold' : 'Place hold'} variant={ledger.financeHold ? 'primary' : 'ghost'} requireReason busy={busy}
              onConfirm={(reason) => act('hold', { held: !ledger.financeHold, reason }, ledger.financeHold ? 'Finance hold removed.' : 'Finance hold placed. Payouts are paused.')} />
          </section>
        )}

        <TrustReview ledger={ledger} busy={busy} act={act} />

        {ledger.escrow?.status === 'HELD' && (
          <section className="pay-card highlight">
            <h3 className="pay-card-title">Held prize funds</h3>
            <p className="pay-card-text">The organizer cancelled after players registered, so their deposited prize pool ({money(ledger.escrow.balanceMinor)}) was frozen. Distribute it equally to the affected players as compensation.</p>
            <ConfirmAction label="Compensate registered players" requireReason busy={busy}
              onConfirm={(note) => act('release-held-prize', { note }, 'Held prize pool distributed to registered players (simulated).')} />
          </section>
        )}

        {!closed && ledger.platformFeePaid && (
          <section className="pay-card danger">
            <h3 className="pay-card-title">Force-cancel</h3>
            <p className="pay-card-text">For abandoned or fraudulent competitions. Every player is refunded in full from escrow, the organizer forfeits the platform fee and loses 10 trust points.</p>
            <ConfirmAction label="Force-cancel & refund all" confirmLabel="Cancel and refund" variant="danger" requireReason busy={busy}
              onConfirm={(note) => act('cancel', { note }, 'Competition cancelled. All registration fees refunded (simulated).')} />
          </section>
        )}

        {ledger.paymentStatus === 'PRIZE_RELEASED' && (
          <section className="pay-card danger">
            <h3 className="pay-card-title">Fraud reversal</h3>
            <p className="pay-card-text">Use only when fraud is proven after settlement. Released registration revenue is clawed back from the organizer and refunded to every player. Winner payouts are not touched. The organizer loses 25 trust points.</p>
            <ConfirmAction label="Reverse settlement" confirmLabel="Reverse and refund players" variant="danger" requireReason minLength={15} busy={busy}
              onConfirm={(note) => act('reverse', { note }, 'Settlement reversed. Players refunded from the clawback (simulated).')} />
          </section>
        )}
      </div>

      <section className="table-container-card">
        <div className="table-header-between">
          <h3 className="table-title-md" style={{ margin: 0 }}>Case ledger</h3>
          <button type="button" className="pay-btn ghost sm" onClick={load}>Refresh</button>
        </div>
        <NoteForm tx={noteTx} onDone={() => setNoteTx(null)} />
        <TransactionTable items={ledger.transactions} onNote={setNoteTx} empty="No ledger entries for this competition." />
      </section>

      <PaymentMailbox title="Case emails" competitionId={id} allRecipients showAlerts={false} refreshKey={mailKey} />
    </section>
  );
}

function LedgerTab({ names }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [type, setType] = useState('ALL');
  const [noteTx, setNoteTx] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    paymentRequest(`/transactions?page=${page}`).then((r) => { if (active) { setData(r); setError(''); } }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [page, reload]);
  const items = (data?.items || []).filter((tx) => type === 'ALL' || tx.type === type).map((tx) => ({ ...tx, competitionName: names.get(tx.competitionId) }));
  return (
    <section className="table-container-card">
      <div className="table-header-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h2 className="table-title-md" style={{ margin: 0 }}>All transactions</h2>
        <div className="pay-toolbar">
          <label className="sr-only" htmlFor="ledger-type">Filter by type</label>
          <select id="ledger-type" className="pay-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ALL">All types</option>
            {Object.entries(TX_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button type="button" className="pay-btn ghost sm" onClick={() => setReload((v) => v + 1)}>Refresh</button>
        </div>
      </div>
      {error && <div className="pay-notice error" role="alert" style={{ margin: 16 }}>{error}</div>}
      <NoteForm tx={noteTx} onDone={() => setNoteTx(null)} />
      {!data && !error ? <div className="pay-empty">Loading transactions…</div> : <TransactionTable items={items} showCompetition onNote={setNoteTx} empty={type === 'ALL' ? 'No payment transactions yet.' : 'No transactions of this type on this page.'} />}
      {data && (
        <div className="pay-footer-row">
          <span>{data.total} transactions · page {page} of {Math.max(1, Math.ceil(data.total / data.limit))}</span>
          <div className="pay-actions">
            <button type="button" className="btn-table-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <button type="button" className="btn-table-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </div>
      )}
    </section>
  );
}

function CompetitionsTable({ items, onOpen, empty, showReasons }) {
  if (!items.length) return <div className="pay-empty">{empty}</div>;
  return (
    <div className="table-scroll-wrap" style={{ overflowX: 'auto' }}>
      <table className="admin-table">
        <thead><tr><th>Competition</th><th>Organizer</th><th>{showReasons ? 'Needs attention' : 'Status'}</th><th>Prize pool</th><th>In escrow</th><th>Starts</th></tr></thead>
        <tbody>
          {items.map((c) => {
            const state = competitionState(c.paymentStatus);
            return (
              <tr key={c.id}>
                <td><button type="button" className="pay-row-button" onClick={() => onOpen(c.id)}>{c.name}</button></td>
                <td>@{c.createdBy} <span className="pay-hint">· trust {c.organizerTrustScore}</span></td>
                <td>{showReasons
                  ? <div className="pay-reasons">{reasons(c).map((r) => <Pill key={r.label} tone={r.tone}>{r.label}</Pill>)}</div>
                  : <div className="pay-reasons"><Pill tone={state.tone}>{state.label}</Pill>{c.financeHold && <Pill tone="warn">Hold</Pill>}</div>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{rupees(c.prize)} {c.prizePoolPaid ? <Pill tone="ok">funded</Pill> : <Pill tone="muted">unfunded</Pill>}</td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--accent)', fontWeight: 700 }}>{money(c.escrow?.balanceMinor)}</td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>{formatDateTime(c.startDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function FinanceModerator() {
  const [params, setParams] = useSearchParams();
  const caseId = params.get('id');
  const tab = params.get('tab') || 'queue';
  const [competitions, setCompetitions] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let active = true;
    paymentRequest('/competitions').then((r) => { if (active) { setCompetitions(r); setError(''); } }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [reload]);

  const all = competitions || [];
  const queue = useMemo(() => all.filter((c) => reasons(c).length), [all]);
  const names = useMemo(() => new Map(all.map((c) => [c.id, c.name])), [all]);
  const filtered = all.filter((c) => (statusFilter === 'ALL' || c.paymentStatus === statusFilter) && (!query.trim() || `${c.name} ${c.createdBy}`.toLowerCase().includes(query.trim().toLowerCase())));
  const escrowTotal = all.reduce((sum, c) => sum + (c.escrow?.balanceMinor || 0), 0);
  const readyCount = all.filter((c) => c.paymentStatus === 'COMPLETED' && !c.financeHold && !c.openDisputes && !(c.disputeWindowEndsAt && new Date(c.disputeWindowEndsAt) > new Date())).length;
  const riskCount = all.filter((c) => !TERMINAL_STATES.includes(c.paymentStatus) && ((c.organizerPaid && !c.prizePoolPaid) || c.financeHold || c.overdue || c.escrow?.status === 'HELD')).length;
  const settledCount = all.filter((c) => c.paymentStatus === 'PRIZE_RELEASED').length;

  const openCase = (id) => { setParams({ tab, id }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const setTab = (next) => setParams(caseId ? { tab: next, id: caseId } : { tab: next });
  const tabs = [['queue', 'Action queue', queue.length], ['competitions', 'Competitions', all.length], ['ledger', 'Ledger'], ['mail', 'Mailbox']];

  return (
    <main className="admin-page pay-page">
      <div className="admin-header-block pay-header">
        <div>
          <h1 className="admin-title-xl">Finance Moderation</h1>
          <p className="admin-subtitle-muted">Escrow oversight: approve payouts after verified results, hold suspicious competitions, refund players and reverse proven fraud.</p>
        </div>
        <div className="pay-actions">
          <button type="button" className="pay-btn ghost" title="Testing tool: sends due prize reminders, auto-cancels unfunded competitions and expires old drafts now instead of waiting for the next scheduled run." onClick={async () => {
            try { await paymentRequest('/mock/run-deadlines', 'POST'); showToast('Deadline check finished.'); setReload((v) => v + 1); }
            catch (err) { showToast(err.message, 'error'); }
          }}>Run deadline check now</button>
          <button type="button" className="pay-btn ghost" onClick={() => setReload((v) => v + 1)}>Refresh</button>
        </div>
      </div>

      <MockBanner>Mock payment mode: payouts, refunds and clawbacks are ledger entries only. No bank transfers happen and no emails are sent. Every action you take is recorded in the admin audit log with your reason.</MockBanner>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="dash-stats">
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-wrap" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14 }}>₹</div><div><div className="dash-stat-num">{money(escrowTotal)}</div><div className="dash-stat-lbl">Held in escrow</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-info" style={{ color: '#64c8ff', fontWeight: 800, fontSize: 13 }}>RS</div><div><div className="dash-stat-num">{readyCount}</div><div className="dash-stat-lbl">Ready to settle</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#fbbf24', fontWeight: 800, fontSize: 15 }}>!</div><div><div className="dash-stat-num">{riskCount}</div><div className="dash-stat-lbl">At risk / on hold</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-success" style={{ color: '#4ade80', fontWeight: 800, fontSize: 15 }}>✓</div><div><div className="dash-stat-num">{settledCount}</div><div className="dash-stat-lbl">Settled</div></div></div>
      </div>

      {caseId && <FinanceCase id={caseId} onClose={() => setParams({ tab })} onChanged={() => setReload((v) => v + 1)} />}

      <div className="pay-tabs" role="tablist" aria-label="Finance views">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" className="pay-tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}{count !== undefined && <span className="pay-tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <section className="table-container-card" role="tabpanel">
          <div className="table-header-between"><h2 className="table-title-md" style={{ margin: 0 }}>Needs attention</h2></div>
          {!competitions && !error ? <div className="pay-empty">Loading queue…</div> : <CompetitionsTable items={queue} onOpen={openCase} showReasons empty="Nothing needs finance attention right now." />}
        </section>
      )}

      {tab === 'competitions' && (
        <section className="table-container-card" role="tabpanel">
          <div className="table-header-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <h2 className="table-title-md" style={{ margin: 0 }}>Payment-managed competitions</h2>
            <div className="pay-toolbar">
              <label className="sr-only" htmlFor="fin-search">Search competitions</label>
              <input id="fin-search" className="pay-search" type="search" placeholder="Search name or organizer" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label className="sr-only" htmlFor="fin-status">Filter by status</label>
              <select id="fin-status" className="pay-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option>
                {['AWAITING_PLATFORM_FEE', 'OPEN_FOR_REGISTRATION', 'COMPLETED', ...TERMINAL_STATES].map((s) => <option key={s} value={s}>{competitionState(s).label}</option>)}
              </select>
            </div>
          </div>
          {!competitions && !error ? <div className="pay-empty">Loading competitions…</div> : <CompetitionsTable items={filtered} onOpen={openCase} empty="No competitions match these filters." />}
        </section>
      )}

      {tab === 'ledger' && <LedgerTab names={names} />}
      {tab === 'mail' && <PaymentMailbox title="All platform emails" allRecipients showAlerts={false} />}
    </main>
  );
}
