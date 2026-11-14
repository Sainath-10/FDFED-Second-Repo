/**
 * NEXUS ESPORTS — Community Moderator report view
 *
 * Opened from Activity Logs → View Report. Exactly two tabs:
 * Discussion (persisted room history) and Timeline (persisted competition,
 * report and moderation audit events in chronological order).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ReportsAPI } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useReportSync from '../../hooks/useReportSync.js';
import EvidenceGallery from '../../components/EvidenceGallery.jsx';
import { capitalise, formatDate, reportCode } from '../../lib/reporting.js';
import '../../styles/pages/reports.css';
import '../../styles/pages/admin/dashboard.css';

const TABS = [
  { key: 'discussion', label: 'Discussion' },
  { key: 'timeline', label: 'Timeline' },
];

const sameUser = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

const eventLabel = (type) => capitalise(String(type || 'event').replace(/_/g, ' '));

export default function ModeratorCaseView() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const { session } = useAuth();
  const [tab, setTab] = useState('discussion');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) { setError('No report was selected.'); return; }
    const res = await ReportsAPI.caseView(id);
    if (!res.ok) { setError(res.error || 'Unable to load this report.'); return; }
    setData(res.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  if (error) {
    return (
      <main className="admin-page reports-page">
        <div className="report-inline-error">{error}</div>
        <Link className="report-btn" to="/pages/moderator/activity.html">Back to Activity Logs</Link>
      </main>
    );
  }
  if (!data) {
    return <main className="admin-page reports-page"><div className="report-empty">Loading report…</div></main>;
  }

  const { report, discussion, discussionActivity = [], evidence = [], timeline = [] } = data;
  const roomClosed = discussion?.status === 'ended';
  const messageCount = discussion?.messages?.length || 0;
  const myName = session?.username || '';

  // Messages and room events share one chronological history.
  const history = [
    ...(discussion?.messages || []).map((message) => ({
      key: `message-${message.id}`,
      kind: 'message',
      at: message.createdAt,
      message,
    })),
    ...discussionActivity.map((event) => ({
      key: `event-${event.id}`,
      kind: 'event',
      at: event.at,
      event,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const roleOf = (username) => discussion?.participants
    ?.find((person) => sameUser(person.username, username))?.role || 'participant';

  return (
    <main className="admin-page reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">{reportCode(report)} · Report details</h1>
          <p className="reports-subtitle">
            @{report.reporterUsername} reported @{report.reportedUsername} · {capitalise(report.reasonCode)}
            {report.competitionName ? ` · ${report.competitionName}` : ''}
          </p>
        </div>
        <Link className="report-btn" to="/pages/moderator/activity.html">Back to Activity Logs</Link>
      </div>

      <div className="report-card" style={{ marginBottom: 18 }}>
        <div className="report-card-top">
          <span className="report-pill" style={{ color: '#c6ff33', border: '1px solid rgba(198,255,51,0.35)' }}>
            {capitalise(report.status)}
          </span>
          <span className="report-pill" style={{ color: '#cbd5e1', border: '1px solid #334155' }}>
            {capitalise(report.reasonCode)}
          </span>
          <span className="report-meta" style={{ margin: 0 }}>
            Selected report · {formatDate(report.createdAt)}
          </span>
        </div>
        <p className="report-desc">{report.description}</p>
      </div>

      <div className="investigation-tabs" role="tablist" aria-label="Report details">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={`investigation-tab ${tab === entry.key ? 'active' : ''}`}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'discussion' && (
        <div className="investigation-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <section className="info-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Discussion history</h3>
              <span className="report-pill" style={{ color: roomClosed ? '#fbbf24' : '#c6ff33', border: '1px solid #334155' }}>
                {discussion ? (roomClosed ? 'Read-only · closed' : 'Open') : 'No discussion'}
              </span>
            </div>

            {!discussion ? (
              <div className="report-empty" style={{ margin: 0 }}>No discussion was opened for this report.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                  {history.length === 0 && <div className="report-empty" style={{ margin: 0 }}>The discussion has no messages yet.</div>}
                  {history.map((entry) => entry.kind === 'event' ? (
                    <div
                      key={entry.key}
                      style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(148,163,184,0.04)', color: '#94a3b8', fontSize: 12 }}
                    >
                      <strong style={{ color: '#cbd5e1' }}>{eventLabel(entry.event.action)}</strong>
                      {entry.event.details ? ` — ${entry.event.details}` : ''}
                      <div style={{ marginTop: 3 }}>@{entry.event.actor || 'system'} · {formatDate(entry.at)}</div>
                    </div>
                  ) : (
                    <article
                      key={entry.key}
                      style={{ padding: '11px 13px', borderRadius: 10, border: '1px solid #262626', background: '#0d0d0d' }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                        <strong style={{ color: '#f8fafc', fontSize: 13 }}>@{entry.message.authorUsername}</strong>
                        <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155', padding: '2px 8px' }}>
                          {capitalise(roleOf(entry.message.authorUsername))}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 11.5 }}>{formatDate(entry.at)}</span>
                      </div>
                      <p style={{ margin: '0 0 6px', color: '#e2e8f0', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                        {entry.message.body}
                      </p>
                      <EvidenceGallery files={entry.message.evidence || entry.message.evidenceUrls || []} compact />
                    </article>
                  ))}
                </div>
                <p style={{ margin: '0 0 14px', color: '#94a3b8', fontSize: 12 }}>
                  {messageCount} message{messageCount === 1 ? '' : 's'} preserved from the beginning of this discussion.
                </p>
              </>
            )}

            <h3>Report evidence</h3>
            {evidence.length === 0 ? (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 12.5 }}>No files attached to this report.</p>
            ) : (
              <EvidenceGallery files={evidence} />
            )}
          </section>
        </div>
      )}

      {tab === 'timeline' && (
        <section className="info-card">
          <h3>Competition timeline</h3>
          <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 12.5 }}>
            Persisted events in chronological order. The selected report is {reportCode(report)}.
          </p>
          {timeline.length === 0 ? (
            <div className="report-empty" style={{ margin: 0 }}>No persisted timeline events were recorded for this competition.</div>
          ) : (
            <ul className="timeline">
              {timeline.map((event, index) => {
                const mine = sameUser(event.actor, myName) && String(event.reportId || '') === String(report.id);
                return (
                  <li
                    key={`${event.type}-${event.at}-${index}`}
                    style={mine ? { background: 'rgba(198,255,51,0.06)', border: '1px solid rgba(198,255,51,0.28)', borderRadius: 8, padding: '9px 12px' } : undefined}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: mine ? '#c6ff33' : '#e2e8f0' }}>{eventLabel(event.type)}</strong>
                      {mine && (
                        <span className="report-pill" style={{ color: '#c6ff33', border: '1px solid rgba(198,255,51,0.4)', padding: '2px 8px' }}>
                          Your action on this report
                        </span>
                      )}
                      {String(event.reportId || '') === String(report.id) && event.source === 'report' && (
                        <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155', padding: '2px 8px' }}>
                          {reportCode(report)}
                        </span>
                      )}
                    </div>
                    {event.details && <div style={{ marginTop: 4, color: '#cbd5e1' }}>{event.details}</div>}
                    {event.reason && event.reason !== event.details && (
                      <div style={{ marginTop: 3, color: '#94a3b8' }}>Reason: {event.reason}</div>
                    )}
                    <span className="t" style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: 11 }}>
                      {formatDate(event.at)} · @{event.actor || 'system'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
