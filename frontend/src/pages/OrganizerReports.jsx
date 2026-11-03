/**
 * NEXUS ESPORTS — Organiser Reports Dashboard
 *
 * Queue of participant reports for competitions this organiser runs. A report
 * becomes a decision only after a recorded finding + action; discarding counts
 * towards the reporter's three baseless reports in that competition.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReportsAPI } from '../services/api.js';
import ReportCard from '../components/ReportCard.jsx';
import { DiscardModal, PlayerDecisionModal } from '../components/ReportActionModals.jsx';
import { STATUS_TABS, PRIORITY_META } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/reports.css';

export default function OrganizerReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [tab, setTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discardTarget, setDiscardTarget] = useState(null);
  const [decisionTarget, setDecisionTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ReportsAPI.organiser();
      if (!res.ok) { setError(res.error || 'Unable to load reports.'); return; }
      setReports(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function discuss(report) {
    const res = await ReportsAPI.startDiscussion(report.id);
    if (!res.ok) { showToast(res.error || 'Unable to open the case discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${res.data.discussion.id}`);
  }

  async function bumpPriority(report, priority) {
    const res = await ReportsAPI.priority(report.id, priority);
    if (!res.ok) { showToast(res.error || 'Unable to update priority.', 'error'); return; }
    load();
  }

  const counts = reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = tab === 'all' ? reports : reports.filter((report) => report.status === tab);

  return (
    <main className="main-content reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">Reports</h1>
          <p className="reports-subtitle">
            Participant reports for your competitions. The Community Moderator handles any report filed against
            an organiser — those never appear here.
          </p>
        </div>
        <Link className="report-btn" to="/pages/my-activity.html">My activity</Link>
      </div>

      <div className="reports-stats">
        {STATUS_TABS.map((status) => (
          <div className="report-stat" key={status.key}>
            <div className="n">{counts[status.key] || 0}</div>
            <div className="l">{status.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="report-inline-error">{error}</div>}

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
            {status.label} <span className="count">{counts[status.key] || 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="report-empty">Loading reports…</div>
      ) : filtered.length === 0 ? (
        <div className="report-empty">No reports in this tab.</div>
      ) : (
        <div className="reports-list">
          {filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              detailHref={`/pages/organizer-report-detail.html?id=${report.id}`}
              actions={(
                <>
                  {['new', 'under_review', 'awaiting_response'].includes(report.status) && (
                    <>
                      <button className="report-btn" onClick={() => discuss(report)}>Discuss</button>
                      <button className="report-btn primary" onClick={() => setDecisionTarget(report)}>Act</button>
                      <button className="report-btn danger" onClick={() => setDiscardTarget(report)}>Discard</button>
                      <select
                        className="report-btn"
                        value={report.priority}
                        onChange={(e) => bumpPriority(report, e.target.value)}
                        title="Review priority (urgency, not proof)"
                        style={{ background: PRIORITY_META[report.priority]?.bg }}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </>
                  )}
                </>
              )}
            />
          ))}
        </div>
      )}

      {discardTarget && (
        <DiscardModal
          report={discardTarget}
          onClose={() => setDiscardTarget(null)}
          onDone={() => { setDiscardTarget(null); showToast('Report discarded.', 'success'); load(); }}
        />
      )}
      {decisionTarget && (
        <PlayerDecisionModal
          report={decisionTarget}
          onClose={() => setDecisionTarget(null)}
          onDone={() => { setDecisionTarget(null); showToast('Decision recorded and the participant notified.', 'success'); load(); }}
        />
      )}
    </main>
  );
}
