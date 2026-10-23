/**
 * NEXUS ESPORTS — Private competition join-code gate (§2.4)
 *
 * Resolves with the verified code (cached per competition for the session) or
 * null when the participant cancels. Validation always happens on the backend;
 * the cache only avoids re-prompting for the same verified competition.
 */
import { useCallback, useRef, useState } from 'react';
import JoinCodeModal from '../components/JoinCodeModal.jsx';
import { CompetitionsAPI } from '../services/api.js';

const cacheKey = (compId) => `nexus.verifiedJoinCode.${compId}`;

function readCached(compId) {
  try {
    return sessionStorage.getItem(cacheKey(compId)) || '';
  } catch (err) {
    return '';
  }
}

function writeCached(compId, code) {
  if (!compId) return;
  try {
    if (code) sessionStorage.setItem(cacheKey(compId), code);
    else sessionStorage.removeItem(cacheKey(compId));
  } catch (err) { /* sessionStorage unavailable — no cache */ }
}

export default function useJoinCodeGate(comp) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const finish = useCallback((value) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if (resolve) resolve(value);
  }, []);

  /** Returns the verified code, '' for public competitions, or null if cancelled. */
  const requireCode = useCallback(async () => {
    if (!comp || comp.visibility !== 'private') return '';
    const cached = readCached(comp.id);
    if (cached) return cached;
    if (resolverRef.current) return null; // a dialog is already open
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({ code: '', error: '', busy: false });
    });
  }, [comp]);

  async function submit(event) {
    event.preventDefault();
    const code = String(dialog?.code || '').trim();
    if (!code || !dialog || dialog.busy) {
      setDialog((d) => (d ? { ...d, error: 'Please enter the join code.' } : d));
      return;
    }
    setDialog((d) => (d ? { ...d, busy: true, error: '' } : d));
    const res = await CompetitionsAPI.joinValidate(comp.id, code);
    if (res.ok) {
      writeCached(comp.id, code);
      finish(code);
      return;
    }
    setDialog((d) => (d ? { ...d, busy: false, error: res.error || 'Invalid join code for this private competition.' } : d));
  }

  const modal = dialog ? (
    <JoinCodeModal
      open
      compName={comp?.name}
      code={dialog.code}
      error={dialog.error}
      busy={dialog.busy}
      onChange={(value) => setDialog((d) => (d ? { ...d, code: value, error: '' } : d))}
      onSubmit={submit}
      onClose={() => finish(null)}
    />
  ) : null;

  return { requireCode, modal };
}
