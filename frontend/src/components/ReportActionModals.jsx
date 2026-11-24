/**
 * NEXUS ESPORTS — report decision modals
 *
 * Discard, organiser decision (against a player) and Community Moderator
 * decision (against an organiser). All decisions are sent to the backend, which
 * re-validates permissions, findings and actions.
 */
import { useState } from 'react';
import {
  DISCARD_REASONS,
  FINDINGS,
  LEVEL_META,
  MODERATOR_ACTIONS,
  ORGANISER_ACTIONS,
  capitalise,
} from '../lib/reporting.js';
import { ReportsAPI, ReputationAPI } from '../services/api.js';

/** Longest temporary competition-creation ban (the server enforces the same limit). */
const MAX_RESTRICTION_DAYS = 365;

function Backdrop({ children, onClose }) {
  return (
    <div className="report-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="report-modal">{children}</div>
    </div>
  );
}

export function DiscardModal({ report, onClose, onDone }) {
  const [reason, setReason] = useState('duplicate_report');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (reason === 'other' && note.trim().length < 10) {
      setError('Explain the reason for discarding this report (at least 10 characters).');
      return;
    }
    setBusy(true);
    const res = await ReportsAPI.discard(report.id, reason, note.trim());
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Unable to discard this report.'); return; }
    onDone && onDone(res.data);
  }

  return (
    <Backdrop onClose={onClose}>
      <h2>Discard report</h2>
      <p className="sub">A discarded report counts towards the reporter's three baseless reports for this competition.</p>
      {error && <div className="report-inline-error">{error}</div>}
      <div className="report-field">
        <label htmlFor="discard-reason">Mandatory reason</label>
        <select id="discard-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {DISCARD_REASONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="report-field">
        <label htmlFor="discard-note">
          Notes
          {reason === 'other' ? <span className="hint">Required</span> : <span className="hint">Optional</span>}
        </label>
        <textarea id="discard-note" rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="report-modal-actions">
        <button className="report-btn ghost" onClick={onClose}>Cancel</button>
        <button className="report-btn danger" disabled={busy} onClick={submit}>{busy ? 'Discarding…' : 'Discard report'}</button>
      </div>
    </Backdrop>
  );
}

