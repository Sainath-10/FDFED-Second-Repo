/**
 * NEXUS ESPORTS — username autocomplete
 *
 * Searches usernames on the server as the user types (debounced) and shows the
 * matches in a keyboard-accessible list. Used wherever someone is invited by
 * username: team invites, co-organizers and new administrators.
 *
 *   <UsernameSearch value={text} onChange={setText} onPick={(u) => …} />
 *   <UsernameChips value={names} onChange={setNames} max={5} />
 *
 * `search(query)` can replace the default lookup (e.g. the team's own list of
 * players who can still be invited). It must resolve to [{ username, … }].
 */
import { useEffect, useId, useRef, useState } from 'react';
import { AuthAPI } from '../services/api.js';

const ROLE_LABELS = {
  participant: 'Player',
  team_lead: 'Captain',
  admin: 'Admin',
  super_admin: 'Super Admin',
  finance_moderator: 'Finance',
  community_moderator: 'Community Mod',
};

function useUserSearch(query, { scope, search, exclude, enabled }) {
  const [state, setState] = useState({ loading: false, results: [], error: '' });
  const excludeKey = (exclude || []).map((x) => String(x).toLowerCase()).sort().join(',');

  useEffect(() => {
    const q = String(query || '').trim().replace(/^@/, '');
    if (!enabled || !q) { setState({ loading: false, results: [], error: '' }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const timer = window.setTimeout(async () => {
      try {
        const rows = search ? await search(q) : await AuthAPI.searchUsers(q, scope).then((res) => {
          if (!res.ok) throw new Error(res.error || 'Search failed.');
          return res.data || [];
        });
        if (cancelled) return;
        const skip = new Set(excludeKey ? excludeKey.split(',') : []);
        setState({ loading: false, results: (rows || []).filter((r) => !skip.has(String(r.username).toLowerCase())).slice(0, 8), error: '' });
      } catch (err) {
        if (!cancelled) setState({ loading: false, results: [], error: err.message || 'Search failed.' });
      }
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, scope, search, excludeKey, enabled]);

  return state;
}

export default function UsernameSearch({
  id,
  value,
  onChange,
  onPick,
  scope = 'players',
  search,
  exclude = [],
  placeholder = 'Start typing a username…',
  disabled = false,
  autoFocus = false,
  showRole = false,
  renderHint,
}) {
  const autoId = useId();
  const inputId = id || `user-search-${autoId}`;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const { loading, results, error } = useUserSearch(value, { scope, search, exclude, enabled: open && !disabled });

  useEffect(() => { setActive(0); }, [results]);
  useEffect(() => {
    const close = (event) => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function pick(row) {
    if (!row || row.disabled) return;
    onPick?.(row.username, row);
    setOpen(false);
  }

  function onKeyDown(event) {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { setOpen(true); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter' && open && results[active]) { event.preventDefault(); pick(results[active]); }
    else if (event.key === 'Escape') setOpen(false);
  }

  const query = String(value || '').trim();
  const showList = open && query.length > 0;

  return (
    <div className="ui-combobox" ref={wrapRef}>
      <div className="ui-combobox-field">
        <span className="ui-combobox-at" aria-hidden="true">@</span>
        <input
          id={inputId}
          className="form-input ui-combobox-input"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={40}
          onChange={(e) => { onChange(e.target.value.replace(/^@/, '')); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="ui-combobox-spinner" aria-hidden="true" />}
      </div>
      {showList && (
        <ul className="ui-combobox-list" id={listId} role="listbox">
          {error && <li className="ui-combobox-empty">{error}</li>}
          {!error && !loading && results.length === 0 && <li className="ui-combobox-empty">No matching usernames.</li>}
          {results.map((row, i) => (
            <li
              key={row.username}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={row.disabled || undefined}
              className={`ui-combobox-option${i === active ? ' is-active' : ''}${row.disabled ? ' is-disabled' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(row); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="ui-combobox-avatar" aria-hidden="true">{String(row.username).charAt(0).toUpperCase()}</span>
              <span className="ui-combobox-name">@{row.username}</span>
              {(renderHint?.(row) || (showRole && ROLE_LABELS[row.role])) && (
                <span className="ui-combobox-hint">{renderHint?.(row) || ROLE_LABELS[row.role]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Several usernames as removable chips, each picked from the live search. */
export function UsernameChips({ value = [], onChange, max = 10, exclude = [], disabled = false, placeholder = 'Add a username…', id }) {
  const [text, setText] = useState('');
  const names = Array.isArray(value) ? value : [];
  const full = names.length >= max;
  return (
    <div className="ui-chips">
      {names.length > 0 && (
        <div className="ui-chip-row">
          {names.map((name) => (
            <span className="ui-chip" key={name}>
              @{name}
              {!disabled && (
                <button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(names.filter((n) => n !== name))}>×</button>
              )}
            </span>
          ))}
        </div>
      )}
      {!full && (
        <UsernameSearch
          id={id}
          value={text}
          onChange={setText}
          exclude={[...exclude, ...names]}
          disabled={disabled}
          placeholder={placeholder}
          onPick={(username) => { onChange([...names, username]); setText(''); }}
        />
      )}
      {full && <p className="ui-field-help">You can add up to {max}.</p>}
    </div>
  );
}
