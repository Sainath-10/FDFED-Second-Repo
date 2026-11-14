/**
 * NEXUS ESPORTS — report details (Community Moderator)
 *
 * Opened by "View Report" from Activity Logs. Works for any report — organiser
 * or player workflow — and shows exactly two tabs: the report's discussion and
 * the competition's chronological timeline, both from persisted records.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ReportsAPI } from '../../services/api.js';
import useReportSync from '../../hooks/useReportSync.js';
import CaseHistoryTabs from '../../components/CaseHistoryTabs.jsx';
import { ErrorState, LoadingState } from '../../components/ui.jsx';
import { capitalise, formatDate } from '../../lib/reporting.js';
import '../../styles/pages/reports.css';

const muted = { color: '#94a3b8', border: '1px solid #334155' };

export default function ReportCaseView() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const back = params.get('from') === 'activity' ? '/pages/moderator/activity.html' : '/pages/moderator/reports.html';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) { setError('No report was selected.'); return; }
    const res = await ReportsAPI.reportCase(id);
    if (res.ok) { setData(res.data); setError(''); } else setError(res.error || 'Unable to load this report.');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  if (error) return <main className="main-content reports-page"><ErrorState message={error} onRetry={load} /></main>;
  if (!data) return <main className="main-content reports-page"><LoadingState label="Loading report…" /></main>;

  const { report, discussion, evidence, timeline } = data;
  const latest = report.latestDecision || {};
  const against = report.queue === 'moderator' ? 'Organiser' : 'Player';

  return (
    <main className="main-content reports-page">
      <div className="reports-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 className="reports-title">{report.code} · Report</h1>
          <p className="reports-subtitle">
            {capitalise(report.reasonCode)} report against @{report.reportedUsername} ({against.toLowerCase()}) in {report.competitionName}.
          </p>
        </div>
        <div className="report-actions" style={{ marginTop: 0 }}>
          <Link className="report-btn" to={back}>Back</Link>
        </div>
      </div>

      <div className="report-card" style={{ marginBottom: 20 }}>
        <div className="report-card-top">
          <span className="report-code">{report.code}</span>
          <span className="report-pill" style={muted}>{capitalise(report.status)}</span>
          <span className="report-pill" style={muted}>{capitalise(report.reasonCode)}</span>
          {report.appealStatus && (
            <span className="report-pill" style={{ ...muted, color: ['submitted', 'deciding'].includes(report.appealStatus) ? '#fbbf24' : '#94a3b8' }}>
              {['submitted', 'deciding'].includes(report.appealStatus) ? 'Appeal pending' : `Appeal ${report.appealOutcome || 'closed'}`}
            </span>
          )}
        </div>
        <div className="report-meta">
          <span>@{report.reporterUsername} → @{report.reportedUsername} · {against}</span>
          <span>Filed {formatDate(report.createdAt)}</span>
          {(latest.decidedBy || report.resolvedBy) && <span>Decided by @{latest.decidedBy || report.resolvedBy}</span>}
        </div>
        <p className="report-context-note"><strong>Report:</strong> {report.description}</p>
        {(latest.finding || report.finding) && (
          <p className="report-context-note"><strong>Decision:</strong> {capitalise(latest.finding || report.finding)} · {capitalise(latest.action || report.action)}{report.conclusion ? ` — ${report.conclusion}` : ''}</p>
        )}
        {report.appealReason && <p className="report-context-note"><strong>Appeal reason:</strong> {report.appealReason}</p>}
        {report.appealDecisionReason && <p className="report-context-note"><strong>Appeal decision:</strong> {report.appealDecisionReason} — @{report.appealDecidedBy}</p>}
      </div>

      <CaseHistoryTabs discussion={discussion} evidence={evidence} timeline={timeline} reportCode={report.code} />
    </main>
  );
}
