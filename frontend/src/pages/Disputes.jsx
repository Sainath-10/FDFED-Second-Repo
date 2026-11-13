/**
 * NEXUS ESPORTS — My disputes
 *
 * Disputes the signed-in player raised or that involve their teams, from the
 * backend. Evidence opens through the authenticated upload endpoint.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { DisputesAPI, UploadAPI } from '../services/api.js';
import { EmptyState, ErrorState, LoadingState, PageHeader, formatDate } from '../components/ui.jsx';
import useReportSync from '../hooks/useReportSync.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/disputes.css';

export const DISPUTE_STATUS = {
  open_organizer: { label: 'Waiting for organizer', pill: 'pending' },
  under_review: { label: 'Under review', pill: 'pending' },
  open_admin: { label: 'With platform staff', pill: 'pending' },
  escalated_to_admin: { label: 'Escalated to staff', pill: 'pending' },
  resolved: { label: 'Resolved', pill: 'approved' },
};

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'open', label: 'Open', test: (d) => d.status !== 'resolved' },
  { id: 'resolved', label: 'Resolved', test: (d) => d.status === 'resolved' },
];

export function canEscalate(d, username) {
  if (String(d.reportedBy).toLowerCase() !== String(username || '').toLowerCase()) return false;
  const waiting = ['open_organizer', 'under_review'].includes(d.status) && Date.now() - +new Date(d.createdAt) >= 24 * 3600000;
  const organizerDecided = d.status === 'resolved' && !!d.organizerNotes && !d.adminNotes;
  return waiting || organizerDecided;
}

export default function Disputes() {
  const { session } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    const res = await DisputesAPI.mine();
    if (res.ok) { setRows(res.data || []); setError(''); } else setError(res.error || 'Unable to load your disputes.');
  }, []);
  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  async function openEvidence(url) {
    if (!(await UploadAPI.open(url))) showToast('That evidence file could not be opened.', 'error');
  }

  const active = FILTERS.find((f) => f.id === filter);
  const visible = (rows || []).filter(active.test);

  return (
    <main className="main-content">
      <PageHeader
        title="Disputes"
        subtitle="Disputes you raised or that involve your teams."
        actions={<>
          <Link className="btn-cancel" to="/pages/dispute-escalation.html">Escalate a dispute</Link>
          <Link className="btn-primary" to="/pages/submit-report.html">+ Raise a dispute</Link>
        </>}
      />
      <div className="ui-tabs">
        {FILTERS.map((f) => (
          <button type="button" key={f.id} className={`ui-tab${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}<span className="count">{(rows || []).filter(f.test).length}</span>
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && rows === null && <LoadingState label="Loading disputes…" />}
      {!error && rows && visible.length === 0 && (
        <EmptyState title="No disputes here" message="If a result or opponent was unfair, raise a dispute while the competition is running or within 24 hours after it ends." />
      )}

      <div className="ui-list">
        {visible.map((d) => {
          const st = DISPUTE_STATUS[d.status] || { label: d.status, pill: 'pending' };
          const mine = String(d.reportedBy).toLowerCase() === String(session?.username || '').toLowerCase();
          return (
            <article className="ui-card" key={d.id}>
              <div className="ui-row-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="ui-row-meta">DSP-{String(d.id).slice(0, 8).toUpperCase()} · {d.competitionName || 'Competition'} · filed {formatDate(d.createdAt, true)}</span>
                <span className={`status-pill ${st.pill}`}>{st.label}</span>
              </div>
              <div className="ui-row-title">{mine ? `You → ${d.targetUserOrTeam}` : `@${d.reportedBy} → ${d.targetUserOrTeam}`}</div>
              <p className="ui-row-meta" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{d.reason}</p>
              {(d.organizerNotes || d.adminNotes) && (
                <p className="ui-row-meta" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  <strong style={{ color: '#fff' }}>{d.adminNotes ? 'Staff decision' : 'Organizer notes'}:</strong> {d.adminNotes || d.organizerNotes}
                  {d.resolvedBy ? ` — @${d.resolvedBy}` : ''}
                </p>
              )}
              <div className="ui-row-actions" style={{ marginTop: 10 }}>
                {(d.evidenceUrls || []).filter(Boolean).map((url, i) => (
                  <button type="button" key={url} className="btn-table-secondary" onClick={() => openEvidence(url)}>Evidence {i + 1}</button>
                ))}
                {canEscalate(d, session?.username) && (
                  <Link className="btn-table-danger" to={`/pages/dispute-escalation.html?id=${encodeURIComponent(d.id)}`}>Escalate to staff</Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
