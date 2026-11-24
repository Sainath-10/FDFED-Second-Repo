/**
 * NEXUS ESPORTS — staff dispute card
 *
 * One dispute with the staff resolve actions. Used inside a finished finance
 * case, where an open dispute blocks the prize payout until it is resolved
 * (optionally banning the offending account). There is no separate Disputes
 * page for the Finance Moderator.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DisputesAPI, UploadAPI } from '../../services/api.js';
import { ReasonDialog, formatDate } from '../../components/ui.jsx';
import { showToast } from '../../lib/toast.js';
import UsernameSearch from '../../components/UsernameSearch.jsx';

export const STAFF_STATUS = {
  open_organizer: 'Waiting for organizer',
  under_review: 'Organizer reviewing',
  open_admin: 'Needs staff (against organizer)',
  escalated_to_admin: 'Escalated to staff',
  resolved: 'Resolved',
};

/** One dispute with the staff actions. */
export function StaffDisputeCard({ dispute, onChanged }) {
  const [acting, setActing] = useState(null);
  const [banTarget, setBanTarget] = useState('');
  const open = dispute.status !== 'resolved';

  async function resolve(notes) {
    const res = await DisputesAPI.adminResolve(dispute.id, acting, notes, acting === 'resolve_and_ban' ? banTarget.trim().replace(/^@/, '') : undefined);
    if (!res.ok) { showToast(res.error || 'The dispute was not resolved.', 'error'); return; }
    showToast(acting === 'resolve_and_ban' ? 'Dispute resolved and the account banned.' : 'Dispute resolved. The player was notified.');
    setActing(null);
    onChanged?.();
  }

  async function openEvidence(url) {
    if (!(await UploadAPI.open(url))) showToast('That evidence file could not be opened.', 'error');
  }

  return (
    <article className="ui-card">
      <div className="ui-row-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="ui-row-meta">DSP-{String(dispute.id).slice(0, 8).toUpperCase()} · {dispute.competitionName || 'Competition'} · {formatDate(dispute.createdAt, true)}</span>
        <span className={`status-pill ${open ? 'pending' : 'approved'}`}>{STAFF_STATUS[dispute.status] || dispute.status}</span>
      </div>
      <div className="ui-row-title">@{dispute.reportedBy} → {dispute.targetUserOrTeam}</div>
      <div className="ui-row-meta">{String(dispute.category || dispute.targetType).replace(/_/g, ' ')}</div>
      <p className="ui-row-meta" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{dispute.reason}</p>
      {dispute.organizerNotes && <p className="ui-row-meta" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}><strong style={{ color: '#fff' }}>Organizer / escalation notes:</strong> {dispute.organizerNotes}</p>}
      {dispute.adminNotes && <p className="ui-row-meta" style={{ marginTop: 8 }}><strong style={{ color: '#fff' }}>Staff decision:</strong> {dispute.adminNotes} — @{dispute.resolvedBy}{dispute.banApplied ? ' (ban applied)' : ''}</p>}
      <div className="ui-row-actions" style={{ marginTop: 12 }}>
        {(dispute.evidenceUrls || []).filter(Boolean).map((url, i) => <button type="button" key={url} className="btn-table-secondary" onClick={() => openEvidence(url)}>Evidence {i + 1}</button>)}
        <Link className="btn-table-secondary" to={`/pages/competition-detail.html?id=${encodeURIComponent(dispute.competitionId)}&tab=disputes`}>Competition</Link>
        {open && <button type="button" className="btn-table-primary" onClick={() => setActing('resolve')}>Resolve</button>}
        {open && <button type="button" className="btn-table-danger" onClick={() => { setBanTarget(dispute.targetType === 'opponent_team' ? '' : dispute.targetUserOrTeam || ''); setActing('resolve_and_ban'); }}>Resolve and ban</button>}
      </div>

      <ReasonDialog
        open={!!acting}
        tone={acting === 'resolve' ? 'primary' : 'danger'}
        title={acting === 'resolve' ? 'Resolve dispute' : 'Resolve and ban an account'}
        description="Your notes are shown to the player who raised the dispute."
        placeholder="Decision notes"
        minLength={5}
        confirmLabel={acting === 'resolve' ? 'Resolve' : 'Resolve and ban'}
        onConfirm={resolve}
        onClose={() => setActing(null)}
      >
        {acting === 'resolve_and_ban' && (
          <div className="ui-field">
            <label htmlFor={`ban-${dispute.id}`}>Username to ban</label>
            <UsernameSearch id={`ban-${dispute.id}`} value={banTarget} onChange={setBanTarget} onPick={setBanTarget} placeholder="Search the account to ban" />
          </div>
        )}
      </ReasonDialog>
    </article>
  );
}
