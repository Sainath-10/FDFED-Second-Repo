/**
 * NEXUS ESPORTS — appeal details (Community Moderator)
 *
 * The "View" page for an appeal: the original case discussion between the
 * organiser, reporter and accused player (messages and evidence, read-only),
 * and the competition's audit timeline. Act and Discuss are available here too.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ReportsAPI } from '../../services/api.js';
import useReportSync from '../../hooks/useReportSync.js';
import EvidenceGallery from '../../components/EvidenceGallery.jsx';
import { AppealDecisionModal } from '../../components/ReportActionModals.jsx';
import { ErrorState, LoadingState } from '../../components/ui.jsx';
import { capitalise, formatDate } from '../../lib/reporting.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/reports.css';

const TABS = [
  { id: 'discussion', label: 'Previous Discussion' },
  { id: 'timeline', label: 'Timeline' },
];

export default function AppealDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('discussion');
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setError('No appeal was selected.'); return; }
    const res = await ReportsAPI.appealDetails(id);
    if (res.ok) { setData(res.data); setError(''); } else setError(res.error || 'Unable to load this appeal.');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  async function discuss() {
    const res = await ReportsAPI.appealRoom(id);
    if (!res.ok) { showToast(res.error || 'Unable to open the discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${res.data.discussionId}`);
  }

  if (error) return <main className="main-content reports-page"><ErrorState message={error} onRetry={load} /></main>;
  if (!data) return <main className="main-content reports-page"><LoadingState label="Loading appeal…" /></main>;

  const { report, discussion, evidence, timeline } = data;
  const pending = ['submitted', 'deciding'].includes(report.appealStatus);
  const messages = discussion?.messages || [];
  const roleOf = (name) => (discussion?.participants || []).find((p) => String(p.username).toLowerCase() === String(name).toLowerCase())?.role || '';
  const latest = report.latestDecision || {};

  return (
    <main className="main-content reports-page">
      <div className="reports-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 className="reports-title">{report.code} · Appeal</h1>
          <p className="reports-subtitle">
            @{report.reportedUsername} appealed {report.appealKind === 'player' ? "the organiser's" : 'the'} decision
            ({capitalise(latest.action || report.action)}) in {report.competitionName}.
          </p>
        </div>
        <div className="report-actions" style={{ marginTop: 0 }}>
          <Link className="report-btn" to="/pages/moderator/reports.html">Back to reports</Link>
          {pending && <button className="report-btn" onClick={discuss}>Discuss</button>}
          {pending && <button className="report-btn primary" onClick={() => setDeciding(true)}>Act</button>}
        </div>
      </div>

      <div className="report-card" style={{ marginBottom: 20 }}>
        <div className="report-card-top">
          <span className="report-code">{report.code}</span>
          <span className="report-pill" style={{ color: pending ? '#fbbf24' : '#94a3b8', border: '1px solid #334155' }}>
            {pending ? 'Appeal pending' : `Appeal ${report.appealOutcome || 'closed'}`}
          </span>
          <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>{capitalise(report.reasonCode)}</span>
        </div>
        <div className="report-meta">
          <span>@{report.reporterUsername} → @{report.reportedUsername}</span>
          <span>Decided by @{latest.decidedBy || report.resolvedBy}</span>
          <span>Appealed {formatDate(report.appealedAt)}</span>
        </div>
        <p className="report-context-note"><strong>Original report:</strong> {report.description}</p>
        {report.conclusion && <p className="report-context-note"><strong>Organiser's conclusion:</strong> {report.conclusion}</p>}
        <p className="report-context-note"><strong>Appeal reason:</strong> {report.appealReason || '—'}</p>
        {report.appealDecisionReason && <p className="report-context-note"><strong>Moderator decision:</strong> {report.appealDecisionReason} — @{report.appealDecidedBy}</p>}
      </div>

      <div className="reports-tabs page-tabs" role="tablist" aria-label="Appeal details">
        {TABS.map((t) => (
          <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} className={`reports-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}{t.id === 'discussion' ? <span className="count">{messages.length}</span> : <span className="count">{timeline.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'discussion' ? (
        <section>
          {!discussion && <div className="report-empty">The organiser decided this report without opening a discussion. Use Discuss to open one with everyone involved.</div>}
          {discussion && messages.length === 0 && <div className="report-empty">The discussion was opened but no messages were posted.</div>}
          <div className="reports-list">
            {messages.map((message) => {
              const files = Array.isArray(message.evidence) && message.evidence.length ? message.evidence : message.evidenceUrls;
              return (
                <article className="report-card" key={message.id}>
                  <div className="report-card-top">
                    <span className="report-code">@{message.authorUsername}</span>
                    {roleOf(message.authorUsername) && <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>{capitalise(roleOf(message.authorUsername))}</span>}
                    <span className="report-meta" style={{ marginLeft: 'auto' }}>{formatDate(message.createdAt)}</span>
                  </div>
                  <p className="report-context-note" style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>
                  <EvidenceGallery files={files} compact />
                </article>
              );
            })}
          </div>
          {evidence?.length > 0 && (
            <>
              <h3 style={{ color: '#fff', fontSize: 15, margin: '22px 0 10px' }}>Evidence attached to the report</h3>
              <EvidenceGallery files={evidence} />
            </>
          )}
        </section>
      ) : (
        <section className="report-card">
          {timeline.length === 0 && <div className="report-empty">No recorded activity for this competition yet.</div>}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {timeline.map((row, index) => (
              <li key={`${row.at}-${index}`} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.source === 'report' ? '#60a5fa' : '#c6ff33', marginTop: 7 }} aria-hidden="true" />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                    {String(row.type || '').replace(/_/g, ' ')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>— {row.details}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{formatDate(row.at)} · @{row.actor || 'system'}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {deciding && (
        <AppealDecisionModal
          report={report}
          onClose={() => setDeciding(false)}
          onDone={(_, action) => {
            setDeciding(false);
            showToast(action === 'revert' ? 'Decision reverted.' : 'Appeal discarded. The original decision stands.', 'success');
            load();
          }}
        />
      )}
    </main>
  );
}
