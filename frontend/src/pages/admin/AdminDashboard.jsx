/**
 * NEXUS ESPORTS — Admin dashboard
 *
 * Every competition from the backend with real team counts and states, live
 * platform statistics, and the prize-pool exception queue. The platform
 * ceiling is shown here; a Super Admin changes it from their dashboard.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI, ReputationAPI } from '../../services/api.js';
import { hasStarted, isCancelledCompetition, isClosedCompetition, useCompetitions } from '../../services/competitions.js';
import { EmptyState, ErrorState, LoadingState, PageHeader, formatDate, formatINR } from '../../components/ui.jsx';
import { showToast } from '../../lib/toast.js';

const stateOf = (c) => (isCancelledCompetition(c) ? 'cancelled'
  : isClosedCompetition(c) ? 'completed'
    : ['AWAITING_PLATFORM_FEE', 'AWAITING_FINANCE_APPROVAL'].includes(c.paymentStatus) ? 'draft'
      : hasStarted(c) ? 'live' : 'upcoming');

const FILTERS = ['all', 'upcoming', 'live', 'completed', 'cancelled'];

export default function AdminDashboard() {
  const { loading, error, data, reload } = useCompetitions({ withTeams: true });
  const [stats, setStats] = useState(null);
  const [ceiling, setCeiling] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [exceptions, setExceptions] = useState([]);
  const [notes, setNotes] = useState({});
  const [reviewing, setReviewing] = useState('');

  const loadExceptions = useCallback(() => {
    ReputationAPI.exceptions().then((res) => { if (res.ok && Array.isArray(res.data)) setExceptions(res.data); });
  }, []);

  useEffect(() => {
    AdminAPI.getStats().then((res) => { if (res.ok) setStats(res.data); });
    ReputationAPI.config().then((res) => { if (res.ok) setCeiling(res.data.maxPrizePool); });
    loadExceptions();
  }, [loadExceptions]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, f === 'all' ? data.length : data.filter((c) => stateOf(c) === f).length])), [data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((c) => (filter === 'all' || stateOf(c) === filter)
      && (!q || `${c.name} ${c.game} ${c.createdBy} ${(c.organizers || []).join(' ')}`.toLowerCase().includes(q)));
  }, [data, filter, query]);

  async function review(row, status) {
    setReviewing(row.id);
    const res = await ReputationAPI.reviewException(row.id, status, notes[row.id] || '');
    setReviewing('');
    if (!res.ok) { showToast(res.error || 'Unable to review this request.', 'error'); return; }
    showToast(status === 'approved' ? `Approved for @${row.organiserUsername}'s next competition only.` : 'Request rejected.');
    loadExceptions();
  }

  const pendingExceptions = exceptions.filter((x) => x.status === 'pending');

  return (
    <main className="main-content">
      <PageHeader title="Competition dashboard" subtitle="Every competition on the platform." />

      {stats && (
        <div className="ui-grid" style={{ marginBottom: 24 }}>
          <div className="ui-card"><div className="ui-row-meta">Published competitions</div><div className="page-title" style={{ fontSize: 26 }}>{stats.totalCompetitions}</div></div>
          <div className="ui-card"><div className="ui-row-meta">Running now</div><div className="page-title" style={{ fontSize: 26 }}>{stats.activeCompetitions}</div></div>
          <div className="ui-card"><div className="ui-row-meta">Open disputes</div><div className="page-title" style={{ fontSize: 26 }}>{stats.openDisputes}</div></div>
          <div className="ui-card"><div className="ui-row-meta">Prize-pool ceiling</div><div className="page-title" style={{ fontSize: 26 }}>{ceiling === null ? '—' : formatINR(ceiling)}</div></div>
        </div>
      )}

      <section className="ui-card" style={{ marginBottom: 24 }}>
        <h2 className="ui-card-title">Prize-pool exception requests ({pendingExceptions.length} pending)</h2>
        {pendingExceptions.length === 0 ? <p className="ui-row-meta">No requests are waiting.</p> : (
          <div className="ui-list">
            {pendingExceptions.map((x) => (
              <div className="ui-row" key={x.id}>
                <div className="ui-row-main">
                  <div className="ui-row-title">@{x.organiserUsername} asks for {formatINR(x.requestedAmount)}</div>
                  <div className="ui-row-meta">{x.reason} · {formatDate(x.createdAt, true)}</div>
                  <input className="form-input" style={{ marginTop: 8 }} placeholder="Note to the organizer (optional)" value={notes[x.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))} />
                </div>
                <div className="ui-row-actions">
                  <button type="button" className="btn-table-primary" disabled={reviewing === x.id} onClick={() => review(x, 'approved')}>Approve</button>
                  <button type="button" className="btn-table-danger" disabled={reviewing === x.id} onClick={() => review(x, 'rejected')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="ui-tabs">
        {FILTERS.map((f) => (
          <button type="button" key={f} className={`ui-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}<span className="count">{counts[f]}</span></button>
        ))}
      </div>
      <input type="search" className="form-input" style={{ maxWidth: 360, marginBottom: 16 }} aria-label="Search competitions" placeholder="Search by name, game or organizer…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {loading && <LoadingState label="Loading competitions…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && visible.length === 0 && <EmptyState title="No competitions match" />}
      {!loading && !error && visible.length > 0 && (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Competition</th><th>Organizer</th><th>Teams</th><th>Prize pool</th><th>Platform fee</th><th>Dates</th><th>State</th><th /></tr></thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><div className="ui-row-meta">{c.game}</div></td>
                  <td>@{c.createdBy}</td>
                  <td>{c.activeTeams.length} / {c.maxTeams || '—'}</td>
                  <td>{formatINR(c.prize)}</td>
                  <td>{formatINR(c.platformFee)}</td>
                  <td>{c.dates}</td>
                  <td>{c.badge}</td>
                  <td><Link className="btn-table-secondary" to={`/pages/competition-detail.html?id=${encodeURIComponent(c.id)}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
