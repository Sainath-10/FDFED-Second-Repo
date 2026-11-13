/**
 * NEXUS ESPORTS — Staff dispute console
 *
 * Disputes from the backend. Platform staff resolve disputes against
 * organizers, escalated disputes and — when settlement is blocked — any open
 * dispute, optionally banning the offending account. Resolving is what lets
 * finance release a competition's prizes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DisputesAPI, UploadAPI } from '../../services/api.js';
import { EmptyState, ErrorState, LoadingState, PageHeader, ReasonDialog, formatDate } from '../../components/ui.jsx';
import useReportSync from '../../hooks/useReportSync.js';
import { showToast } from '../../lib/toast.js';
import UsernameSearch from '../../components/UsernameSearch.jsx';

export const STAFF_STATUS = {
  open_organizer: 'Waiting for organizer',
  under_review: 'Organizer reviewing',
  open_admin: 'Needs staff (against organizer)',
  escalated_to_admin: 'Escalated to staff',
  resolved: 'Resolved',
};

/** One dispute with the staff actions. Shared with the single-dispute review page. */
export function StaffDisputeCard({ dispute, onChanged, showLink = true }) {
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
        {showLink && <Link className="btn-table-secondary" to={`/pages/admin/dispute-review.html?id=${encodeURIComponent(dispute.id)}`}>Details</Link>}
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

const TABS = [
  { id: 'staff', label: 'Needs staff', test: (d) => ['open_admin', 'escalated_to_admin'].includes(d.status) },
  { id: 'open', label: 'All open', test: (d) => d.status !== 'resolved' },
  { id: 'resolved', label: 'Resolved', test: (d) => d.status === 'resolved' },
  { id: 'all', label: 'All', test: () => true },
];

export default function AdminDisputes() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('staff');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const res = await DisputesAPI.getAll();
    if (res.ok) { setRows(res.data || []); setError(''); } else setError(res.error || 'Unable to load disputes.');
  }, []);
  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  const active = TABS.find((t) => t.id === tab);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter((d) => active.test(d) && (!q || `${d.reportedBy} ${d.targetUserOrTeam} ${d.reason} ${d.competitionName}`.toLowerCase().includes(q)));
  }, [rows, active, query]);

  return (
    <main className="main-content">
      <PageHeader title="Disputes" subtitle="Open disputes block prize settlement until they are resolved." />
      <div className="ui-tabs">
        {TABS.map((t) => <button type="button" key={t.id} className={`ui-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}<span className="count">{(rows || []).filter(t.test).length}</span></button>)}
      </div>
      <input type="search" className="form-input" style={{ maxWidth: 360, marginBottom: 16 }} aria-label="Search disputes" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && rows === null && <LoadingState label="Loading disputes…" />}
      {!error && rows && visible.length === 0 && <EmptyState title="Nothing here" message="No disputes in this view." />}
      <div className="ui-list">{visible.map((d) => <StaffDisputeCard key={d.id} dispute={d} onChanged={load} />)}</div>
    </main>
  );
}
