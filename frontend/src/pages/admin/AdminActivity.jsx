/**
 * NEXUS ESPORTS — Staff activity
 *
 * One staff member's actions from the backend audit trail (?admin=username, or
 * yourself). Finance moderators always see their own log.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AdminAPI } from '../../services/api.js';
import { EmptyState, ErrorState, LoadingState, PageHeader, formatDate } from '../../components/ui.jsx';

const label = (type) => String(type || 'ACTION').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function AdminActivity() {
  const [params] = useSearchParams();
  const session = useSelector((state) => state.auth.session);
  const target = session?.role === 'finance_moderator' ? session.username : (params.get('admin') || session?.username || '');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');

  const load = useCallback(async () => {
    const res = await AdminAPI.getActivity(target);
    if (res.ok) { setRows(Array.isArray(res.data) ? res.data : []); setError(''); } else setError(res.error || 'Unable to load activity.');
  }, [target]);
  useEffect(() => { load(); }, [load]);

  const types = useMemo(() => Array.from(new Set((rows || []).map((r) => r.actionType))).sort(), [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter((r) => (type === 'all' || r.actionType === type) && (!q || `${r.actionType} ${r.details}`.toLowerCase().includes(q)));
  }, [rows, query, type]);

  return (
    <main className="main-content">
      <PageHeader title="Activity" subtitle={target === session?.username ? 'Everything you have done on the platform.' : `Actions by @${target}.`} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="search" className="form-input" style={{ maxWidth: 340 }} aria-label="Search activity" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="form-input" style={{ maxWidth: 260 }} aria-label="Filter by action" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All actions</option>
          {types.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </select>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && rows === null && <LoadingState label="Loading activity…" />}
      {!error && rows && visible.length === 0 && <EmptyState title="No activity yet" message="Actions such as resolving disputes, changing settings and moderating accounts appear here." />}
      <div className="ui-list">
        {visible.map((r) => (
          <div className="ui-row" key={`${r.source}-${r.id}`}>
            <div className="ui-row-main">
              <div className="ui-row-title">{label(r.actionType)}</div>
              <div className="ui-row-meta">{r.details}</div>
              {/* Which competition an entry is about (older entries only stored it in metadata). */}
              {r.metadata?.competitionName && !String(r.details || '').includes(r.metadata.competitionName) && (
                <div className="ui-row-meta" style={{ marginTop: 2 }}>
                  Competition: {r.metadata.competitionName}{r.metadata.prize ? ` · prize pool ₹${Number(r.metadata.prize).toLocaleString('en-IN')}` : ''}
                </div>
              )}
            </div>
            <span className="ui-row-meta">{formatDate(r.timestamp, true)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
