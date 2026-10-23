/**
 * NEXUS ESPORTS — Private competition join-code dialog (§2.4)
 *
 * Shared by the competition info, join-teams and create-team pages. The code
 * itself is validated by the backend (`POST /competitions/join-validate`); this
 * component only renders the form and its states.
 */
import { useEffect, useRef } from 'react';

export default function JoinCodeModal({ open, compName, code, error, busy, onChange, onSubmit, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      id="modal-join-code"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-code-title"
      style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <form
        onSubmit={onSubmit}
        style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, width: 'min(94vw,440px)', padding: 30, boxShadow: '0 20px 60px #000a', color: '#f1f5f9' }}
      >
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#c6ff33' }}>PRIVATE COMPETITION</p>
        <h2 id="join-code-title" style={{ margin: '0 0 8px', fontSize: 20 }}>Enter Join Code</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8' }}>
          {compName ? `"${compName}" ` : 'This competition '}requires the organizer&apos;s join code before you can register.
        </p>

        <label htmlFor="join-code-input" style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Join Code *</label>
        <input
          id="join-code-input"
          ref={inputRef}
          type="text"
          value={code}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck="false"
          disabled={busy}
          placeholder="Enter the code shared by the organizer"
          aria-invalid={!!error}
          aria-describedby={error ? 'join-code-error' : undefined}
          style={{ width: '100%', background: '#1e293b', border: `1px solid ${error ? '#f87171' : '#334155'}`, color: '#f1f5f9', padding: '12px 14px', borderRadius: 8, fontSize: 15, letterSpacing: 2, boxSizing: 'border-box' }}
        />
        {error && <p id="join-code-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ flex: 1, padding: 12, background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 14 }}>Cancel</button>
          <button type="submit" disabled={busy || !String(code || '').trim()} style={{ flex: 2, padding: 12, background: '#c6ff33', border: 'none', color: '#0b1120', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontSize: 14, fontWeight: 800 }}>
            {busy ? 'Checking…' : 'Validate Code'}
          </button>
        </div>
      </form>
    </div>
  );
}
