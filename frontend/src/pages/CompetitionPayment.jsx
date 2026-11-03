/**
 * NEXUS ESPORTS — Competition payments & escrow (organizer view).
 *
 * Walks the organizer through the money lifecycle in Payment_Architecture.md:
 * platform fee (publishes) → prize pool deposit → registrations held in escrow →
 * end competition → finance settlement. In mock mode every step is simulated.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PaymentMailbox from '../components/PaymentMailbox.jsx';
import { ConfirmAction, EscrowStats, LifecycleSteps, MockBanner, Notice, PayoutPreview, Pill, TransactionTable } from '../components/PaymentUI.jsx';
import { paymentRequest, loadCheckout, money, rupees, formatDateTime, competitionState, TERMINAL_STATES } from '../services/payments.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/admin/dashboard.css';
import '../styles/pages/payments.css';

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

export default function CompetitionPayment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id');
  const [ledger, setLedger] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fundNow, setFundNow] = useState(true);
  const [mailKey, setMailKey] = useState(0);

  const path = (suffix) => `/competitions/${encodeURIComponent(id)}/${suffix}`;
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const [s, l] = await Promise.all([paymentRequest(path('status')), paymentRequest(path('ledger'))]);
      setStatus(s); setLedger(l); setError('');
    } catch (err) { setError(err.message); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function run(work, success) {
    setBusy(true); setNotice(null);
    try {
      const result = await work();
      await refresh();
      setMailKey((k) => k + 1);
      if (result?.status === 'FAILED') { setNotice({ tone: 'warn', text: 'The simulated payment failed. Nothing was charged; you can retry.' }); return false; }
      if (success) { setNotice({ tone: 'success', text: success }); showToast(success); }
      return true;
    } catch (err) {
      setNotice({ tone: 'error', text: err.message }); showToast(err.message, 'error');
      return false;
    } finally { setBusy(false); }
  }

  async function payPlatformFee(outcome) {
    setBusy(true); setNotice(null);
    try {
      const order = await paymentRequest(path('initiate-platform-fee'), 'POST');
      if (order.provider !== 'mock') {
        await loadCheckout();
        const checkout = new window.Razorpay({
          key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
          name: 'NEXUS ESPORTS', description: 'Non-refundable competition platform fee',
          handler: () => { setBusy(false); setNotice({ tone: 'success', text: 'Checkout finished. Waiting for the server to confirm the payment; you can safely leave this page.' }); refresh(); },
          modal: { ondismiss: () => setBusy(false) },
        });
        checkout.on('payment.failed', () => { setBusy(false); setNotice({ tone: 'error', text: 'Payment was not confirmed. Retry or refresh the payment status.' }); });
        checkout.open();
        return;
      }
      const result = await paymentRequest(path('mock-payment'), 'POST', { outcome });
      if (result.status === 'FAILED') {
        setNotice({ tone: 'warn', text: 'The simulated payment failed. Your draft is saved and nothing was charged; you can retry.' });
      } else {
        let text = 'Platform fee paid (simulated). Your competition is now published.';
        if (fundNow && Number(ledger?.prizePoolAmount) > 0) {
          const prize = await paymentRequest(path('pay-prize-pool'), 'POST', { outcome: 'success' });
          if (prize.status !== 'FAILED') text = 'Platform fee and prize pool paid (simulated). Your competition is published and players are protected.';
        }
        setNotice({ tone: 'success', text }); showToast(text);
      }
      setBusy(false);
      await refresh();
      setMailKey((k) => k + 1);
    } catch (err) { setBusy(false); setNotice({ tone: 'error', text: err.message }); showToast(err.message, 'error'); }
  }

  if (!id) return <main className="admin-page pay-page"><Notice tone="error">No competition selected. Open payments from My Activity or the competition page.</Notice></main>;

  const state = competitionState(ledger?.paymentStatus);
  const closed = TERMINAL_STATES.includes(ledger?.paymentStatus);
  const draft = ledger?.paymentStatus === 'AWAITING_PLATFORM_FEE';
  const completed = ledger?.paymentStatus === 'COMPLETED';
  const mock = status?.provider === 'mock';
  const canAct = ledger?.owner;
  const deadlinePassed = ledger?.prizeDeadline && new Date(ledger.prizeDeadline) <= new Date();
  const distribution = ledger?.prizeDistributionMinor || [];

  return (
    <main className="admin-page pay-page">
      <div className="admin-header-block pay-header">
        <div>
          <Link to="/pages/my-activity.html" className="pay-back">← My activity</Link>
          <h1 className="admin-title-xl" style={{ marginTop: 8 }}>Payments &amp; Escrow</h1>
          <div className="pay-header-meta">
            <span className="admin-subtitle-muted" style={{ marginTop: 0 }}>{ledger?.competition || 'Loading…'}</span>
            {ledger && <Pill tone={state.tone}>{state.label}</Pill>}
            {ledger?.financeHold && <Pill tone="warn">Finance hold</Pill>}
          </div>
        </div>
        <div className="pay-actions">
          {ledger?.platformFeePaid && <Link className="pay-btn ghost" to={`/pages/competition-detail.html?id=${encodeURIComponent(id)}`}>View competition</Link>}
          {ledger?.canModerate && <Link className="pay-btn" to={`/pages/admin/finance.html?id=${encodeURIComponent(id)}`}>Open finance case</Link>}
        </div>
      </div>

      {mock && <MockBanner />}
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {!ledger && !error && <div className="pay-empty">Loading payment status…</div>}

      {ledger && <>
        <LifecycleSteps ledger={ledger} />

        {closed && (
          <Notice tone={ledger.paymentStatus === 'PRIZE_RELEASED' ? 'success' : 'warn'}>
            {ledger.paymentStatus === 'PRIZE_RELEASED' && <><strong>Settled.</strong> Prizes were paid to the winners and registration revenue was released to you.</>}
            {ledger.paymentStatus === 'REVERSED' && <><strong>Settlement reversed by finance.</strong> Released registration revenue was recovered and refunded to players. {ledger.abandonedReason && `Reason: ${ledger.abandonedReason}`}</>}
            {['REFUND_ISSUED', 'CANCELLED', 'ABANDONED'].includes(ledger.paymentStatus) && <><strong>Cancelled.</strong> {ledger.abandonedReason && `Reason: ${ledger.abandonedReason}. `}{ledger.platformFeePaid ? 'Registration fees were refunded to players in full. The platform fee is non-refundable.' : 'Nothing was charged.'}</>}
            {ledger.paymentStatus === 'EXPIRED' && <><strong>Draft expired.</strong> The platform fee was not paid in time. Nothing was charged; create a new competition to try again.</>}
          </Notice>
        )}

        {ledger.platformFeePaid && <EscrowStats ledger={ledger} />}

        <div className="pay-grid">
          {/* 1 — Platform fee */}
          <section className={`pay-card ${draft ? 'highlight' : ''}`} aria-labelledby="pf-title">
            <div className="pay-card-head">
              <h2 className="pay-card-title" id="pf-title">Platform fee</h2>
              <Pill tone={ledger.platformFeePaid ? 'ok' : draft ? 'warn' : 'muted'}>{ledger.platformFeePaid ? 'Paid' : draft ? 'Due now' : 'Unpaid'}</Pill>
            </div>
            <div className="pay-amount">{rupees(ledger.platformFeeAmount)}</div>
            <p className="pay-card-text">Publishes your competition. Calculated as the greater of the platform minimum or a percentage of the prize pool. <strong style={{ color: 'var(--text-light)' }}>Non-refundable</strong>, even if you cancel later.</p>
            {draft && canAct && <>
              {Number(ledger.prizePoolAmount) > 0 && (
                <label className="pay-check">
                  <input type="checkbox" checked={fundNow} onChange={(e) => setFundNow(e.target.checked)} />
                  <span>Also deposit the {rupees(ledger.prizePoolAmount)} prize pool now (recommended — players see the prize is secured)</span>
                </label>
              )}
              <div className="pay-actions">
                <button type="button" className="pay-btn" disabled={busy} onClick={() => payPlatformFee('success')}>
                  {busy ? 'Processing…' : mock ? `Simulate payment · ${rupees(Number(ledger.platformFeeAmount) + (fundNow ? Number(ledger.prizePoolAmount) || 0 : 0))}` : 'Pay platform fee'}
                </button>
                {mock && <button type="button" className="pay-btn ghost" disabled={busy} onClick={() => payPlatformFee('failed')}>Simulate failed payment</button>}
              </div>
              <ConfirmAction label="Discard draft" variant="danger" requireReason busy={busy}
                description="Discarding an unpaid draft charges nothing and does not affect your trust score."
                onConfirm={(note) => run(() => paymentRequest(path('cancel'), 'POST', { note }), 'Draft discarded.').then((ok) => { if (ok) navigate('/pages/my-activity.html'); return ok; })} />
            </>}
            {ledger.platformFeePaid && <p className="pay-card-text">Your competition is live and accepting registrations.</p>}
          </section>

          {/* 2 — Prize pool */}
          <section className="pay-card" aria-labelledby="pp-title">
            <div className="pay-card-head">
              <h2 className="pay-card-title" id="pp-title">Prize pool</h2>
              <Pill tone={ledger.prizePoolPaid ? 'ok' : closed ? 'muted' : 'warn'}>{ledger.prizePoolPaid ? 'Locked in escrow' : closed ? 'Not funded' : 'Awaiting deposit'}</Pill>
            </div>
            <div className="pay-amount muted">{rupees(ledger.prizePoolAmount)}</div>
            <dl className="pay-dl">
              <dt>Funding deadline</dt><dd>{formatDateTime(ledger.prizeDeadline)}</dd>
              {ledger.prizePoolPaidAt && <><dt>Deposited</dt><dd>{formatDateTime(ledger.prizePoolPaidAt)}</dd></>}
              {distribution.map((amount, i) => <Fragment key={i}><dt>{ordinal(i + 1)} place</dt><dd>{money(amount)}</dd></Fragment>)}
            </dl>
            {!ledger.prizePoolPaid && !closed && <p className="pay-card-text">Deposit any time after publishing. If it is not funded by the deadline the competition is <strong style={{ color: 'var(--text-light)' }}>cancelled automatically</strong>, every team is refunded and your platform fee is forfeited.</p>}
            {!ledger.prizePoolPaid && !closed && !draft && canAct && (
              <div className="pay-actions">
                <button type="button" className="pay-btn" disabled={busy || deadlinePassed} onClick={() => run(() => paymentRequest(path('pay-prize-pool'), 'POST', { outcome: 'success' }), 'Prize pool deposited into escrow (simulated).')}>{mock ? 'Simulate deposit' : 'Deposit prize pool'}</button>
                {mock && <button type="button" className="pay-btn ghost" disabled={busy || deadlinePassed} onClick={() => run(() => paymentRequest(path('pay-prize-pool'), 'POST', { outcome: 'failed' }))}>Simulate failed deposit</button>}
              </div>
            )}
          </section>

          {/* 3 — End & settle */}
          {ledger.platformFeePaid && (
            <section className="pay-card" aria-labelledby="end-title">
              <div className="pay-card-head">
                <h2 className="pay-card-title" id="end-title">End &amp; settle</h2>
                {completed && <Pill tone="info">Awaiting finance</Pill>}
              </div>
              <p className="pay-card-text">
                {completed
                  ? `Results are final. Players can dispute them until ${formatDateTime(ledger.disputeWindowEndsAt)}. After that a finance moderator reviews them; once approved, each prize is split equally between the winning team's players and the registration revenue held in escrow is released to you.`
                  : 'After every fixture is played and verified, end the competition. Registration fees stay in escrow until a finance moderator approves the payout.'}
              </p>
              {ledger.financeHold && <Notice tone="warn">Finance has placed this competition on hold while it reviews a concern. Payouts are paused.</Notice>}
              <PayoutPreview preview={ledger.payoutPreview} />
              {!closed && !completed && canAct && <>
                <div className="pay-actions">
                  <ConfirmAction label="End competition & request payout" busy={busy} disabled={!ledger.canEnd || !!ledger.payoutPreview?.error}
                    description="This locks the results and sends them to finance for payout review. You cannot cancel afterwards."
                    onConfirm={() => run(() => paymentRequest(path('end'), 'POST'), 'Results submitted. Finance will review and release payouts.')} />
                </div>
                {!ledger.canEnd && <span className="pay-hint">{!ledger.prizePoolPaid ? 'Deposit the prize pool first.' : !ledger.started ? `Available once the competition starts (${formatDateTime(ledger.startDate)}).` : ''}</span>}
              </>}
            </section>
          )}

          {/* 4 — Cancel */}
          {ledger.platformFeePaid && !closed && !completed && canAct && (
            <section className="pay-card danger" aria-labelledby="cancel-title">
              <h2 className="pay-card-title" id="cancel-title">Cancel competition</h2>
              <p className="pay-card-text">Every registered player is refunded in full from escrow. Your platform fee is forfeited and your organizer trust score drops by 10. {ledger.prizePoolPaid && (ledger.totalRegistrations ? 'Because players registered, your prize pool is held for finance review.' : 'With no registrations, your prize pool is returned to you.')}</p>
              <ConfirmAction label="Cancel & refund players" confirmLabel="Yes, cancel and refund" variant="danger" requireReason busy={busy}
                description="Players will receive an apology email with their refund reference."
                onConfirm={(note) => run(() => paymentRequest(path('cancel'), 'POST', { note }), 'Competition cancelled. All registration fees were refunded (simulated).')} />
            </section>
          )}
          {/* Mock-only testing tool: skip the wait until the start date. */}
          {mock && canAct && ledger.platformFeePaid && !closed && !ledger.started && (
            <section className="pay-card" aria-labelledby="test-title" style={{ borderStyle: 'dashed' }}>
              <div className="pay-card-head">
                <h2 className="pay-card-title" id="test-title">Testing tools</h2>
                <Pill tone="accent">Mock only</Pill>
              </div>
              <p className="pay-card-text">Moves the start date to now so you can test ending and settlement without waiting. Registration closes immediately. {!ledger.prizePoolPaid && <strong style={{ color: '#fbbf24' }}>The prize pool is unfunded, so the next deadline check will auto-cancel this competition and refund every team.</strong>}</p>
              <ConfirmAction label="Start competition now" variant="ghost" busy={busy}
                description="Registration will close and the start date becomes now."
                onConfirm={() => run(() => paymentRequest(path('mock/start-now'), 'POST'), 'Competition started (testing tool). Record the results, then end it.')} />
            </section>
          )}
        </div>

        <section className="table-container-card" aria-labelledby="tx-title">
          <div className="table-header-between">
            <h2 className="table-title-md" id="tx-title" style={{ margin: 0 }}>Ledger</h2>
            <button type="button" className="pay-btn ghost sm" onClick={refresh}>Refresh</button>
          </div>
          <TransactionTable items={ledger.transactions} empty="No money has moved yet." />
        </section>

        <PaymentMailbox title="Competition emails" competitionId={id} refreshKey={mailKey} showAlerts={false} allRecipients={ledger.canModerate} />
      </>}
    </main>
  );
}
