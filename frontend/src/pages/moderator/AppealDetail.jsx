/**
 * NEXUS ESPORTS — appeal details (Community Moderator)
 *
 * The "View" page for an appeal: the original case discussion between the
 * organiser, reporter and accused player (messages and evidence, read-only),
 * and the competition's audit timeline. Act and Discuss are available here too.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ReportsAPI } from '../../services/api.js';
import useReportSync from '../../hooks/useReportSync.js';
import CaseHistoryTabs from '../../components/CaseHistoryTabs.jsx';
import { AppealDecisionModal } from '../../components/ReportActionModals.jsx';
import { ErrorState, LoadingState } from '../../components/ui.jsx';
import { capitalise, formatDate } from '../../lib/reporting.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/reports.css';

export default function AppealDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setError('No appeal was selected.'); return; }
    const res = await ReportsAPI.appealDetails(id);
    if (res.ok) { setData(res.data); setError(''); } else setError(res.error || 'Unable to load this appeal.');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  async function discuss() {
    const res = await ReportsAPI.appealRoom(id);
    if (!res.ok) { showToast(res.error || 'Unable to open the discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${res.data.discussionId}`);
  }

  if (error) return <main className="main-content reports-page"><ErrorState message={error} onRetry={load} /></main>;
  if (!data) return <main className="main-content reports-page"><LoadingState label="Loading appeal…" /></main>;

  const { report, discussion, evidence, timeline } = data;
  const pending = ['submitted', 'deciding'].includes(report.appealStatus);
  const latest = report.latestDecision || {};

  return (
    <main className="main-content reports-page">
      <div className="reports-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 className="reports-title">{report.code} · Appeal</h1>
          <p className="reports-subtitle">
            @{report.reportedUsername} appealed {report.appealKind === 'player' ? "the organiser's" : 'the'} decision
            ({capitalise(latest.action || report.action)}) in {report.competitionName}.
          </p>
        </div>
        <div className="report-actions" style={{ marginTop: 0 }}>
          <Link className="report-btn" to="/pages/moderator/reports.html">Back to reports</Link>
          {pending && <button className="report-btn" onClick={discuss}>Discuss</button>}
          {pending && <button className="report-btn primary" onClick={() => setDeciding(true)}>Act</button>}
        </div>
      </div>

      <div className="report-card" style={{ marginBottom: 20 }}>
        <div className="report-card-top">
          <span className="report-code">{report.code}</span>
          <span className="report-pill" style={{ color: pending ? '#fbbf24' : '#94a3b8', border: '1px solid #334155' }}>
            {pending ? 'Appeal pending' : `Appeal ${report.appealOutcome || 'closed'}`}
          </span>
          <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>{capitalise(report.reasonCode)}</span>
        </div>
        <div className="report-meta">
          <span>@{report.reporterUsername} → @{report.reportedUsername}</span>
          <span>Decided by @{latest.decidedBy || report.resolvedBy}</span>
          <span>Appealed {formatDate(report.appealedAt)}</span>
        </div>
        <p className="report-context-note"><strong>Original report:</strong> {report.description}</p>
        {report.conclusion && <p className="report-context-note"><strong>Organiser's conclusion:</strong> {report.conclusion}</p>}
        <p className="report-context-note"><strong>Appeal reason:</strong> {report.appealReason || '—'}</p>
        {report.appealDecisionReason && <p className="report-context-note"><strong>Moderator decision:</strong> {report.appealDecisionReason} — @{report.appealDecidedBy}</p>}
      </div>

      <CaseHistoryTabs discussion={discussion} evidence={evidence} timeline={timeline} discussionLabel="Previous Discussion" reportCode={report.code} />

      {deciding && (
        <AppealDecisionModal
          report={report}
          onClose={() => setDeciding(false)}
          onDone={(_, action) => {
            setDeciding(false);
            showToast(action === 'revert' ? 'Decision reverted.' : 'Appeal discarded. The original decision stands.', 'success');
            load();
          }}
        />
      )}
    </main>
  );
}
