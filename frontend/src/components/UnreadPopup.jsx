/**
 * NEXUS ESPORTS — unread notifications at sign-in
 *
 * Right after someone signs in, shows the notifications they have not read yet
 * in a pop-up, once per sign-in (a new login shows it again; moving between
 * pages does not). Each item opens the page it is about.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { NotificationsAPI, getToken } from '../services/api.js';
import { linkOf } from '../lib/notificationLinks.js';

const MAX_SHOWN = 6;

function shownKey(username) {
  const token = String(getToken() || '');
  return `nexus.unreadShown.${String(username).toLowerCase()}.${token.slice(-16)}`;
}

function timeAgo(value) {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function UnreadPopup() {
  const session = useSelector((state) => state.auth.session);
  const navigate = useNavigate();
  const username = session?.username || '';
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!username) { setOpen(false); return undefined; }
    const key = shownKey(username);
    try { if (sessionStorage.getItem(key)) return undefined; } catch { /* storage blocked: show once per load */ }
    NotificationsAPI.getForUser(username).then((res) => {
      if (cancelled) return;
      try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
      const unread = (res.ok && Array.isArray(res.data) ? res.data : [])
        .filter((n) => !n.read)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (unread.length) { setItems(unread); setOpen(true); }
    });
    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || !items.length) return null;

  async function openItem(item) {
    NotificationsAPI.markRead(item.id);
    setOpen(false);
    navigate(linkOf(item)?.to || '/pages/notifications.html');
  }

  async function markAll() {
    await NotificationsAPI.markAllRead(username);
    setOpen(false);
  }

  const extra = items.length - MAX_SHOWN;
  return (
    <section className="unread-pop" role="dialog" aria-modal="false" aria-labelledby="unread-pop-title">
      <header className="unread-pop-head">
        <span className="unread-pop-count">{items.length}</span>
        <h2 id="unread-pop-title">While you were away</h2>
        <button type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
      </header>
      <ul className="unread-pop-list">
        {items.slice(0, MAX_SHOWN).map((item) => (
          <li key={item.id}>
            <button type="button" className="unread-pop-item" onClick={() => openItem(item)}>
              <strong>{item.title}</strong>
              {item.body && <span>{item.body}</span>}
              <small>{timeAgo(item.createdAt)}</small>
            </button>
          </li>
        ))}
        {extra > 0 && <li className="ui-combobox-empty">…and {extra} more.</li>}
      </ul>
      <footer className="unread-pop-foot">
        <button type="button" className="btn-cancel" onClick={markAll}>Mark all read</button>
        <button type="button" className="btn-primary" onClick={() => { setOpen(false); navigate('/pages/notifications.html'); }}>View all</button>
      </footer>
    </section>
  );
}
