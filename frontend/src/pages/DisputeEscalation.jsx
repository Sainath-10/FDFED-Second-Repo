/**
 * NEXUS ESPORTS — Escalate a dispute
 *
 * The player who raised a dispute sends it to platform staff when the
 * organizer has not answered within 24 hours, or when they disagree with the
 * organizer's resolution. The backend checks both rules.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { DisputesAPI } from '../services/api.js';
import { EmptyState, LoadingState, Notice, PageHeader, formatDate } from '../components/ui.jsx';
import { DISPUTE_STATUS, canEscalate } from './Disputes.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/dispute-escalation.css';

export default function DisputeEscalation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSelector((state) => state.auth.session);
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(params.get('id') || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    DisputesAPI.mine().then((res) => {
      const list = res.ok ? (res.data || []).filter((d) => canEscalate(d, session?.username)) : [];
      setRows(list);
      if (!selected && list.length) setSelected(list[0].id);
    });
  }, [session?.username]);

  const dispute = (rows || []).find((d) => d.id === selected) || null;

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!dispute) return;
    if (reason.trim().length < 10) { setError('Explain why staff should review this (at least 10 characters).'); return; }
    setBusy(true);
    const res = await DisputesAPI.escalate(dispute.id, reason.trim());
    setBusy(false);
    if (!res.ok) { setError(res.error || 'The dispute was not escalated.'); return; }
    showToast('Escalated. Platform staff will review the dispute.');
    navigate('/pages/disputes.html');
  }

  return (
    <main className="main-content">
      <Link to="/pages/disputes.html" className="back-btn-alt">← Back to disputes</Link>
      <PageHeader title="Escalate a dispute" subtitle="Ask platform staff to review a dispute the organizer has not handled, or a decision you disagree with." />
      {rows === null && <LoadingState label="Loading your disputes…" />}
      {rows && rows.length === 0 && (
        <EmptyState
          title="Nothing to escalate"
          message="You can escalate a dispute you raised once the organizer has had 24 hours to answer, or after the organizer resolves it. Disputes already with staff cannot be escalated again."
          action={<Link className="btn-cancel" to="/pages/disputes.html">View my disputes</Link>}
        />
      )}
      {rows && rows.length > 0 && (
        <form className="ui-card" style={{ maxWidth: 720 }} onSubmit={submit}>
          <div className="ui-field">
            <label htmlFor="esc-dispute">Dispute</label>
            <select id="esc-dispute" className="form-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {rows.map((d) => <option key={d.id} value={d.id}>{d.competitionName} — {d.targetUserOrTeam} ({DISPUTE_STATUS[d.status]?.label || d.status})</option>)}
            </select>
          </div>
          {dispute && (
            <div className="ui-card" style={{ marginBottom: 16 }}>
              <div className="ui-row-meta">Filed {formatDate(dispute.createdAt, true)}</div>
              <p className="ui-row-meta" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{dispute.reason}</p>
              {dispute.organizerNotes && <p className="ui-row-meta" style={{ marginTop: 6 }}><strong style={{ color: '#fff' }}>Organizer:</strong> {dispute.organizerNotes}</p>}
            </div>
          )}
          <div className="ui-field">
            <label htmlFor="esc-reason">Why should staff review it?</label>
            <textarea id="esc-reason" className="form-input" rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="ui-dialog-actions">
            <Link className="btn-cancel" to="/pages/disputes.html">Cancel</Link>
            <button type="submit" className="btn-danger" disabled={busy || !dispute}>{busy ? 'Escalating…' : 'Escalate to staff'}</button>
          </div>
        </form>
      )}
    </main>
  );
}
