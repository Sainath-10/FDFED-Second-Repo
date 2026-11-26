/**
 * NEXUS ESPORTS — Reports
 *
 * The single Reports page for every player. It lists the reports the signed-in
 * user filed AND the reports filed against them (both directions of the same
 * report record), and — on a separate tab — the case discussions they are an
 * authorised participant of. Organiser reputation lives on the Profile page.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReportsAPI } from '../services/api.js';
import { AppealModal } from '../components/ReportActionModals.jsx';
import useReportSync from '../hooks/useReportSync.js';
import { useSelector } from 'react-redux';
import ReportCard from '../components/ReportCard.jsx';
import { STATUS_TABS } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/reports.css';

const sameUser = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

/**
 * Appeals. The server decides who may appeal and which workflow applies
 * (`canAppeal`, `appealKind`):
 *  - organiser appeal: the organiser appeals a Community Moderator decision;
 *  - player appeal: the accused player appeals the organiser's decision (this
 *    replaces the old "Report organiser" button for that situation).
 * Each decision can be appealed once.
 */
const canAppeal = (report, session) => !!report.canAppeal && sameUser(report.reportedUsername, session?.username);

const APPEAL_PILL = {
  pending: { label: 'Appeal pending', color: '#fbbf24' },
  reverted: { label: 'Appeal upheld — decision reverted', color: '#c6ff33' },
  discarded: { label: 'Appeal discarded — decision stands', color: '#f87171' },
};
function appealState(report) {
  if (!report.appealStatus) return null;
  if (report.appealOutcome === 'reverted' || (report.appealKind === 'organiser' && report.uplifted)) return 'reverted';
  if (report.appealOutcome === 'discarded') return 'discarded';
  return ['submitted', 'deciding'].includes(report.appealStatus) ? 'pending' : null;
}

