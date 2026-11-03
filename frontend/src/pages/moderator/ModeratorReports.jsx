/**
 * NEXUS ESPORTS — Community Moderator Reports
 * Reports against organisers, with the five queue tabs and decision actions.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReportsAPI } from '../../services/api.js';
import ReportCard from '../../components/ReportCard.jsx';
import { DiscardModal, ModeratorDecisionModal } from '../../components/ReportActionModals.jsx';
import { STATUS_TABS } from '../../lib/reporting.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/admin/dashboard.css';
import '../../styles/pages/reports.css';

export default function ModeratorReports() {
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
    const res = await ReportsAPI.moderation();
    if (!res.ok) setError(res.error || 'Unable to load organiser reports.');
    else setReports(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function discuss(report) {
    const res = await ReportsAPI.startDiscussion(report.id);
    if (!res.ok) { showToast(res.error || 'Unable to open the case discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${res.data.discussion.id}`);
  }

  const counts = reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1;
    return acc;
  }, {});
  const filtered = tab === 'all' ? reports : reports.filter((report) => report.status === tab);

  return (
    <main className="admin-page reports-page">
      <div className="admin-header-block">
        <h1 className="admin-title-xl">Organiser reports</h1>
        <p className="admin-subtitle-muted">
          Reports about organisers. Findings and sanctions are recorded with a reason and are auditable.
        </p>
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
              detailHref={`/pages/moderator/report-detail.html?id=${report.id}`}
              actions={['new', 'under_review', 'awaiting_response'].includes(report.status) ? (
                <>
                  <button className="report-btn" onClick={() => discuss(report)}>Discuss</button>
                  <button className="report-btn primary" onClick={() => setDecisionTarget(report)}>Act</button>
                  <button className="report-btn danger" onClick={() => setDiscardTarget(report)}>Discard</button>
                </>
              ) : null}
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
        <ModeratorDecisionModal
          report={decisionTarget}
          onClose={() => setDecisionTarget(null)}
          onDone={() => { setDecisionTarget(null); showToast('Decision recorded.', 'success'); load(); }}
        />
      )}
    </main>
  );
}
