/**
 * NEXUS ESPORTS — Case Discussion Room
 *
 * A controlled room for one report: reviewer, reporter, accused and any
 * explicitly added witness. Access is enforced server-side; once ended the room
 * is read-only and the history is preserved.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LocalReportsAPI as ReportsAPI, prepareEvidenceFile } from '../services/local/reporting.js';
import useReportSync from '../hooks/useReportSync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { capitalise, formatDate, reportCode } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/reports.css';

export default function CaseDiscussion() {
  const [params] = useSearchParams();
  const discussionId = params.get('discussionId') || '';
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [witness, setWitness] = useState('');

  const load = useCallback(async () => {
    if (!discussionId) { setError('No case discussion was selected.'); return; }
    const res = await ReportsAPI.discussion(discussionId);
    if (!res.ok) { setError(res.error || 'Unable to open this discussion.'); return; }
    setData(res.data);
  }, [discussionId]);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  async function send(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const evidence = [];
    for (const file of files) {
      try {
        evidence.push(await prepareEvidenceFile(file));
      } catch (err) {
        showToast(err?.message || `${file.name} could not be attached.`, 'error');
      }
    }
    const res = await ReportsAPI.postMessage(discussionId, body.trim(), evidence);
    setBusy(false);
    if (!res.ok) { showToast(res.error || 'Unable to send the message.', 'error'); return; }
    setBody('');
    setFiles([]);
    load();
  }

  async function endDiscussion() {
    const res = await ReportsAPI.endDiscussion(discussionId);
    if (!res.ok) { showToast(res.error || 'Unable to end the discussion.', 'error'); return; }
    showToast('Discussion ended. The room is now read-only.', 'success');
    load();
  }

  async function addWitness() {
    if (!witness.trim()) return;
    const res = await ReportsAPI.addParticipant(discussionId, witness.trim());
    if (!res.ok) { showToast(res.error || 'Unable to add this participant.', 'error'); return; }
    setWitness('');
    load();
  }

  if (error) {
    return (
      <main className="main-content reports-page">
        <div className="report-inline-error">{error}</div>
        <Link className="report-btn" to="/pages/my-reports.html">Back to reports</Link>
      </main>
    );
  }

  if (!data) return <main className="main-content reports-page"><div className="report-empty">Loading case discussion…</div></main>;

  const { discussion, report, participants, messages, evidence, canModerate, readOnly } = data;
  const me = String(session?.username || '').toLowerCase();
  const isParticipant = participants.some((p) => String(p.username).toLowerCase() === me);

  return (
    <main className="main-content reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">Case discussion · {reportCode(report)}</h1>
          <p className="reports-subtitle">
            {capitalise(report.reasonCode)} · opened {formatDate(discussion.createdAt)} ·{' '}
            {readOnly ? 'read-only' : 'open'}
          </p>
        </div>
        <Link className="report-btn" to="/pages/my-reports.html">Reports</Link>
      </div>

      {readOnly && <div className="report-inline-ok">This discussion has ended. The history is preserved and cannot be modified.</div>}

      <div className="discussion-layout">
        <section className="discussion-thread">
          <h2 style={{ fontSize: 15, margin: '0 0 12px', color: '#e2e8f0' }}>Messages</h2>
          <div className="message-list">
            {messages.length === 0 && <div className="report-empty">No messages yet.</div>}
            {messages.map((message) => (
              <article key={message.id} className={`message ${String(message.authorUsername).toLowerCase() === me ? 'mine' : ''}`}>
                <div className="who">
                  @{message.authorUsername}
                  <span className="when">{formatDate(message.createdAt)}</span>
                </div>
                <div className="body">{message.body}</div>
                {Array.isArray(message.evidenceUrls) && message.evidenceUrls.length > 0 && (
                  <div className="evidence-list">
                    {message.evidenceUrls.map((url, index) => (
                      <a className="evidence-item" key={`${message.id}-${index}`} href={url} target="_blank" rel="noreferrer">
                        Evidence {index + 1}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          {!readOnly && isParticipant ? (
            <form onSubmit={send}>
              <div className="report-field">
                <label htmlFor="message">Your message</label>
                <textarea id="message" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div className="report-form-grid">
                <div className="report-field">
                  <label htmlFor="message-evidence">Additional evidence <span className="hint">Optional images</span></label>
                  <input
                    id="message-evidence"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
                  />
                </div>
              </div>
              <div className="report-actions">
                <button type="submit" className="report-btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Send message'}
                </button>
                {canModerate && (
                  <button type="button" className="report-btn danger" onClick={endDiscussion}>
                    End discussion
                  </button>
                )}
              </div>
            </form>
          ) : (
            <p style={{ color: '#64748b', fontSize: 12.5 }}>
              {readOnly ? 'This room is closed.' : 'You can read this case but cannot post in it.'}
            </p>
          )}
        </section>

        <aside className="discussion-side">
          <div className="side-card">
            <h3>Case</h3>
            <ul>
              <li><span>Report</span><span>{reportCode(report)}</span></li>
              <li><span>Status</span><span>{capitalise(report.status)}</span></li>
              <li><span>Priority</span><span>{capitalise(report.priority)}</span></li>
              <li><span>Reporter</span><span>@{report.reporterUsername}</span></li>
              <li><span>Accused</span><span>@{report.reportedUsername}</span></li>
              <li><span>Competition</span><span>{report.competitionName}</span></li>
            </ul>
          </div>

          <div className="side-card">
            <h3>Participants</h3>
            <ul>
              {participants.map((person) => (
                <li key={person.id}>
                  <span>@{person.username}</span>
                  <span style={{ color: '#c6ff33' }}>{capitalise(person.role)}</span>
                </li>
              ))}
            </ul>
            {!readOnly && canModerate && (
              <div style={{ marginTop: 12 }}>
                <input
                  className="form-input"
                  placeholder="Add a witness username"
                  value={witness}
                  onChange={(e) => setWitness(e.target.value)}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <button className="report-btn" onClick={addWitness}>Add participant</button>
              </div>
            )}
          </div>

          <div className="side-card">
            <h3>Evidence on the report</h3>
            {evidence.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 12 }}>No files attached.</p>
            ) : (
              <div className="evidence-list">
                {evidence.map((file) => (
                  <a className="evidence-item" key={file.id} href={file.url} target="_blank" rel="noreferrer">
                    {file.filename || 'Evidence'}
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
