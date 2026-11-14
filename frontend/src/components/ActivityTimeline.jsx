/**
 * NEXUS ESPORTS — activity timeline
 *
 * Renders entries from the backend audit log (never generated in the browser):
 * a user's own activity or a competition's timeline. `load` returns the
 * API result; the list refreshes in the background without blanking.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import useReportSync from '../hooks/useReportSync.js';
import { EmptyState, ErrorState, LoadingState } from './ui.jsx';

const label = (type) => String(type || 'ACTION').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const when = (value) => {
  const d = new Date(value);
  return Number.isNaN(+d) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const GROUPS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'account', label: 'Account', test: (t) => /^(ACCOUNT|LOGIN|LOGOUT|PROFILE|PASSWORD|EMAIL|USER_)/.test(t) },
  { id: 'competition', label: 'Competition', test: (t) => /COMPETITION|ORGANIZER_|PRIZE_EXCEPTION|LARGE_PRIZE|EARLY_END|ANNOUNCEMENT/.test(t) },
  { id: 'team', label: 'Team', test: (t) => /TEAM_|JOIN_|INVITE/.test(t) },
  { id: 'match', label: 'Match', test: (t) => /MATCH|SCHEDULE|BRACKET|TOURNAMENT/.test(t) },
  { id: 'reports', label: 'Reports', test: (t) => /REPORT|DISCUSSION|APPEAL|DECISION|DISPUTE|SANCTION|RESTRICTION|REPUTATION|RESPONSE_REQUESTED/.test(t) },
  { id: 'payments', label: 'Payments', test: (t) => /PAYMENT|PRIZE|REFUND|FEE|HOLD|TRANSACTION|PAID|REVERSED|REVENUE|TRUST/.test(t) },
];

export default function ActivityTimeline({ load, emptyMessage = 'Nothing has been recorded yet.', showActor = true }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');

  const refresh = useCallback(async () => {
    const res = await load();
    if (res.ok) { setRows(Array.isArray(res.data) ? res.data : []); setError(''); }
    else setError(res.error || 'Unable to load activity.');
  }, [load]);
  useEffect(() => { refresh(); }, [refresh]);
  useReportSync(refresh);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = GROUPS.find((g) => g.id === group)?.test || (() => true);
    return (rows || []).filter((row) => test(String(row.actionType || ''))
      && (!q || `${row.actionType} ${row.details || ''} ${row.actor || ''}`.toLowerCase().includes(q)));
  }, [rows, query, group]);

  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (rows === null) return <LoadingState label="Loading activity…" />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="search" className="form-input" style={{ flex: '1 1 260px', maxWidth: 420 }} aria-label="Search activity" placeholder="Search activity…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="form-input" style={{ flex: '0 1 200px' }} aria-label="Filter activity" value={group} onChange={(e) => setGroup(e.target.value)}>
          {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No activity" message={rows.length ? 'No entries match this filter.' : emptyMessage} />
      ) : (
        <ol className="ui-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visible.map((row) => (
            <li className="ui-row" key={row.id} style={{ alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#c6ff33', marginTop: 8, flexShrink: 0 }} />
              <div className="ui-row-main">
                <div className="ui-row-title">{label(row.actionType)}</div>
                {row.details && <div className="ui-row-meta" style={{ whiteSpace: 'pre-wrap' }}>{row.details}</div>}
                <div className="ui-row-meta" style={{ marginTop: 4, color: '#64748b' }}>
                  {when(row.createdAt)}{showActor && row.actor ? ` · @${row.actor}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
