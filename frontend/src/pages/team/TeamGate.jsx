/**
 * Common guard for the team pages: loading, no team, removed player, and
 * captain-only pages. Returns an element to render instead of the page, or null.
 */
import { Link, Navigate } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, PageHeader, RemovedFromCompetition } from '../../components/ui.jsx';

export function teamGate(t, { captainOnly = false, title = 'Team' } = {}) {
  if (t.loading && !t.team) return <main className="main-content"><LoadingState label="Loading your team…" /></main>;
  if (t.isRemoved) return <RemovedFromCompetition reason={t.removalReason} />;
  if (!t.team || !t.comp) {
    return (
      <main className="main-content">
        <PageHeader title={title} />
        {t.error ? <ErrorState message={t.error} onRetry={t.refresh} /> : (
          <EmptyState
            title="No team found"
            message="Open this page from your team, or create a team for a competition first."
            action={<Link to="/pages/my-activity.html" className="btn-primary">Go to My Activity</Link>}
          />
        )}
      </main>
    );
  }
  if (captainOnly && !t.canManage) {
    return <Navigate to={`/pages/team/team-roster.html?compId=${encodeURIComponent(t.comp.id)}&teamId=${encodeURIComponent(t.team.id)}`} replace />;
  }
  return null;
}

export default teamGate;
