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
import { LocalReportsAPI as ReportsAPI } from '../services/local/reporting.js';
import useReportSync from '../hooks/useReportSync.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReportCard from '../components/ReportCard.jsx';
import { STATUS_TABS, formatDate, capitalise } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/reports.css';

const sameUser = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

/**
 * A player affected by an organiser decision can complain about that organiser.
 * Available whether or not the player was removed from the competition, and the
 * original report/decision is never modified by filing the complaint.
 */
const APPEALABLE_ACTIONS = ['reputation_downgrade', 'creation_restriction', 'competition_suspension', 'formal_warning', 'final_warning'];

/**
 * The affected organiser may appeal an active non-warning decision, ONCE per
 * report. `appealUsed` is permanent and survives uplift + a later decision, so
 * this is a display of a rule the engine also enforces.
 */
function canAppealReport(report, session) {
  return sameUser(report.reportedUsername, session?.username)
    && report.status === 'resolved'
    && report.queue === 'moderator'
    && APPEALABLE_ACTIONS.includes(String(report.action || ''))
    && !report.uplifted
    && !report.appealUsed
    && report.appealStatus !== 'submitted';
}

function canReportOrganiser(report, session) {
  const me = String(session?.username || '').toLowerCase();
  if (!me || !report) return false;
  if (String(report.reportedUsername || '').toLowerCase() !== me) return false;
  if (report.status !== 'resolved' || !report.resolvedBy) return false;
  if (String(report.resolvedBy).toLowerCase() === me) return false;
  // Any decision that affected this player can be complained about, including
  // legacy warning actions recorded before they were unified.
  const affectingActions = ['warning', 'formal_warning', 'final_warning', 'remove_from_competition'];
  if (!affectingActions.includes(String(report.action || ''))) return false;
  // A complaint cannot itself be complained about.
  return !report.originalReportId;
}

export default function MyReports() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('reports');
  const [tab, setTab] = useState('all');
  const [reports, setReports] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
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

  async function appeal(report) {
    const res = await ReportsAPI.appeal(report.id);
    if (!res.ok) { showToast(res.error || 'Unable to submit the appeal.', 'error'); return; }
    showToast('Appeal submitted. The decision remains active while it is reviewed.', 'success');
    navigate(`/pages/case-discussion.html?discussionId=${encodeURIComponent(res.data.discussionId)}`);
  }

  async function viewAppeal(report) {
    const res = await ReportsAPI.organiserAppealRoom(report.id);
    if (!res.ok) { showToast(res.error || 'Unable to open the appeal discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${encodeURIComponent(res.data.discussionId)}`);
  }

  const countFor = (status) => reports.filter((report) => report.status === status).length;
  const filtered = tab === 'all' ? reports : reports.filter((report) => report.status === tab);

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

      {view === 'reports' ? (
        <>
          <div className="reports-tabs">
            <button className={`reports-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
              All <span className="count">{reports.length}</span>
            </button>
            {STATUS_TABS.map((status) => (
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
                      {canReportOrganiser(report, session) && (
                        <Link
                          className="report-btn danger"
                          to={`/pages/report.html?compId=${encodeURIComponent(report.competitionId)}&against=${encodeURIComponent(report.resolvedBy)}&role=organiser&originalReportId=${encodeURIComponent(report.id)}&sourcePage=reports-card`}
                        >
                          Report organiser
                        </Link>
                      )}
                      {report.uplifted && (
                        <span className="report-pill" style={{ color: '#c6ff33', background: 'rgba(198,255,51,0.1)', border: '1px solid rgba(198,255,51,0.4)' }}>
                          Action uplifted — reopened for review
                        </span>
                      )}
                      {report.appealStatus === 'submitted' && report.status === 'resolved' && sameUser(report.reportedUsername, session?.username) && (
                        <button className="report-btn" onClick={() => viewAppeal(report)}>View appeal</button>
                      )}
                      {canAppealReport(report, session) && (
                        <button className="report-btn danger" onClick={() => appeal(report)}>Appeal</button>
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
              {discussions.map((thread) => (
                <div className="report-card" key={thread.discussionId}>
                  <div className="report-card-top">
                    <span className="report-code">{thread.code}</span>
                    <span
                      className="report-pill"
                      style={{ color: thread.status === 'open' ? '#c6ff33' : '#94a3b8', border: '1px solid #334155' }}
                    >
                      {thread.status === 'open' ? 'Open' : 'Read-only'}
                    </span>
                    <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>
                      You are the {capitalise(thread.as)}
                    </span>
                  </div>
                  <div className="report-meta">
                    <span>{thread.reasonCode ? capitalise(thread.reasonCode) : 'Case discussion'}</span>
                    <span>Opened {formatDate(thread.createdAt)}</span>
                  </div>
                  <div className="report-actions">
                    <Link className="report-btn primary" to={`/pages/case-discussion.html?discussionId=${thread.discussionId}`}>
                      Enter discussion
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