export default function MyReports() {
  const session = useSelector((state) => state.auth.session);
  const navigate = useNavigate();
  const [view, setView] = useState('reports');
  const [tab, setTab] = useState('all');
  const [reports, setReports] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appealTarget, setAppealTarget] = useState(null);

  // Only the first load shows the loading state; the 20-second background
  // refresh (useReportSync) updates the list in place instead of blanking it.
  const load = useCallback(async () => {
    setError('');
    try {
      const [mine, threads] = await Promise.all([ReportsAPI.mine(), ReportsAPI.myDiscussions()]);
      if (mine.ok && Array.isArray(mine.data)) setReports(mine.data);
      else if (!mine.ok) setError(mine.error || 'Unable to load your reports.');
      if (threads.ok && Array.isArray(threads.data)) setDiscussions(threads.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  function appealSubmitted(result) {
    setAppealTarget(null);
    showToast('Appeal submitted. The decision stays in force until a Community Moderator reviews it.', 'success');
    // Organiser appeals continue in their discussion room (existing workflow).
    if (result?.discussionId) navigate(`/pages/case-discussion.html?discussionId=${encodeURIComponent(result.discussionId)}`);
    else load();
  }

  async function viewAppeal(report) {
    const res = await ReportsAPI.organiserAppealRoom(report.id);
    if (!res.ok) { showToast(res.error || 'Unable to open the appeal discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${encodeURIComponent(res.data.discussionId)}`);
  }

  // "Awaiting response" is not a separate view for the player: those reports
  // are still under review, so they stay reachable under that filter.
  const playerTabs = STATUS_TABS.filter((status) => status.key !== 'awaiting_response');
  const inTab = (report, key) => key === 'under_review'
    ? ['under_review', 'awaiting_response'].includes(report.status)
    : report.status === key;
  const countFor = (status) => reports.filter((report) => inTab(report, status)).length;
  const filtered = tab === 'all' ? reports : reports.filter((report) => inTab(report, tab));

  return (
    <main className="main-content reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">Reports</h1>
          <p className="reports-subtitle">
            Track what you filed and what was filed about you. Case discussions appear here as soon as a
            reviewer opens one.
          </p>
        </div>
      </div>

      {error && <div className="report-inline-error">{error}</div>}

      <div className="reports-tabs page-tabs" role="tablist" aria-label="Reports and case discussions">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'reports'}
          className={`reports-tab ${view === 'reports' ? 'active' : ''}`}
          onClick={() => setView('reports')}
        >
          Reports <span className="count">{reports.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'discussions'}
          className={`reports-tab ${view === 'discussions' ? 'active' : ''}`}
          onClick={() => setView('discussions')}
        >
          Case Discussions <span className="count">{discussions.length}</span>
        </button>
      </div>

      {appealTarget && (
        <AppealModal report={appealTarget} onClose={() => setAppealTarget(null)} onDone={appealSubmitted} />
      )}

      {view === 'reports' ? (
        <>
          <div className="reports-tabs">
            <button className={`reports-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
              All <span className="count">{reports.length}</span>
            </button>
            {playerTabs.map((status) => (
              <button
                key={status.key}
                className={`reports-tab ${tab === status.key ? 'active' : ''}`}
                onClick={() => setTab(status.key)}
              >
                {status.label}
                <span className="count">{countFor(status.key)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="report-empty">Loading your reports…</div>
          ) : filtered.length === 0 ? (
            <div className="report-empty">No reports in this view.</div>
          ) : (
            <div className="reports-list">
              {filtered.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  direction={sameUser(report.reportedUsername, session?.username) ? 'filed-against' : 'filed-by'}
                  statusLabel={report.appealStatus === 'submitted' && report.status === 'resolved' ? 'Appealed' : null}
                  actions={(
                    <>
                      {report.status !== 'discarded' && report.status !== 'resolved' && report.queue === 'organiser' && (
                        <Link className="report-btn" to={`/pages/comp-info.html?id=${report.competitionId}`}>Competition</Link>
                      )}
                      {report.discussionId && (
                        <Link
                          className="report-btn primary"
                          to={`/pages/case-discussion.html?discussionId=${report.discussionId}`}
                        >
                          Enter Discussion
                        </Link>
                      )}
                      {report.uplifted && report.appealKind === 'organiser' && (
                        <span className="report-pill" style={{ color: '#c6ff33', background: 'rgba(198,255,51,0.1)', border: '1px solid rgba(198,255,51,0.4)' }}>
                          Action reverted — reopened for review
                        </span>
                      )}
                      {appealState(report) && !(report.uplifted && report.appealKind === 'organiser') && (
                        <span className="report-pill" style={{ color: APPEAL_PILL[appealState(report)].color, border: '1px solid #334155' }} title={report.appealDecisionReason || report.appealReason || ''}>
                          {APPEAL_PILL[appealState(report)].label}
                        </span>
                      )}
                      {report.appealKind === 'organiser' && appealState(report) === 'pending' && sameUser(report.reportedUsername, session?.username) && (
                        <button className="report-btn" onClick={() => viewAppeal(report)}>View appeal</button>
                      )}
                      {canAppeal(report, session) && (
                        <button className="report-btn danger" onClick={() => setAppealTarget(report)}>Appeal</button>
                      )}
                    </>
                  )}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <div className="report-empty">Loading your case discussions…</div>
          ) : discussions.length === 0 ? (
            <div className="report-empty">No case discussions involve you yet.</div>
          ) : (
            <div className="reports-list">
              {discussions.map((thread) => {
                // The API returns the full decorated report with each room, so the
                // Case Discussions tab shows the same card as the Reports tab.
                const report = thread.report || {
                  id: thread.reportId,
                  code: thread.code,
                  reasonCode: thread.reasonCode,
                  priority: thread.priority,
                  status: thread.reportStatus,
                  createdAt: thread.createdAt,
                };
                return (
                  <ReportCard
                    key={thread.discussionId}
                    report={report}
                    direction={thread.as === 'accused' ? 'filed-against' : thread.as === 'reporter' ? 'filed-by' : null}
                    actions={(
                      <Link
                        className="report-btn primary"
                        to={`/pages/case-discussion.html?discussionId=${thread.discussionId}`}
                      >
                        Enter discussion
                      </Link>
                    )}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
