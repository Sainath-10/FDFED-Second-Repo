/**
 * NEXUS ESPORTS — Finance moderation console.
 *
 * Two tabs:
 *  - Competitions: prize pools above ₹10,00,000 waiting for approval (with the
 *    organiser's contact details and their own prize-pool limit);
 *  - End Requests: organisers asking to end a started competition early, and
 *    finished competitions waiting for the prize payout.
 * "Review case" opens the case page (?id=): the case summary, its lifecycle and
 * escrow, the early-end decision and, once the competition has ended, the
 * payout. Every action needs a reason and lands in the admin audit log. All
 * money movement is simulated in mock mode.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ConfirmAction, EscrowStats, LifecycleSteps, MockBanner, Notice, PayoutPreview, Pill } from '../../components/PaymentUI.jsx';
import { paymentRequest, money, rupees, formatDateTime, competitionState, TERMINAL_STATES, largePrizeRequests, reviewLargePrize, reviewEarlyEnd } from '../../services/payments.js';
import { showToast } from '../../lib/toast.js';
import { LEVEL_META } from '../../lib/reporting.js';
import { DisputesAPI } from '../../services/api.js';
import { StaffDisputeCard } from './AdminDisputes.jsx';
import '../../styles/pages/admin/dashboard.css';
import '../../styles/pages/payments.css';

const LOW_TRUST = 60;

/** Finished competitions whose prizes still have to be released. */
const awaitingPayout = (c) => c.paymentStatus === 'COMPLETED';

/** Approve / reject with a note the organiser sees. */
function Decision({ busy, approveLabel, rejectLabel, approveText, onDecide }) {
  return (
    <div className="pay-actions" style={{ alignItems: 'flex-start' }}>
      <ConfirmAction label={approveLabel} busy={busy} requireReason description={approveText}
        onConfirm={(note) => onDecide('approve', note)} />
      <ConfirmAction label={rejectLabel} variant="danger" busy={busy} requireReason description="Tell the organiser why. They are notified with your note."
        onConfirm={(note) => onDecide('reject', note)} />
    </div>
  );
}

