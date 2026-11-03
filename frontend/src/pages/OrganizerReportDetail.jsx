/**
 * NEXUS ESPORTS — Organiser report details
 *
 * Full report file with status history, evidence and the same Discard /
 * Discuss / Act actions as the queue.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LocalReportsAPI as ReportsAPI } from '../services/local/reporting.js';
import useReportSync from '../hooks/useReportSync.js';
import { DiscardModal, PlayerDecisionModal } from '../components/ReportActionModals.jsx';
import { PRIORITY_META, capitalise, formatDate, reportCode } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/reports.css';

export default function OrganizerReportDetail() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    if (!id) { setError('No report selected.'); return; }
    const res = await ReportsAPI.get(id);
    if (!res.ok) { setError(res.error || 'Unable to load this report.'); return; }
    setReport(res.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  async function discuss() {
    const res = await ReportsAPI.startDiscussion(id);
    if (!res.ok) { showToast(res.error || 'Unable to open the case discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${res.data.discussion.id}`);
  }

  if (error) {
    return (
      <main className="main-content reports-page">
        <div className="report-inline-error">{error}</div>
        <Link className="report-btn" to="/pages/organizer-reports.html">Back to reports</Link>
      </main>
    );
  }
  if (!report) return <main className="main-content reports-page"><div className="report-empty">Loading report…</div></main>;

  const priority = PRIORITY_META[report.priority] || PRIORITY_META.medium;
  const open = ['new', 'under_review', 'awaiting_response'].includes(report.status);

  return (
    <main className="main-content reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">{reportCode(report)}</h1>
          <p className="reports-subtitle">
            {capitalise(report.reasonCode)} · @{report.reporterUsername} reported @{report.reportedUsername}
          </p>
        </div>
        <Link className="report-btn" to="/pages/organizer-reports.html">Back to reports</Link>
      </div>

      <div className="report-card">
        <div className="report-card-top">
          <span className="report-pill" style={{ color: priority.color, background: priority.bg, border: `1px solid ${priority.border}` }}>
            {priority.label}
          </span>
          <span className="report-pill" style={{ color: '#cbd5e1', border: '1px solid #334155' }}>
            {capitalise(report.status)}
          </span>
          <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>
            {capitalise(report.reportedRole)}
          </span>
          {report.relatedReportId && (
            <span className="report-pill" style={{ color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)' }}>
              Linked to a related report
            </span>
          )}
        </div>
        <div className="report-meta">
          <span>🏆 {report.competitionName}</span>
          <span>🕒 Filed {formatDate(report.createdAt)}</span>
          {report.incidentAt && <span>📍 Incident {formatDate(report.incidentAt)}</span>}
          <span>Reporter history: {report.reporterPriorSubstantiated} substantiated</span>
          <span>Accused history: {report.accusedPriorSubstantiated} substantiated</span>
        </div>
        <p className="report-desc">{report.description}</p>

        <div className="report-actions">
          {open && (
            <>
              <button className="report-btn" onClick={discuss}>Discuss</button>
              <button className="report-btn primary" onClick={() => setModal('act')}>Act</button>
              <button className="report-btn danger" onClick={() => setModal('discard')}>Discard</button>
            </>
          )}
          <Link className="report-btn" to={`/pages/comp-info.html?id=${report.competitionId}`}>View competition</Link>
        </div>
      </div>

      <h2 style={{ fontSize: 15, color: '#e2e8f0', margin: '22px 0 10px' }}>Evidence</h2>
      {(!report.evidence || report.evidence.length === 0) ? (
        <div className="report-empty">No evidence attached.</div>
      ) : (
        <div className="evidence-list">
          {report.evidence.map((file) => (
            <a className="evidence-item" key={file.id} href={file.url} target="_blank" rel="noreferrer">
              {file.filename || 'Evidence'}
            </a>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 15, color: '#e2e8f0', margin: '22px 0 10px' }}>Status history</h2>
      <ul className="timeline">
        {(report.statusHistory || []).map((entry) => (
          <li key={entry.id}>
            {capitalise(entry.fromStatus || 'new')} → <strong>{capitalise(entry.toStatus)}</strong>
            {entry.note ? ` — ${entry.note}` : ''}
            <span className="t">{formatDate(entry.createdAt)} · @{entry.actor || 'system'}</span>
          </li>
        ))}
      </ul>

      {report.conclusion && (
        <>
          <h2 style={{ fontSize: 15, color: '#e2e8f0', margin: '22px 0 10px' }}>Recorded conclusion</h2>
          <div className="info-card">
            <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{report.conclusion}</p>
            <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 0 }}>
              Finding: {capitalise(report.finding)} · Action: {capitalise(report.action)} · Reviewed by @{report.resolvedBy} on {formatDate(report.resolvedAt)}
            </p>
          </div>
        </>
      )}

      {modal === 'discard' && (
        <DiscardModal
          report={report}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); showToast('Report discarded.', 'success'); load(); }}
        />
      )}
      {modal === 'act' && (
        <PlayerDecisionModal
          report={report}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); showToast('Decision recorded.', 'success'); load(); }}
        />
      )}
    </main>
  );
}
