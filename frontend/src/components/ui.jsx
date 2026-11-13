/**
 * NEXUS ESPORTS — shared page states and dialogs.
 *
 * One look for loading, empty, error and restricted states, plus the reason
 * and confirm dialogs used across pages, so every screen behaves the same way.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header-row">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="ui-state" role="status" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="ui-state ui-state-card">
      <div className="ui-state-title">{title}</div>
      {message && <p className="ui-state-message">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="ui-state ui-state-card ui-state-error" role="alert">
      <div className="ui-state-title">Something went wrong</div>
      <p className="ui-state-message">{message || 'The request failed. Please try again.'}</p>
      {onRetry && <button type="button" className="btn-table-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  return <div className={`ui-notice ui-notice-${tone}`}>{children}</div>;
}

/** Shown wherever a removed player opens a team or competition surface. */
export function RemovedFromCompetition({ reason }) {
  return (
    <main className="main-content">
      <PageHeader
        title="Access restricted"
        subtitle="You were removed from this competition, so its team and competition pages are closed to you."
      />
      {reason && <Notice tone="warning">Reason: {reason}</Notice>}
      <Link to="/pages/my-reports.html" className="btn-primary">View your reports</Link>
    </main>
  );
}

/**
 * Modal that asks for a reason before a consequential action.
 * `onConfirm(reason)` may return a promise; the dialog stays open while it runs.
 */
export function ReasonDialog({
  open,
  title,
  description,
  placeholder = '',
  minLength = 5,
  confirmLabel = 'Confirm',
  tone = 'danger',
  optional = false,
  onConfirm,
  onClose,
  children,
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  const trimmed = reason.trim();
  const valid = optional ? (trimmed.length === 0 || trimmed.length >= minLength) : trimmed.length >= minLength;

  async function submit(event) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onConfirm?.(trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay open" style={{ display: 'flex' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
      <form className="modal-box ui-dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <div className="modal-header">
          <h3 className={`modal-title ui-dialog-title-${tone}`}>{title}</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => { if (!busy) onClose?.(); }}>✕</button>
        </div>
        {description && <p className="ui-dialog-text">{description}</p>}
        {children}
        <textarea
          ref={inputRef}
          className="form-input"
          rows={3}
          placeholder={placeholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          disabled={busy}
          style={{ width: '100%' }}
        />
        <p className="ui-dialog-hint">
          {optional ? `Optional${minLength > 1 ? ` (at least ${minLength} characters if given)` : ''}.` : `At least ${minLength} characters.`}
        </p>
        <div className="ui-dialog-actions">
          <button type="button" className="btn-cancel" onClick={() => { if (!busy) onClose?.(); }} disabled={busy}>Cancel</button>
          <button type="submit" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} disabled={!valid || busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Simple yes/no confirmation. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setBusy(false); }, [open]);
  if (!open) return null;
  async function confirm() {
    setBusy(true);
    try { await onConfirm?.(); } finally { setBusy(false); }
  }
  return (
    <div className="modal-overlay open" style={{ display: 'flex' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
      <div className="modal-box ui-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3 className={`modal-title ui-dialog-title-${tone}`}>{title}</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => { if (!busy) onClose?.(); }}>✕</button>
        </div>
        <p className="ui-dialog-text">{message}</p>
        <div className="ui-dialog-actions">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={confirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Copies text with a fallback for browsers without the async clipboard API. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (err) {
    return false;
  }
}

export const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return withTime
    ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
