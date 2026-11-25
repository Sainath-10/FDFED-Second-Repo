/**
 * NEXUS ESPORTS — Community Moderator Activity
 *
 * The timeline is the backend's append-only moderation audit trail: every
 * decision, discussion, appeal outcome and reversal performed by the selected
 * Community Moderator. Counts are database counts, not a slice of this page.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ReportsAPI as LocalReportsAPI } from '../../services/api.js';
import useReportSync from '../../hooks/useReportSync.js';
import { UpliftModal } from '../../components/ReportActionModals.jsx';
import { capitalise, formatDate } from '../../lib/reporting.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/admin/dashboard.css';

const isSuperAdmin = (session) => ['super-admin', 'super_admin'].includes(String(session?.role || '').toLowerCase());

const ACTION_META = {
  REPORT_DECIDED: { label: 'Decision issued', icon: '⚖️', color: '#86efac', kind: 'resolved' },
  REPORT_DISCARDED: { label: 'Report discarded', icon: '🗑️', color: '#94a3b8', kind: 'discarded' },
  REPORT_PRIORITY_CHANGED: { label: 'Priority changed', icon: '⚡', color: '#fb923c', kind: 'resolved' },
  DISCUSSION_OPENED: { label: 'Discussion opened', icon: '💬', color: '#c6ff33' },
  DISCUSSION_ENDED: { label: 'Discussion closed', icon: '🔒', color: '#94a3b8' },
  DISCUSSION_PARTICIPANT_ADDED: { label: 'Participant added', icon: '➕', color: '#94a3b8' },
  DISCUSSION_PARTICIPANT_REMOVED: { label: 'Participant removed', icon: '➖', color: '#94a3b8' },
  RESPONSE_REQUESTED: { label: 'Response requested', icon: '📨', color: '#fbbf24' },
  APPEAL_UPHELD: { label: 'Appeal upheld — decision reverted', icon: '↩️', color: '#c6ff33' },
  APPEAL_DISCARDED: { label: 'Appeal rejected', icon: '⛔', color: '#f87171' },
  APPEAL_DISCUSSION_OPENED: { label: 'Appeal discussion entered', icon: '💬', color: '#c6ff33' },
  ACTION_UPLIFTED: { label: 'Previous decision reverted', icon: '↩️', color: '#fb923c' },
  REPORT_DEADLINE_SWEEP: { label: 'Overdue review escalated', icon: '⏰', color: '#fb923c' },
};

const decisionSummary = (value) => {
  if (!value) return '—';
  const finding = value.finding ? capitalise(value.finding) : '';
  const action = value.action ? capitalise(value.action) : '';
  const level = value.level ? `${capitalise(value.level)} reputation` : '';
  return [finding, action, level].filter(Boolean).join(' · ') || 'No decision';
};

const FILTERS = [
  { key: 'resolved', label: 'Resolved' },
  { key: 'discarded', label: 'Discarded' },
  { key: 'all', label: 'Total Cases' },
];

export default function ModeratorActivity() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const targetUsername = (params.get('admin') || session?.username || '').trim();
  const displayName = targetUsername || 'Community Moderator';

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ resolved: 0, discarded: 0, total: 0 });
  const [moderator, setModerator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [upliftTarget, setUpliftTarget] = useState(null);

  const load = useCallback(async () => {
    if (!targetUsername) {
      setError('No Community Moderator was selected.');
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const res = await LocalReportsAPI.moderatorActivity(targetUsername);
    if (!res.ok) {
      setError(res.error || 'Unable to load this moderator’s activity.');
      setRows([]);
    } else {
      setRows(Array.isArray(res.data?.activities) ? res.data.activities : []);
      setCounts(res.data?.counts || { resolved: 0, discarded: 0, total: 0 });
      setModerator(res.data?.moderator || null);
    }
    setLoading(false);
  }, [targetUsername]);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  const toggle = (key) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const visibleRows = filter === 'all'
    ? rows
    : rows.filter((row) => (ACTION_META[row.action]?.kind || '') === filter);
  const emptyCopy = filter === 'resolved'
    ? 'This Community Moderator has not resolved any reports yet.'
    : filter === 'discarded'
      ? 'This Community Moderator has not discarded any reports yet.'
      : 'This Community Moderator has no moderation activity yet.';
  const superAdminView = isSuperAdmin(session);
  const email = moderator?.email || (targetUsername === session?.username ? session?.email : '') || '';

  return (
    <main className="admin-main">
      <header className="admin-header" style={{ marginBottom: 24 }}>
        <div>
          {superAdminView && (
            <Link
              to="/pages/super-admin/admins.html"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent, #c6ff33)', textDecoration: 'none', fontSize: 13, fontWeight: 700, marginBottom: 14 }}
            >
              ← Back to Administrator Directory
            </Link>
          )}
          <h1 className="admin-title"><span style={{ color: 'var(--accent,#c6ff33)' }}>Activity Logs</span></h1>
          <p className="admin-desc">Every moderation action recorded for this Community Moderator, newest first.</p>
        </div>
      </header>

      <div id="admin-info-card" style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 16, padding: 24, marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div id="admin-avatar" style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(244,114,182,0.15)', border: '2px solid rgba(244,114,182,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#f472b6' }}>
            {String(displayName || 'M').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 id="admin-username-title" style={{ margin: '0 0 4px', color: '#ffffff', fontSize: 20, fontWeight: 800 }}>{displayName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span id="admin-role-badge" style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: 'rgba(244,114,182,0.15)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.3)' }}>Community Moderator</span>
              <span id="admin-email-text" style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{targetUsername || '—'}{email ? ` · ${email}` : ''}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {FILTERS.map((card) => {
            const active = filter === card.key;
            const value = card.key === 'all' ? counts.total : counts[card.key];
            const color = card.key === 'resolved' ? '#22c55e' : card.key === 'discarded' ? '#94a3b8' : '#c6ff33';
            return (
              <button
                key={card.key}
                type="button"
                aria-pressed={active}
                title={`Show ${card.label.toLowerCase()} activity`}
                onClick={() => setFilter(card.key)}
                style={{
                  background: active ? 'rgba(198,255,51,0.10)' : '#141414',
                  border: active ? '1px solid rgba(198,255,51,0.6)' : '1px solid #262626',
                  boxShadow: active ? '0 0 0 1px rgba(198,255,51,0.25)' : 'none',
                  borderRadius: 12,
                  padding: '12px 18px',
                  textAlign: 'center',
                  minWidth: 110,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                }}
              >
                <div style={{ fontSize: 11, color: active ? '#c6ff33' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{card.label}</div>
                <div id={`stat-${card.key}-count`} style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
              </button>
            );
          })}
        </div>
      </div>

      <section style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10 }}><span>🚩 Moderation Activity Timeline</span></h3>
          <div id="log-count-text" style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            Showing {visibleRows.length} activity record{visibleRows.length === 1 ? '' : 's'} for {targetUsername || 'this moderator'}{filter === 'all' ? '' : ` · ${filter} only`}
          </div>
        </div>

        {error && (
          <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading activity…</div>
        ) : (
          <>
            <div id="activity-timeline-list" style={{ display: visibleRows.length ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
              {visibleRows.map((row, index) => {
                const meta = ACTION_META[row.action] || { label: capitalise(row.action), icon: '•', color: '#94a3b8' };
                const key = row.id || `activity-${index}`;
                const isExpanded = expanded.has(key);
                return (
                  <div key={key} style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: `${meta.color}1f`, color: meta.color, border: `1px solid ${meta.color}33`, letterSpacing: '0.5px' }}>{meta.label}</span>
                        {row.code && <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>{row.code}</span>}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>🕒 {formatDate(row.createdAt)}</span>
                    </div>

                    <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
                      {row.affectedUsername ? `@${row.affectedUsername}` : 'Report case'}
                      {row.competitionName ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {row.competitionName}</span> : null}
                    </div>

                    <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {row.previous && <span>Previous: {decisionSummary(row.previous)}</span>}
                      {row.next && <span>New: {decisionSummary(row.next)}</span>}
                      {!row.previous && !row.next && row.details && <span>{row.details}</span>}
                      {row.reason && <span>Reason: {row.reason}</span>}
                    </div>

                    <div>
                      <button
                        type="button"
                        className="btn-table-secondary"
                        onClick={() => toggle(key)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: isExpanded ? '1px solid rgba(198,255,51,0.5)' : '1px solid rgba(255,255,255,0.15)', color: isExpanded ? '#c6ff33' : '#e5e5e5', background: isExpanded ? 'rgba(198,255,51,0.08)' : 'rgba(255,255,255,0.04)', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: 11 }}>{isExpanded ? '▲' : '▼'}</span>
                        <span>{isExpanded ? 'Hide Details' : 'Details'}</span>
                      </button>

                      {row.canUplift && (
                        <button
                          type="button"
                          className="btn-table-secondary"
                          onClick={() => setUpliftTarget({ ...row.report, code: row.code })}
                          style={{ marginLeft: 8, padding: '6px 14px', fontSize: 12, fontWeight: 800, borderRadius: 6, border: '1px solid rgba(251,146,60,0.5)', color: '#fb923c', background: 'rgba(251,146,60,0.08)', cursor: 'pointer' }}
                        >
                          Revert
                        </button>
                      )}

                      {isExpanded && (
                        <div style={{ marginTop: 12, background: '#0d0f14', border: '1px solid rgba(198,255,51,0.25)', borderRadius: 12, padding: '18px 20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 18px', background: '#07080a', border: '1px solid #1f242d', borderRadius: 8, padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Activity ID</div><div style={{ color: '#ffffff', fontWeight: 700 }}>{row.id}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Action</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{meta.label}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Moderator</div><div style={{ color: '#ffffff', fontWeight: 600 }}>@{row.actor}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Role</div><div style={{ color: '#ffffff', fontWeight: 600 }}>Community Moderator</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Report ID</div><div style={{ color: '#ffffff', fontWeight: 700 }}>{row.code || '—'}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Competition</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{row.competitionName || '—'}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Affected user</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{row.affectedUsername ? `@${row.affectedUsername}` : '—'}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Previous decision</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{decisionSummary(row.previous)}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>New decision</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{decisionSummary(row.next)}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Recorded on</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{formatDate(row.createdAt)}</div></div>
                          </div>

                          {(row.details || row.reason) && (
                            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              <strong style={{ color: '#ffffff', display: 'block', marginBottom: 2 }}>Reason / conclusion:</strong>
                              {row.reason || row.details}
                            </div>
                          )}

                          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                            {!superAdminView && row.reportId ? (
                              <Link to={`/pages/moderator/report-view.html?id=${encodeURIComponent(row.reportId)}`} className="btn-table-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 12, fontWeight: 800, borderRadius: 6, background: '#c6ff33', color: '#000', textDecoration: 'none' }}>
                                View report ↗
                              </Link>
                            ) : <span style={{ fontSize: 11, color: '#64748b' }}>Read-only administrator view</span>}
                            <button type="button" className="btn-table-secondary" onClick={() => toggle(key)} style={{ padding: '6px 14px', fontSize: 12 }}>Close ✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleRows.length === 0 && !error && (
              <div id="activity-empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: '#141414', border: '1px dashed #262626', borderRadius: 12 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <h4 style={{ margin: '0 0 6px', color: '#ffffff', fontSize: 16, fontWeight: 700 }}>No Activity Found</h4>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{emptyCopy}</p>
              </div>
            )}
          </>
        )}
      </section>

      {upliftTarget && (
        <UpliftModal
          report={upliftTarget}
          onClose={() => setUpliftTarget(null)}
          onDone={() => {
            setUpliftTarget(null);
            showToast('Action reverted. The report has returned to the New queue.', 'success');
            load();
          }}
        />
      )}
    </main>
  );
}
