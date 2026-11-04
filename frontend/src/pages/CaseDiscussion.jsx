/**
 * NEXUS ESPORTS — Case Discussion Room
 *
 * A controlled room for one report: reviewer, reporter, accused and any
 * explicitly added competition participant. Access is enforced by the report
 * engine; once ended the room is read-only and the history is preserved.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LocalReportsAPI as ReportsAPI, prepareEvidenceFile } from '../services/local/reporting.js';
import useReportSync from '../hooks/useReportSync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PRIORITY_META, capitalise, formatDate, reportCode } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import EvidenceGallery from '../components/EvidenceGallery.jsx';
import '../styles/pages/reports.css';
import '../styles/pages/report-workspace.css';

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
  const [adding, setAdding] = useState(false);
  const [participantNote, setParticipantNote] = useState(null);

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

  async function addWitness(event) {
    event?.preventDefault();
    const username = witness.trim().replace(/^@/, '');
    if (!username || adding) return;
    setAdding(true);
    setParticipantNote(null);
    const res = await ReportsAPI.addParticipant(discussionId, username);
    setAdding(false);
    if (!res.ok) {
      setParticipantNote({ type: 'error', text: res.error || 'Unable to add this participant.' });
      return;
    }
    setParticipantNote({ type: 'success', text: `@${username} was added to this case discussion.` });
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
  const isParticipant = participants.some((person) => String(person.username).toLowerCase() === me);
  const priority = PRIORITY_META[report.priority] || PRIORITY_META.medium;
  const roleOf = (username) => participants
    .find((person) => String(person.username).toLowerCase() === String(username).toLowerCase())?.role || 'participant';

  return (
    <main className="main-content reports-page discussion-room">
      <header className="discussion-room-head">
        <div>
          <h1 className="reports-title">Case Discussion</h1>
          <div className="discussion-room-head-meta">
            <span className="discussion-room-code">{reportCode(report)}</span>
            <span className="discussion-room-chip">{capitalise(report.reasonCode)}</span>
            <span className="discussion-room-chip">{capitalise(report.status)}</span>
            <span
              className="discussion-room-chip"
              style={{ color: priority.color, background: priority.bg, borderColor: priority.border }}
            >
              {priority.label} priority
            </span>
            <span className="discussion-room-chip">{readOnly ? 'Read-only' : 'Open'}</span>
          </div>
        </div>
        <Link className="report-btn" to="/pages/my-reports.html">Back to Reports</Link>
      </header>

      {Array.isArray(report.decisionHistory) && report.decisionHistory.length > 0 && (() => {
        const last = report.decisionHistory[report.decisionHistory.length - 1];
        return (
          <div className="report-context-card">
            <div className="report-context-head">
              Decision under discussion{last.status === 'uplifted' ? ' — previous action uplifted' : ''}
            </div>
            <div className="report-context-row"><span>Finding</span><strong>{capitalise(last.finding)}</strong></div>
            <div className="report-context-row"><span>Action</span><strong>{capitalise(last.action)}</strong></div>
            <div className="report-context-row"><span>Recorded by</span><strong>@{last.decidedBy}</strong></div>
            {report.appealStatus === 'submitted' && (
              <div className="report-context-row"><span>Appeal</span><strong>Submitted — decision remains active</strong></div>
            )}
            {last.status === 'uplifted' && last.upliftReason && (
              <p className="report-context-note">Uplifted: {last.upliftReason}</p>
            )}
            {last.conclusion && <p className="report-context-note">{last.conclusion}</p>}
          </div>
        );
      })()}

      {readOnly && <div className="report-inline-ok">This discussion has ended. The history is preserved and cannot be modified.</div>}

      <div className="discussion-room-grid">
        <section className="discussion-room-chat">
          <div className="discussion-room-chat-head">
            <h2>Messages</h2>
            <span>{messages.length} message{messages.length === 1 ? '' : 's'}</span>
          </div>

          <div className="discussion-room-thread">
            {messages.length === 0 && <div className="report-empty">No messages yet. Start the conversation below.</div>}
            {messages.map((message) => {
              const mine = String(message.authorUsername).toLowerCase() === me;
              const attachments = Array.isArray(message.evidence) && message.evidence.length
                ? message.evidence
                : message.evidenceUrls;
              return (
                <article key={message.id} className={`discussion-room-msg ${mine ? 'is-mine' : ''}`}>
                  <span className="discussion-room-avatar">
                    {String(message.authorUsername || '?').replace(/^@/, '').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="discussion-room-bubble">
                    <div className="discussion-room-msg-head">
                      <span className="discussion-room-author">@{message.authorUsername}</span>
                      <span className="discussion-room-role">{capitalise(roleOf(message.authorUsername))}</span>
                      <span className="discussion-room-time">{formatDate(message.createdAt)}</span>
                    </div>
                    <p className="discussion-room-msg-body">{message.body}</p>
                    <EvidenceGallery files={attachments} compact />
                  </div>
                </article>
              );
            })}
          </div>

          {!readOnly && isParticipant ? (
            <form className="discussion-room-composer" onSubmit={send}>
              <label htmlFor="message">Your message</label>
              <textarea
                id="message"
                rows={3}
                maxLength={2000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write your response to this case…"
              />
              <div className="discussion-room-composer-row">
                <div className="discussion-room-attach">
                  <label className="report-btn" htmlFor="message-evidence">＋ Attach evidence</label>
                  <input
                    id="message-evidence"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))}
                  />
                  <span>
                    {files.length
                      ? `${files.length} image${files.length === 1 ? '' : 's'} ready to send`
                      : 'PNG, JPEG or WEBP · up to 5 images, 5 MB each'}
                  </span>
                </div>
                <div className="discussion-room-composer-actions">
                  <button type="submit" className="report-btn primary" disabled={busy || !body.trim()}>
                    {busy ? 'Sending…' : 'Send message'}
                  </button>
                  {canModerate && (
                    <button type="button" className="report-btn danger" onClick={endDiscussion}>
                      End discussion
                    </button>
                  )}
                </div>
              </div>
            </form>
          ) : (
            <div className="discussion-room-locked">
              {readOnly ? 'This room is closed.' : 'You can read this case but cannot post in it.'}
            </div>
          )}
        </section>

        <aside className="discussion-room-side">
          <div className="case-panel">
            <h3>Case information</h3>
            <dl className="case-facts">
              <div><dt>Report</dt><dd>{reportCode(report)}</dd></div>
              <div><dt>Status</dt><dd>{capitalise(report.status)}</dd></div>
              <div><dt>Priority</dt><dd style={{ color: priority.color }}>{priority.label}</dd></div>
              <div><dt>Reporter</dt><dd>@{report.reporterUsername}</dd></div>
              <div><dt>Accused</dt><dd>@{report.reportedUsername}</dd></div>
              <div><dt>Competition</dt><dd>{report.competitionName || '—'}</dd></div>
              <div><dt>Opened</dt><dd>{formatDate(discussion.createdAt)}</dd></div>
            </dl>
          </div>

          <div className="case-panel">
            <h3>Participants</h3>
            <ul className="case-people">
              {participants.map((person) => (
                <li key={person.id}>
                  <span className="case-avatar">
                    {String(person.username || '?').replace(/^@/, '').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="case-person-name">@{person.username}</span>
                  <span className="case-role">{capitalise(person.role)}</span>
                </li>
              ))}
            </ul>
            {!readOnly && canModerate && (
              <form className="case-add" onSubmit={addWitness}>
                <input
                  aria-label="Participant username"
                  placeholder="Player registered in this competition"
                  value={witness}
                  onChange={(event) => { setWitness(event.target.value); setParticipantNote(null); }}
                />
                <button type="submit" className="report-btn" disabled={adding || !witness.trim()}>
                  {adding ? 'Adding…' : 'Add participant'}
                </button>
                {participantNote && (
                  <p className={participantNote.type === 'error' ? 'case-add-error' : 'case-add-ok'} role="status">
                    {participantNote.text}
                  </p>
                )}
                <p className="case-add-hint">
                  Only players registered in this competition can be added. The reporter and the accused are always
                  part of the case.
                </p>
              </form>
            )}
          </div>

          <div className="case-panel">
            <h3>Original evidence</h3>
            <EvidenceGallery files={evidence} emptyLabel="No files attached to this report." />
          </div>
        </aside>
      </div>
    </main>
  );
}
