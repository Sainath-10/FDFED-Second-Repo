/**
 * NEXUS ESPORTS — case history tabs (Community Moderator)
 *
 * Two tabs over a backend case bundle (`GET /reports/:id/case` or
 * `/appeal-details`): the report's discussion from the beginning, and the
 * competition's chronological timeline. Everything shown comes from persisted
 * records; entries for the selected report, and the viewer's own actions on
 * it, are highlighted.
 */
import { useState } from 'react';
import EvidenceGallery from './EvidenceGallery.jsx';
import { capitalise, formatDate } from '../lib/reporting.js';

/** Room lifecycle events shown inline in the discussion, in time order. */
const ROOM_EVENTS = new Set([
  'DISCUSSION_OPENED', 'DISCUSSION_LOCKED', 'DISCUSSION_REOPENED', 'DISCUSSION_ENDED',
  'APPEAL_DISCUSSION_OPENED', 'DISCUSSION_PARTICIPANT_ADDED', 'DISCUSSION_PARTICIPANT_REMOVED',
]);
const typeLabel = (type) => String(type || '').replace(/_/g, ' ');
const muted = { color: '#94a3b8', border: '1px solid #334155' };
const lime = { color: '#c6ff33', background: 'rgba(198,255,51,0.1)', border: '1px solid rgba(198,255,51,0.4)' };

export default function CaseHistoryTabs({ discussion, evidence = [], timeline = [], discussionLabel = 'Discussion', reportCode = '' }) {
  const [tab, setTab] = useState('discussion');
  const messages = discussion?.messages || [];
  const participants = discussion?.participants || [];
  const roleOf = (name) => participants.find((p) => String(p.username).toLowerCase() === String(name).toLowerCase())?.role || '';

  const discussionItems = [
    ...messages.map((message) => ({ kind: 'message', at: message.createdAt, message })),
    ...(discussion ? timeline.filter((row) => row.selected && ROOM_EVENTS.has(row.type)).map((row) => ({ kind: 'event', at: row.at, row })) : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <>
      <div className="reports-tabs page-tabs" role="tablist" aria-label="Report details">
        <button type="button" role="tab" aria-selected={tab === 'discussion'} className={`reports-tab ${tab === 'discussion' ? 'active' : ''}`} onClick={() => setTab('discussion')}>
          {discussionLabel}<span className="count">{messages.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'timeline'} className={`reports-tab ${tab === 'timeline' ? 'active' : ''}`} onClick={() => setTab('timeline')}>
          Timeline<span className="count">{timeline.length}</span>
        </button>
      </div>

      {tab === 'discussion' ? (
        <section>
          {!discussion && <div className="report-empty">No discussion was opened for this report.</div>}
          {discussion && (
            <div className="report-meta" style={{ marginBottom: 12 }}>
              <span className="report-pill" style={discussion.status === 'ended' ? muted : lime}>
                {discussion.status === 'ended' ? 'Closed — read-only' : 'Open'}
              </span>
              <span>Participants: {participants.map((p) => `@${p.username}${p.role ? ` (${capitalise(p.role)})` : ''}`).join(', ') || '—'}</span>
            </div>
          )}
          {discussion && messages.length === 0 && <div className="report-empty">The discussion was opened but no messages were posted.</div>}
          <div className="reports-list">
            {discussionItems.map((item, index) => {
              if (item.kind === 'event') {
                return (
                  <div key={`event-${index}`} className="report-meta" style={{ justifyContent: 'center', padding: '4px 0' }}>
                    <span>{capitalise(typeLabel(item.row.type).toLowerCase())} · @{item.row.actor || 'system'} · {formatDate(item.row.at)}</span>
                  </div>
                );
              }
              const { message } = item;
              const files = Array.isArray(message.evidence) && message.evidence.length ? message.evidence : message.evidenceUrls;
              const role = roleOf(message.authorUsername);
              return (
                <article className="report-card" key={message.id}>
                  <div className="report-card-top">
                    <span className="report-code">@{message.authorUsername}</span>
                    {role && <span className="report-pill" style={muted}>{capitalise(role)}</span>}
                    <span className="report-meta" style={{ marginLeft: 'auto' }}>{formatDate(message.createdAt)}</span>
                  </div>
                  <p className="report-context-note" style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>
                  <EvidenceGallery files={files} compact />
                </article>
              );
            })}
          </div>
          {evidence.length > 0 && (
            <>
              <h3 style={{ color: '#fff', fontSize: 15, margin: '22px 0 10px' }}>Evidence attached to the report</h3>
              <EvidenceGallery files={evidence} />
            </>
          )}
        </section>
      ) : (
        <section className="report-card">
          <div className="report-meta" style={{ marginBottom: 14 }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#c6ff33', marginRight: 6 }} />{reportCode ? `${reportCode} (this report)` : 'This report'}</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#475569', marginRight: 6 }} />Rest of the competition</span>
          </div>
          {timeline.length === 0 && <div className="report-empty">No recorded activity for this competition yet.</div>}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {timeline.map((row, index) => (
              <li
                key={`${row.at}-${index}`}
                style={{
                  display: 'grid', gridTemplateColumns: '10px 1fr', gap: 12, padding: row.mine ? '10px 12px' : '2px 0',
                  borderRadius: 10,
                  background: row.mine ? 'rgba(198,255,51,0.06)' : 'transparent',
                  border: row.mine ? '1px solid rgba(198,255,51,0.35)' : '1px solid transparent',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.selected ? '#c6ff33' : '#475569', marginTop: 7 }} aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: row.selected ? '#fff' : '#cbd5e1', fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>
                    {typeLabel(row.type)}
                    {row.mine && <span className="report-pill" style={{ ...lime, marginLeft: 8, fontSize: 11 }}>Your action</span>}
                    <span style={{ color: '#94a3b8', fontWeight: 400 }}> — {row.details || '—'}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{formatDate(row.at)} · @{row.actor || 'system'}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
