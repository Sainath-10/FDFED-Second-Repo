/**
 * NEXUS ESPORTS — shared payment UI pieces (mock banner, pills, confirmations,
 * ledger table and the competition money lifecycle stepper).
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime, isMock, money, txTone, txType, TERMINAL_STATES } from '../services/payments.js';
import '../styles/pages/payments.css';

export function MockBanner({ children }) {
  return (
    <div className="pay-mock-banner" role="note">
      <span className="pay-mock-tag">MOCK</span>
      <span>{children || 'Mock payment mode: no real money moves, no card details are collected and no emails are sent. Every action is still recorded in the escrow ledger.'}</span>
    </div>
  );
}

export function Pill({ tone = 'muted', children }) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}

export function Notice({ tone, children }) {
  if (!children) return null;
  return <div className={`pay-notice ${tone || ''}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

/**
 * A button that opens an inline confirmation. When `requireReason` is set the
 * moderator/organizer must write a reason, which is stored in the audit log.
 */
export function ConfirmAction({ label, confirmLabel, description, variant = 'primary', requireReason = false, minLength = 5, disabled, busy, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const fieldId = useId();
  const buttonClass = variant === 'primary' ? 'pay-btn' : `pay-btn ${variant}`;
  if (!open) return <button type="button" className={buttonClass} disabled={disabled || busy} onClick={() => setOpen(true)}>{label}</button>;
  const valid = !requireReason || reason.trim().length >= minLength;
  return (
    <form className={`pay-confirm ${variant === 'danger' ? 'danger' : ''}`} onSubmit={async (event) => {
      event.preventDefault();
      if (!valid) return;
      const ok = await onConfirm(reason.trim());
      if (ok !== false) { setOpen(false); setReason(''); }
    }}>
      {description && <p className="pay-card-text">{description}</p>}
      {requireReason && <>
        <label className="pay-label" htmlFor={fieldId}>Reason (recorded in the audit log)</label>
        <textarea id={fieldId} className="pay-textarea" value={reason} maxLength={2000} autoFocus onChange={(e) => setReason(e.target.value)} />
        <span className="pay-hint">{reason.trim().length < minLength ? `At least ${minLength} characters.` : `${reason.trim().length}/2000`}</span>
      </>}
      <div className="pay-actions">
        <button type="submit" className={buttonClass} disabled={!valid || busy}>{busy ? 'Working…' : (confirmLabel || label)}</button>
        <button type="button" className="pay-btn ghost" disabled={busy} onClick={() => { setOpen(false); setReason(''); }}>Keep as is</button>
      </div>
    </form>
  );
}

export function TransactionTable({ items, showCompetition = false, showPayer = true, onNote, empty = 'No transactions yet.' }) {
  if (!items?.length) return <div className="pay-empty">{empty}</div>;
  return (
    <div className="table-scroll-wrap" style={{ overflowX: 'auto' }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            {showCompetition && <th>Competition</th>}
            {showPayer && <th>Account</th>}
            <th>Amount</th>
            <th>Status</th>
            <th>Reference</th>
            {onNote && <th><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((tx) => (
            <tr key={tx.id}>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>{formatDateTime(tx.paidAt || tx.createdAt)}</td>
              <td style={{ fontWeight: 600 }}>{txType(tx.type)} {isMock(tx) && <Pill tone="accent">mock</Pill>}</td>
              {showCompetition && <td>{tx.competitionName ? <Link to={`/pages/competition-detail.html?id=${encodeURIComponent(tx.competitionId)}`} style={{ color: 'var(--text-white)' }}>{tx.competitionName}</Link> : <span className="pay-mono">{tx.competitionId}</span>}</td>}
              {showPayer && <td>@{tx.userUsername}</td>}
              <td className={tx.direction === 'OUT' ? 'pay-dir-out' : 'pay-dir-in'} style={{ whiteSpace: 'nowrap' }}>
                <span aria-label={tx.direction === 'OUT' ? 'Paid out' : 'Paid in'}>{tx.direction === 'OUT' ? '↑' : '↓'}</span> {money(tx.amountMinor)}
              </td>
              <td><Pill tone={txTone(tx.status)}>{tx.status}</Pill></td>
              <td className="pay-mono">{tx.gatewayRefId || tx.gatewayOrderId || 'Order pending'}</td>
              {onNote && <td><button type="button" className="btn-table-secondary" onClick={() => onNote(tx)}>Add note</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Platform fee → prize pool → registrations → results → settlement. */
export function LifecycleSteps({ ledger }) {
  if (!ledger) return null;
  const s = ledger.paymentStatus;
  const cancelled = ['REFUND_ISSUED', 'CANCELLED', 'EXPIRED', 'ABANDONED'].includes(s);
  const settled = s === 'PRIZE_RELEASED' || s === 'REVERSED';
  const completed = s === 'COMPLETED' || settled;
  const steps = [
    { title: 'Platform fee', sub: ledger.platformFeePaid ? 'Paid · published' : 'Publishes the competition', done: ledger.platformFeePaid },
    { title: 'Prize pool', sub: ledger.prizePoolPaid ? 'Locked in escrow' : 'Due before the deadline', done: ledger.prizePoolPaid },
    { title: 'Registrations', sub: `${ledger.totalRegistrations || 0} held in escrow`, done: ledger.started || completed },
    { title: 'Results', sub: completed ? 'Submitted' : 'End after the final', done: completed },
    { title: 'Settlement', sub: s === 'REVERSED' ? 'Reversed by finance' : settled ? 'Payouts released' : 'Finance approval', done: settled },
  ];
  const current = steps.findIndex((step) => !step.done);
  return (
    <ol className="pay-steps" aria-label="Payment lifecycle">
      {steps.map((step, i) => {
        const failed = (cancelled && i === current) || (s === 'REVERSED' && i === 4);
        const cls = failed ? 'failed' : step.done ? 'done' : i === current && !TERMINAL_STATES.includes(s) ? 'current' : '';
        return (
          <li key={step.title} className={`pay-step ${cls}`} aria-current={cls === 'current' ? 'step' : undefined}>
            <span className="pay-step-num" aria-hidden="true">{failed ? '!' : step.done ? '✓' : i + 1}</span>
            <div className="pay-step-title">{step.title}</div>
            <div className="pay-step-sub">{failed && cancelled ? 'Cancelled' : step.sub}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function EscrowStats({ ledger }) {
  const e = ledger?.escrow || {};
  return (
    <div className="dash-stats">
      <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-wrap" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14 }}>₹</div><div><div className="dash-stat-num">{money(e.balanceMinor)}</div><div className="dash-stat-lbl">Escrow balance · {e.status || 'OPEN'}</div></div></div>
      <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-info" style={{ color: '#64c8ff', fontWeight: 800, fontSize: 13 }}>PZ</div><div><div className="dash-stat-num">{money(e.prizeMinor)}</div><div className="dash-stat-lbl">Prize pool deposited</div></div></div>
      <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-success" style={{ color: '#4ade80', fontWeight: 800, fontSize: 13 }}>RG</div><div><div className="dash-stat-num">{money(e.registrationsMinor)}</div><div className="dash-stat-lbl">Registrations · {ledger?.totalRegistrations || 0}</div></div></div>
      <div className="dash-stat-card"><div className="dash-stat-icon dash-stat-icon-warn" style={{ color: '#fbbf24', fontWeight: 800, fontSize: 13 }}>OUT</div><div><div className="dash-stat-num">{money((e.payoutsMinor || 0) + (e.refundsMinor || 0))}</div><div className="dash-stat-lbl">Paid out · refunds {money(e.refundsMinor)}</div></div></div>
    </div>
  );
}

/**
 * Who would receive what if the competition were settled now (from verified
 * results), or why it can't be ended yet. Ties share the places they occupy.
 */
export function PayoutPreview({ preview }) {
  if (!preview) return null;
  if (preview.error) {
    return <div className="pay-notice warn" role="status" style={{ marginBottom: 0 }}><strong>Can't end yet:</strong> {preview.error}</div>;
  }
  return (
    <div>
      <span className="pay-label">Prize payout from current results</span>
      <dl className="pay-dl" style={{ marginTop: 6 }}>
        {preview.allocations.map((a) => (
          <div key={a.teamId} style={{ display: 'contents' }}>
            <dt>{a.label} · {a.teamName}</dt><dd>{money(a.amount)}</dd>
          </div>
        ))}
        {preview.unawarded > 0 && <><dt>Places no team could fill (returned to organizer)</dt><dd>{money(preview.unawarded)}</dd></>}
      </dl>
      {preview.allocations.some((a) => a.label.startsWith('joint')) && <span className="pay-hint">"joint" = tied teams share the prizes for the places they occupy equally.</span>}
    </div>
  );
}
