/**
 * NEXUS ESPORTS — Community Moderator Activity
 *
 * Reuses the Competition Admin Activity layout: account summary card, stat
 * counters, audit timeline cards, expandable details and the same empty state.
 * Data comes from the local report store, filtered to resolved/discarded
 * moderator-queue reports handled by the selected Community Moderator.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { findAccount } from '../../services/auth.js';
import { LocalReportsAPI } from '../../services/local/reporting.js';
import useReportSync from '../../hooks/useReportSync.js';
import { capitalise, formatDate, reportCode } from '../../lib/reporting.js';
import '../../styles/pages/admin/dashboard.css';

const isSuperAdmin = (session) => ['super-admin', 'super_admin'].includes(String(session?.role || '').toLowerCase());

const STATUS_META = {
  resolved: { label: 'RESOLVED', icon: '✅', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  discarded: { label: 'DISCARDED', icon: '🗑️', bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
};

export default function ModeratorActivity() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const targetUsername = (params.get('admin') || session?.username || '').trim();
  const targetAccount = useMemo(() => findAccount(targetUsername), [targetUsername]);
  const displayName = targetAccount?.displayName || targetUsername || 'Community Moderator';
  const email = targetAccount?.email || (targetUsername.includes('@') ? targetUsername : `${targetUsername}@nexus.gg`);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set());

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
      setRows(Array.isArray(res.data) ? res.data : []);
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

  const resolvedCount = rows.filter((row) => row.status === 'resolved').length;
  const discardedCount = rows.filter((row) => row.status === 'discarded').length;
  const superAdminView = isSuperAdmin(session);

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
          <h1 className="admin-title">Moderator <span style={{ color: 'var(--accent,#c6ff33)' }}>Activity Logs</span></h1>
          <p className="admin-desc">Resolved and discarded organiser reports handled by this Community Moderator.</p>
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
              <span id="admin-email-text" style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{targetUsername || '—'} · {email}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Resolved</div>
            <div id="stat-resolved-count" style={{ fontSize: 20, fontWeight: 900, color: '#22c55e' }}>{resolvedCount}</div>
          </div>
          <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Discarded</div>
            <div id="stat-discarded-count" style={{ fontSize: 20, fontWeight: 900, color: '#94a3b8' }}>{discardedCount}</div>
          </div>
          <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Cases</div>
            <div id="stat-total-count" style={{ fontSize: 20, fontWeight: 900, color: '#c6ff33' }}>{rows.length}</div>
          </div>
        </div>
      </div>

      <section style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10 }}><span>🚩 Report Activity Timeline</span></h3>
          <div id="log-count-text" style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            Showing {rows.length} activity record{rows.length === 1 ? '' : 's'} for {targetUsername || 'this moderator'}
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
            <div id="activity-timeline-list" style={{ display: rows.length ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
              {rows.map((row, index) => {
                const meta = STATUS_META[row.status] || STATUS_META.resolved;
                const handledAt = row.status === 'discarded' ? row.discardedAt : row.resolvedAt;
                const key = row.id || `activity-${index}`;
                const isExpanded = expanded.has(key);
                const evidence = Array.isArray(row.evidence) ? row.evidence : [];
                const canOpenReport = !superAdminView;

                return (
                  <div key={key} style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`, letterSpacing: '0.5px' }}>{meta.label}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>{reportCode(row)}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>🕒 {handledAt ? formatDate(handledAt) : 'Recently'}</span>
                    </div>

                    <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
                      {capitalise(row.reasonCode)} · @{row.reporterUsername} → @{row.reportedUsername}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {row.competitionName && <span>🏆 {row.competitionName}</span>}
                      <span>⚡ {capitalise(row.priority)} priority</span>
                      {row.status === 'resolved' && <span>Finding: {capitalise(row.finding)}</span>}
                      {row.status === 'discarded' && <span>Reason: {capitalise(row.discardReason)}</span>}
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

                      {isExpanded && (
                        <div style={{ marginTop: 12, background: '#0d0f14', border: '1px solid rgba(198,255,51,0.25)', borderRadius: 12, padding: '18px 20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 18px', background: '#07080a', border: '1px solid #1f242d', borderRadius: 8, padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Report ID</div><div style={{ color: '#ffffff', fontWeight: 700 }}>{reportCode(row)}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Category</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{capitalise(row.reasonCode)}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Reporter</div><div style={{ color: '#ffffff', fontWeight: 600 }}>@{row.reporterUsername}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Reported organiser</div><div style={{ color: '#ffffff', fontWeight: 600 }}>@{row.reportedUsername}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Competition</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{row.competitionName || '—'}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Final status</div><div style={{ color: meta.color, fontWeight: 700 }}>{capitalise(row.status)}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>{row.status === 'discarded' ? 'Discarded on' : 'Resolved on'}</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{handledAt ? formatDate(handledAt) : '—'}</div></div>
                            <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Handled by</div><div style={{ color: '#ffffff', fontWeight: 600 }}>@{row.status === 'discarded' ? row.discardedBy : row.resolvedBy}</div></div>
                            {row.status === 'resolved' && <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Finding / Action</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{capitalise(row.finding)} · {capitalise(row.action)}</div></div>}
                            {row.status === 'discarded' && <div><div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Discard reason</div><div style={{ color: '#ffffff', fontWeight: 600 }}>{capitalise(row.discardReason)}</div></div>}
                          </div>

                          {row.description && (
                            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              <strong style={{ color: '#ffffff', display: 'block', marginBottom: 2 }}>Report description:</strong>
                              {row.description}
                            </div>
                          )}

                          {(row.conclusion || row.discardNote) && (
                            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              <strong style={{ color: '#ffffff', display: 'block', marginBottom: 2 }}>{row.status === 'discarded' ? 'Discard notes:' : 'Conclusion:'}</strong>
                              {row.conclusion || row.discardNote}
                            </div>
                          )}

                          {evidence.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 6 }}>Evidence</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {evidence.map((file, evidenceIndex) => (
                                  <a key={`${key}-ev-${evidenceIndex}`} href={file.url} target="_blank" rel="noreferrer" className="btn-table-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                                    {file.filename || `Evidence ${evidenceIndex + 1}`}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                            {canOpenReport ? (
                              <Link to={`/pages/moderator/report-detail.html?id=${encodeURIComponent(row.id)}`} className="btn-table-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 12, fontWeight: 800, borderRadius: 6, background: '#c6ff33', color: '#000', textDecoration: 'none' }}>
                                Open report ↗
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

            {rows.length === 0 && !error && (
              <div id="activity-empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: '#141414', border: '1px dashed #262626', borderRadius: 12 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <h4 style={{ margin: '0 0 6px', color: '#ffffff', fontSize: 16, fontWeight: 700 }}>No Activity Found</h4>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>This Community Moderator has no resolved or discarded reports yet.</p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
