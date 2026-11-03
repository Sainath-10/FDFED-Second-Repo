import { useEffect, useRef, useState } from 'react';
import { ChatAPI } from '../services/api.js';
import '../styles/components/chat-room.css';

export default function ChatRoom({ scope, id, channel, username, canPost = true }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setMessages([]); setDraft(''); setError(''); setLoading(true);
    async function load() {
      const response = scope === 'team' ? await ChatAPI.listTeam(id) : await ChatAPI.listCompetition(id, channel);
      if (cancelled) return;
      if (response.ok) { setMessages(response.data || []); setError(''); }
      else setError(response.error || 'Could not load messages.');
      setLoading(false);
    }
    load();
    const timer = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [scope, id, channel]);

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }); }, [messages.length]);

  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || !canPost) return;
    setSending(true); setError('');
    const response = scope === 'team' ? await ChatAPI.postTeam(id, body) : await ChatAPI.postCompetition(id, channel, body);
    setSending(false);
    if (!response.ok) { setError(response.error || 'Could not send message.'); return; }
    setDraft('');
    setMessages(current => current.some(message => message.id === response.data.id) ? current : [...current, response.data].slice(-100));
  }

  return <div className="chat-room">
    <div className="chat-room-messages" role="log" aria-label="Chat messages" aria-live="polite">
      {loading && <p className="chat-room-empty">Loading messages…</p>}
      {!loading && !messages.length && !error && <p className="chat-room-empty">No messages yet.</p>}
      {messages.map(message => <article className={`chat-message${message.authorUsername?.toLowerCase() === username?.toLowerCase() ? ' is-own' : ''}`} key={message.id}>
        <div><strong>{message.authorUsername}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></div>
        <p>{message.body}</p>
      </article>)}
      <div ref={endRef} />
    </div>
    {error && <p className="chat-room-error" role="alert">{error}</p>}
    {canPost ? <form className="chat-room-compose" onSubmit={send}>
      <label className="sr-only" htmlFor={`chat-draft-${scope}-${channel || id}`}>Message</label>
      <textarea id={`chat-draft-${scope}-${channel || id}`} rows="2" maxLength={1000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={channel === 'announcements' ? 'Write an announcement…' : 'Write a message…'} />
      <button type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</button>
    </form> : <p className="chat-room-readonly">Only the competition organizers can post announcements.</p>}
  </div>;
}