export function PlayerDecisionModal({ report, onClose, onDone }) {
  const [finding, setFinding] = useState('substantiated');
  const [action, setAction] = useState('warning');
  const [conclusion, setConclusion] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (conclusion.trim().length < 15) {
      setError('Write a conclusion explaining what happened and why this decision was reached.');
      return;
    }
    setBusy(true);
    const res = await ReportsAPI.actPlayer(report.id, { finding, action, conclusion: conclusion.trim() });
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Unable to record this decision.'); return; }
    onDone && onDone(res.data);
  }

  return (
    <Backdrop onClose={onClose}>
      <h2>Record decision</h2>
      <p className="sub">{report.code || report.id} · against @{report.reportedUsername}</p>
      {error && <div className="report-inline-error">{error}</div>}
      <div className="report-field">
        <label htmlFor="finding">Finding</label>
        <select id="finding" value={finding} onChange={(e) => setFinding(e.target.value)}>
          {FINDINGS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="report-field">
        <label htmlFor="action">Action</label>
        <select id="action" value={action} onChange={(e) => setAction(e.target.value)}>
          {ORGANISER_ACTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="hint">
          Removal transfers team leadership to the next active, eligible player. A warning adds to the
          player's confirmed warning count and never changes organiser reputation.
        </span>
      </div>
      <div className="report-field">
        <label htmlFor="conclusion">Conclusion (required)</label>
        <textarea id="conclusion" rows={4} maxLength={2000} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
      </div>
      <div className="report-modal-actions">
        <button className="report-btn ghost" onClick={onClose}>Cancel</button>
        <button className="report-btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Confirm action'}</button>
      </div>
    </Backdrop>
  );
}

export function ModeratorDecisionModal({ report, onClose, onDone }) {
  const [finding, setFinding] = useState('substantiated');
  const [action, setAction] = useState('warning');
  const [conclusion, setConclusion] = useState('');
  const [level, setLevel] = useState('orange');
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const needsLevel = action === 'reputation_downgrade';
  // Only a temporary creation restriction has a duration. Competition
  // Suspension terminates the competition and is never a timed restriction.
  const needsDays = action === 'creation_restriction';

  async function submit() {
    setError('');
    if (conclusion.trim().length < 15) {
      setError('A recorded conclusion explaining the decision is required.');
      return;
    }
    if (finding === 'unsubstantiated' && !['no_action', 'warning'].includes(action)) {
      setError('An unsubstantiated finding cannot justify a punitive action.');
      return;
    }
    if (needsDays) {
      const d = Number(days);
      if (!Number.isInteger(d) || d < 1 || d > MAX_RESTRICTION_DAYS) {
        setError(`Choose a ban length from 1 to ${MAX_RESTRICTION_DAYS} days.`);
        return;
      }
    }
    if (action === 'competition_termination' && !window.confirm('End this competition now? Every player is refunded, the organiser forfeits 10% of the prize pool, and this cannot be undone or uplifted.')) return;
    setBusy(true);
    const payload = { finding, action, conclusion: conclusion.trim() };
    if (needsLevel) payload.level = level;
    if (needsDays) payload.days = Number(days);
    const res = await ReportsAPI.actOrganiser(report.id, payload);
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Unable to record this decision.'); return; }
    onDone && onDone(res.data);
  }

  return (
    <Backdrop onClose={onClose}>
      <h2>Decision against organiser</h2>
      <p className="sub">{report.code || report.id} · @{report.reportedUsername}</p>
      {error && <div className="report-inline-error">{error}</div>}
      <div className="report-field">
        <label htmlFor="m-finding">Finding</label>
        <select id="m-finding" value={finding} onChange={(e) => setFinding(e.target.value)}>
          {FINDINGS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="report-field">
        <label htmlFor="m-action">Action</label>
        <select id="m-action" value={action} onChange={(e) => setAction(e.target.value)}>
          {MODERATOR_ACTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span className="hint">A warning never changes reputation by itself. Downgrades are audited with the reason.</span>
        {action === 'competition_suspension' && (
          <span className="hint" style={{ display: 'block', marginTop: 6, color: '#fb923c' }}>
            Competition Suspension terminates this competition because of the recorded misconduct. It is not a
            temporary suspension, so no duration is recorded and it is never restored automatically.
          </span>
        )}
        {action === 'competition_termination' && (
          <span className="hint" style={{ display: 'block', marginTop: 6, color: '#f87171' }}>
            Ends the competition immediately: every registration fee still in escrow is refunded to the players, the
            organiser forfeits 10% of the deposited prize pool as a penalty (the rest is returned to them) and their
            trust score drops. Money cannot be un-refunded, so this decision cannot be appealed or uplifted. Not possible
            once prizes have been paid out — use a finance reversal for that.
          </span>
        )}
      </div>
      {needsLevel && (
        <div className="report-field">
          <label htmlFor="m-level">New reputation level</label>
          <select id="m-level" value={level} onChange={(e) => setLevel(e.target.value)}>
            {Object.entries(LEVEL_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label} — max ₹{meta.limit.toLocaleString('en-IN')}</option>
            ))}
          </select>
        </div>
      )}
      {needsDays && (
        <div className="report-field">
          <label htmlFor="m-days">Duration (days) — 1 to {MAX_RESTRICTION_DAYS}</label>
          <input id="m-days" type="number" min={1} max={MAX_RESTRICTION_DAYS} step={1} value={days} onChange={(e) => setDays(e.target.value)} />
          <span className="report-field-help" style={{ display: 'block', marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
            The organiser cannot create competitions until the ban ends. The longest ban allowed is {MAX_RESTRICTION_DAYS} days (one year).
          </span>
        </div>
      )}
      <div className="report-field">
        <label htmlFor="m-conclusion">Conclusion (required)</label>
        <textarea id="m-conclusion" rows={4} maxLength={2000} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
      </div>
      <div className="report-modal-actions">
        <button className="report-btn ghost" onClick={onClose}>Cancel</button>
        <button className="report-btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Confirm action'}</button>
      </div>
    </Backdrop>
  );
}

export function UpliftModal({ report, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState('remain_terminated');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSuspension = report.action === 'competition_suspension';

  async function submit() {
    setError('');
    if (reason.trim().length < 15) {
      setError('A mandatory reason (at least 15 characters) is required to uplift an action.');
      return;
    }
    setBusy(true);
    const payload = { reason: reason.trim() };
    if (isSuspension) payload.competitionDisposition = disposition;
    const res = await ReportsAPI.uplift(report.id, payload);
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Unable to uplift this action.'); return; }
    onDone && onDone(res.data);
  }

  return (
    <Backdrop onClose={onClose}>
      <h2>Uplift action</h2>
      <p className="sub">{report.code || report.id} · @{report.reportedUsername}</p>
      <div className="report-field">
        <label>Original decision</label>
        <input value={`${capitalise(report.finding)} · ${capitalise(report.action)}`} readOnly disabled />
      </div>
      {isSuspension && (
        <div className="report-field">
          <label htmlFor="uplift-disposition">Competition disposition</label>
          <select id="uplift-disposition" value={disposition} onChange={(e) => setDisposition(e.target.value)}>
            <option value="remain_terminated">Keep the competition terminated</option>
            <option value="reopen">Explicitly reopen the competition</option>
          </select>
          <span className="hint">
            Termination is never reversed automatically. Reopening restores the competition status; review refunds,
            match results and payments separately before relying on it.
          </span>
        </div>
      )}
      <div className="report-field">
        <label htmlFor="uplift-reason">Reason (required)</label>
        <textarea id="uplift-reason" rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        <span className="hint">This removes only the restrictions created by this decision. The original report stays.</span>
      </div>
      {error && <div className="report-inline-error">{error}</div>}
      <div className="report-modal-actions">
        <button className="report-btn ghost" onClick={onClose}>Cancel</button>
        <button className="report-btn primary" disabled={busy} onClick={submit}>{busy ? 'Uplifting…' : 'Confirm uplift'}</button>
      </div>
    </Backdrop>
  );
}

/**
 * The affected organiser or accused player appeals a decision. One appeal per
 * decision; the server decides which workflow applies.
 */
export function AppealModal({ report, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (reason.trim().length < 10) { setError('Explain the reason for your appeal (at least 10 characters).'); return; }
    setBusy(true);
    const res = await ReportsAPI.appeal(report.id, reason.trim());
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Unable to submit the appeal.'); return; }
    onDone && onDone(res.data);
  }

  return (
    <Backdrop onClose={onClose}>
      <h2>Appeal decision</h2>
      <p className="sub">{report.code || report.id} · {capitalise(report.action)}</p>
      <div className="report-field">
        <label htmlFor="appeal-reason">Reason for appeal (required)</label>
        <textarea id="appeal-reason" rows={5} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <span className="hint">A Community Moderator reviews your appeal. The decision stays in force until then, and each decision can be appealed only once.</span>
      </div>
      {error && <div className="report-inline-error">{error}</div>}
      <div className="report-modal-actions">
        <button className="report-btn ghost" onClick={onClose}>Cancel</button>
        <button className="report-btn primary" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit Appeal'}</button>
      </div>
    </Backdrop>
  );
}

/** Community Moderator decides an appeal: revert the original decision or discard the appeal. */
export function AppealDecisionModal({ report, onClose, onDone }) {
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const player = report.appealKind === 'player' || report.queue === 'organiser';

  async function submit() {
    setError('');
    if (!action) { setError('Choose an action.'); return; }
    if (reason.trim().length < 10) { setError('Explain your decision (at least 10 characters).'); return; }
    setBusy(true);
    const res = await ReportsAPI.decideAppeal(report.id, action, reason.trim());
    setBusy(false);
    if (!res.ok) { setError(res.error || 'Unable to record the decision.'); return; }
    onDone && onDone(res.data, action);
  }

  return (
    <Backdrop onClose={onClose}>
      <h2>Appeal decision</h2>
      <p className="sub">{report.code || report.id} · @{report.reportedUsername} · {player ? 'Player appeal' : 'Organiser appeal'}</p>
      {report.appealReason && (
        <div className="report-field">
          <label>Appeal reason</label>
          <textarea rows={3} value={report.appealReason} readOnly disabled />
        </div>
      )}
      <div className="report-field">
        <label htmlFor="appeal-action">Action</label>
        <select id="appeal-action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="" disabled>Choose an action</option>
          <option value="revert">Revert the Decision</option>
          <option value="discard">Discard</option>
        </select>
        <span className="hint">
          {action === 'revert'
            ? (player
              ? "Undoes the organiser's decision completely — a removed player returns to the same team, position and role."
              : 'Removes the restrictions from that decision and reopens the original report as New for a fresh decision.')
            : action === 'discard'
              ? 'Keeps the original decision and its consequences. The appeal is closed.'
              : 'The original report and its history are always kept.'}
        </span>
      </div>
      <div className="report-field">
        <label htmlFor="appeal-decision-reason">Reason (required)</label>
        <textarea id="appeal-decision-reason" rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <div className="report-inline-error">{error}</div>}
      <div className="report-modal-actions">
        <button className="report-btn ghost" onClick={onClose}>Cancel</button>
        <button className={`report-btn ${action === 'discard' ? 'danger' : 'primary'}`} disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit'}</button>
      </div>
    </Backdrop>
  );
}

export async function changePriority(reportId, priority) {
  return ReportsAPI.priority(reportId, priority);
}

export async function requestPrizeException(amount, reason) {
  return ReputationAPI.requestException(amount, reason);
}
