/**
 * NEXUS ESPORTS — Community Moderator Dashboard
 *
 * Separate dashboard for reports against organisers. Reuses the Admin Dashboard
 * layout/stat styling; only Dashboard, Reports and Profile are exposed.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReportsAPI } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ReportCard from '../../components/ReportCard.jsx';
import { STATUS_TABS } from '../../lib/reporting.js';
import '../../styles/pages/admin/dashboard.css';
import '../../styles/pages/reports.css';

export default function ModeratorDashboard() {
  const { session } = useAuth();
  const [counts, setCounts] = useState({});
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [countRes, reportsRes] = await Promise.all([
        ReportsAPI.moderationCounts(),
        ReportsAPI.moderation('new'),
      ]);
      if (!alive) return;
      if (countRes.ok && countRes.data) setCounts(countRes.data);
      if (reportsRes.ok && Array.isArray(reportsRes.data)) setRecent(reportsRes.data.slice(0, 5));
      else if (!reportsRes.ok) setError(reportsRes.error || 'Unable to load the moderation queue.');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="admin-page reports-page">
      <div className="admin-header-block">
        <h1 className="admin-title-xl">Community Moderator</h1>
        <p className="admin-subtitle-muted">
          Reports against organisers only. Signed in as @{session?.username}.
        </p>
      </div>

      {error && <div className="report-inline-error">{error}</div>}

      <div className="dash-stats">
        {STATUS_TABS.map((status) => (
          <div className="dash-stat-card" key={status.key}>
            <div className="dash-stat-icon dash-stat-icon-wrap">🚩</div>
            <div>
              <div className="dash-stat-num">{counts[status.key] || 0}</div>
              <div className="dash-stat-lbl">{status.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="tournaments-section">
        <div className="tournaments-section-header">
          <h2 className="table-title-md">New reports about organisers</h2>
          <Link className="report-btn primary" to="/pages/moderator/reports.html">Open reports queue</Link>
        </div>
        {loading ? (
          <div className="report-empty">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="report-empty">No new organiser reports.</div>
        ) : (
          <div className="reports-list">
            {recent.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                detailHref={`/pages/moderator/report-detail.html?id=${report.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