/** Prize pools above ₹10,00,000 waiting for approval, with the organiser's contact details. */
function LargePrizeRequests({ onChanged, onCount }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(() => largePrizeRequests('pending').then((r) => { setRows(r); setError(''); onCount?.(r.length); }).catch((err) => setError(err.message)), [onCount]);
  useEffect(() => { load(); }, [load]);

  async function decide(id, decision, note) {
    setBusy(id);
    try {
      await reviewLargePrize(id, decision, note);
      showToast(decision === 'approve' ? 'Approved. The organiser can now pay the platform fee.' : 'Rejected. The organiser was told why.');
      await load(); onChanged();
      return true;
    } catch (err) { showToast(err.message, 'error'); return false; }
    finally { setBusy(''); }
  }

  return (
    <section className="table-container-card" role="tabpanel" aria-labelledby="large-prize-title">
      <div className="table-header-between"><h2 className="table-title-md" id="large-prize-title" style={{ margin: 0 }}>Prize pools above ₹10,00,000</h2></div>
      <p className="pay-card-text" style={{ marginBottom: 14 }}>These competitions are unpublished until you approve them. Contact the organiser if anything about the funding is unclear.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!rows && !error && <div className="pay-empty">Loading requests…</div>}
      {rows && rows.length === 0 && <div className="pay-empty">No prize pools are waiting for approval.</div>}
      <div style={{ display: 'grid', gap: 14 }}>
        {(rows || []).map((r) => {
          const c = r.request?.contact || {};
          const level = LEVEL_META[r.reputationLevel] || LEVEL_META.blue;
          return (
            <article className="fin-request" key={r.id}>
              <div className="fin-request-head">
                <div>
                  <h3>{r.name}</h3>
                  <span className="pay-card-text">@{r.createdBy} · trust score {r.organizerTrustScore} · requested {formatDateTime(r.request?.requestedAt)}</span>
                </div>
                <Pill tone="warn">{rupees(r.prize)} prize pool</Pill>
              </div>
              <div className="fin-request-grid">
                <div><span>Contact name</span><strong>{c.fullName || '—'}</strong></div>
                <div><span>Phone</span><strong>{c.phone ? <a href={`tel:${c.phone.replace(/\s+/g, '')}`} style={{ color: '#60a5fa' }}>{c.phone}</a> : '—'}</strong></div>
                <div><span>Email</span><strong>{c.email ? <a href={`mailto:${c.email}`} style={{ color: '#60a5fa' }}>{c.email}</a> : '—'}</strong></div>
                <div><span>Organisation</span><strong>{c.organisation || '—'}</strong></div>
                <div><span>Account email</span><strong>{r.accountEmail || '—'}</strong></div>
                <div><span>Game</span><strong>{r.game || '—'}</strong></div>
                <div><span>Dates</span><strong>{formatDateTime(r.startDate)} → {formatDateTime(r.endDate)}</strong></div>
                <div><span>Platform fee</span><strong>{rupees(r.platformFee)}</strong></div>
                <div><span>Organiser&apos;s limit</span><strong><span style={{ color: level.color }}>{level.label}</span> · {rupees(r.reputationLimit ?? level.limit)}</strong></div>
                <div><span>Needs approval above</span><strong>{rupees(r.approvalThreshold ?? 1000000)}</strong></div>
              </div>
              {c.purpose && <p className="fin-request-quote">{c.purpose}</p>}
              <Decision busy={busy === r.id} approveLabel="Approve prize pool" rejectLabel="Reject"
                approveText="The organiser can then pay the platform fee and publish. Your note is sent to them."
                onDecide={(decision, note) => decide(r.id, decision, note)} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * End Requests tab: organisers asking to end a started competition early, and
 * finished competitions whose prize payout is waiting for finance.
 */
function EndRequests({ items, loading, onOpen }) {
  const pending = items.filter((c) => c.earlyEndRequest?.status === 'pending');
  const payouts = items.filter(awaitingPayout);
  return (
    <div role="tabpanel" style={{ display: 'grid', gap: 20 }}>
      <section className="table-container-card" aria-labelledby="early-end-title">
        <div className="table-header-between"><h2 className="table-title-md" id="early-end-title" style={{ margin: 0 }}>Early end requests</h2></div>
        <p className="pay-card-text" style={{ marginBottom: 14 }}>Approving refunds every player from escrow, keeps 10% of the deposited prize pool as the organiser&apos;s penalty and returns the rest to them.</p>
        {loading && <div className="pay-empty">Loading requests…</div>}
        {!loading && pending.length === 0 && <div className="pay-empty">No early end requests.</div>}
        <div style={{ display: 'grid', gap: 14 }}>
          {pending.map((c) => (
            <article className="fin-request" key={c.id}>
              <div className="fin-request-head">
                <div>
                  <h3>{c.name}</h3>
                  <span className="pay-card-text">@{c.createdBy} · requested {formatDateTime(c.earlyEndRequest.requestedAt)} · {c.earlyEndRequest.fixturesPlayed ?? 0} of {c.earlyEndRequest.fixturesTotal ?? 0} fixtures played</span>
                </div>
                <button type="button" className="pay-btn sm" onClick={() => onOpen(c.id)}>Review case</button>
              </div>
              <p className="fin-request-quote">{c.earlyEndRequest.reason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="table-container-card" aria-labelledby="payout-title">
        <div className="table-header-between"><h2 className="table-title-md" id="payout-title" style={{ margin: 0 }}>Ready for payout</h2></div>
        <p className="pay-card-text" style={{ marginBottom: 14 }}>The organiser ended these competitions. Review the case to release the prizes once the dispute window has closed and no dispute is open.</p>
        {!loading && payouts.length === 0 && <div className="pay-empty">No competitions are waiting for a payout.</div>}
        <div style={{ display: 'grid', gap: 14 }}>
          {payouts.map((c) => {
            const windowOpen = c.disputeWindowEndsAt && new Date(c.disputeWindowEndsAt) > new Date();
            return (
              <article className="fin-request" key={c.id}>
                <div className="fin-request-head">
                  <div>
                    <h3>{c.name}</h3>
                    <span className="pay-card-text">@{c.createdBy} · prize pool {rupees(c.prize)} · {money(c.escrow?.balanceMinor)} in escrow</span>
                  </div>
                  <div className="pay-actions" style={{ alignItems: 'center' }}>
                    {c.openDisputes > 0 ? <Pill tone="bad">{c.openDisputes} open dispute{c.openDisputes > 1 ? 's' : ''}</Pill>
                      : c.financeHold ? <Pill tone="warn">On hold</Pill>
                        : windowOpen ? <Pill tone="info">Disputes open until {formatDateTime(c.disputeWindowEndsAt)}</Pill>
                          : <Pill tone="ok">Ready to release</Pill>}
                    <button type="button" className="pay-btn sm" onClick={() => onOpen(c.id)}>Review case</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Open disputes block the payout, so they can be resolved inside a finished case. */
function CaseDisputes({ id, onChanged }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const res = await DisputesAPI.getByCompetition(id);
    if (res.ok) { setRows(res.data || []); setError(''); } else setError(res.error || 'Disputes could not be loaded.');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const open = (rows || []).filter((d) => d.status !== 'resolved');
  return (
    <section className="pay-card" id="case-disputes" style={{ gridColumn: '1 / -1' }}>
      <h3 className="pay-card-title">Disputes ({open.length} open)</h3>
      {error && <Notice tone="error">{error}</Notice>}
      {rows === null && !error && <p className="pay-card-text">Loading disputes…</p>}
      {rows && rows.length === 0 && <p className="pay-card-text">No disputes were raised in this competition.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {(rows || []).map((d) => <StaffDisputeCard key={d.id} dispute={d} onChanged={() => { load(); onChanged(); }} />)}
      </div>
    </section>
  );
}

function FinanceCase({ id, onClose, onChanged }) {
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
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
      await load(); onChanged();
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
  const completed = ledger.paymentStatus === 'COMPLETED';
  const windowOpen = !!ledger.disputeWindowEndsAt && new Date(ledger.disputeWindowEndsAt) > new Date();
  const checklist = [
    { ok: completed || ledger.paymentStatus === 'PRIZE_RELEASED', label: 'Organizer submitted final results' },
    { ok: (completed || ledger.paymentStatus === 'PRIZE_RELEASED') && !windowOpen, label: windowOpen ? `Players can dispute until ${formatDateTime(ledger.disputeWindowEndsAt)}` : 'Dispute window closed' },
    { ok: ledger.prizePoolPaid, label: 'Prize pool deposited in escrow' },
    { ok: !ledger.financeHold, label: 'No finance hold' },
    { ok: !ledger.openDisputes, label: ledger.openDisputes ? `${ledger.openDisputes} dispute(s) still open — resolve them below` : 'All disputes resolved', href: ledger.openDisputes ? '#case-disputes' : null },
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
        </dl>
      </div>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <LifecycleSteps ledger={ledger} />
      <EscrowStats ledger={ledger} />

      {ledger.earlyEndRequest?.status === 'pending' && (
        <section className="pay-card highlight" style={{ marginBottom: 20 }} aria-labelledby="early-end-case">
          <div className="pay-card-head">
            <h3 className="pay-card-title" id="early-end-case">Early end requested</h3>
            <Pill tone="bad">Needs a decision</Pill>
          </div>
          <p className="pay-card-text">@{ledger.earlyEndRequest.requestedBy} asked on {formatDateTime(ledger.earlyEndRequest.requestedAt)} to end this competition with {ledger.earlyEndRequest.fixturesPlayed ?? 0} of {ledger.earlyEndRequest.fixturesTotal ?? 0} fixtures played.</p>
          <p className="fin-request-quote">{ledger.earlyEndRequest.reason}</p>
          <dl className="pay-dl">
            <dt>Players refunded</dt><dd>every registration still in escrow</dd>
            <dt>Penalty ({ledger.earlyEndPenaltyPercent ?? 10}%)</dt><dd>{money(Math.round((ledger.escrow?.prizeMinor || 0) * (ledger.earlyEndPenaltyPercent ?? 10) / 100))}</dd>
            <dt>Returned to organiser</dt><dd>{money((ledger.escrow?.prizeMinor || 0) - Math.round((ledger.escrow?.prizeMinor || 0) * (ledger.earlyEndPenaltyPercent ?? 10) / 100))}</dd>
          </dl>
          <Decision busy={busy} approveLabel="Approve: refund players & apply penalty" rejectLabel="Reject request"
            approveText="Ends the competition now. This cannot be undone. Your note is sent to the organiser."
            onDecide={async (decision, note) => {
              setBusy(true); setNotice(null);
              try {
                await reviewEarlyEnd(id, decision, note);
                await load(); onChanged();
                const text = decision === 'approve' ? 'Competition ended early. Players were refunded and the penalty applied.' : 'Request rejected. The organiser was notified.';
                setNotice({ tone: 'success', text }); showToast(text);
                return true;
              } catch (err) { setNotice({ tone: 'error', text: err.message }); showToast(err.message, 'error'); return false; }
              finally { setBusy(false); }
            }} />
        </section>
      )}

      {/* Payout: only once the organiser has ended the competition. */}
      {(completed || ledger.paymentStatus === 'PRIZE_RELEASED') && (
        <div className="pay-grid">
            <section className={`pay-card ${ready ? 'highlight' : ''}`}>
              <h3 className="pay-card-title">Settlement</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {checklist.map((item) => (
                  <li key={item.label} className="pay-card-text" style={{ color: item.ok ? 'var(--text-light)' : '#fbbf24' }}>
                    <span aria-hidden="true">{item.ok ? '✓' : '•'}</span> {item.href ? <a href={item.href} style={{ color: 'inherit', textDecoration: 'underline' }} onClick={(e) => { e.preventDefault(); document.getElementById('case-disputes')?.scrollIntoView({ behavior: 'smooth' }); }}>{item.label}</a> : item.label}
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
          {ledger.openDisputes > 0 && <CaseDisputes id={id} onChanged={() => { load(); onChanged(); }} />}
        </div>
      )}
    </section>
  );
}

export default function FinanceModerator() {
  const [params, setParams] = useSearchParams();
  const caseId = params.get('id');
  const tab = params.get('tab') === 'end-requests' ? 'end-requests' : 'competitions';
  const [competitions, setCompetitions] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [prizeRequestCount, setPrizeRequestCount] = useState(null);

  // Reloads whenever a case changes, so the tabs are current on return.
  useEffect(() => {
    let active = true;
    paymentRequest('/competitions').then((r) => { if (active) { setCompetitions(r); setError(''); } }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [reload]);

  const all = useMemo(() => competitions || [], [competitions]);
  const escrowTotal = all.reduce((sum, c) => sum + (c.escrow?.balanceMinor || 0), 0);
  const readyCount = all.filter((c) => c.paymentStatus === 'COMPLETED' && !c.financeHold && !c.openDisputes && !(c.disputeWindowEndsAt && new Date(c.disputeWindowEndsAt) > new Date())).length;
  const riskCount = all.filter((c) => !TERMINAL_STATES.includes(c.paymentStatus) && ((c.organizerPaid && !c.prizePoolPaid) || c.financeHold || c.overdue || c.escrow?.status === 'HELD')).length;
  const settledCount = all.filter((c) => c.paymentStatus === 'PRIZE_RELEASED').length;
  const endRequestCount = all.filter((c) => c.earlyEndRequest?.status === 'pending' || awaitingPayout(c)).length;
  const onPrizeCount = useCallback((n) => setPrizeRequestCount(n), []);

  const openCase = (id) => { setParams({ tab, id }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const setTab = (next) => setParams({ tab: next });
  const tabs = [['competitions', 'Competitions', prizeRequestCount], ['end-requests', 'End Requests', competitions ? endRequestCount : null]];

  return (
    <main className="admin-page pay-page">
      <div className="admin-header-block pay-header">
        <div>
          <h1 className="admin-title-xl">Finance Moderation</h1>
          <p className="admin-subtitle-muted">Escrow oversight: approve large prize pools, decide early end requests and release payouts after verified results.</p>
        </div>
      </div>

      <MockBanner>Mock payment mode: payouts, refunds and clawbacks are ledger entries only. No bank transfers happen and no emails are sent. Every action you take is recorded in the admin audit log with your reason.</MockBanner>
      {error && <Notice tone="error">{error}</Notice>}

      {caseId ? (
        <FinanceCase id={caseId} onClose={() => setParams({ tab })} onChanged={() => setReload((v) => v + 1)} />
      ) : (
        <>
          <div className="dash-stats">
            <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-wrap" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14 }}>₹</div><div><div className="dash-stat-num">{money(escrowTotal)}</div><div className="dash-stat-lbl">Held in escrow</div></div></div>
            <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-info" style={{ color: '#64c8ff', fontWeight: 800, fontSize: 13 }}>RS</div><div><div className="dash-stat-num">{readyCount}</div><div className="dash-stat-lbl">Ready to settle</div></div></div>
            <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#fbbf24', fontWeight: 800, fontSize: 15 }}>!</div><div><div className="dash-stat-num">{riskCount}</div><div className="dash-stat-lbl">At risk / on hold</div></div></div>
            <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-success" style={{ color: '#4ade80', fontWeight: 800, fontSize: 15 }}>✓</div><div><div className="dash-stat-num">{settledCount}</div><div className="dash-stat-lbl">Settled</div></div></div>
          </div>

          <div className="pay-tabs" role="tablist" aria-label="Finance views">
            {tabs.map(([key, label, count]) => (
              <button key={key} type="button" role="tab" className="pay-tab" aria-selected={tab === key} onClick={() => setTab(key)}>
                {label}{count != null && <span className="pay-tab-count">{count}</span>}
              </button>
            ))}
          </div>

          {/* Kept mounted so the Competitions count stays current on either tab. */}
          <div hidden={tab !== 'competitions'}>
            <LargePrizeRequests key={reload} onChanged={() => setReload((v) => v + 1)} onCount={onPrizeCount} />
          </div>
          {tab === 'end-requests' && <EndRequests items={all} loading={!competitions && !error} onOpen={openCase} />}
        </>
      )}
    </main>
  );
}
