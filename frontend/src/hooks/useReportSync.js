/**
 * NEXUS ESPORTS — live refresh hook.
 *
 * Data lives on the server, so other people's changes (a new report, a
 * moderator decision, a message) only appear after a fresh request. This hook
 * re-runs the caller's loader when the tab regains focus and every 20 seconds
 * while the tab is visible. Pass a stable loader (useCallback).
 */
import { useEffect } from 'react';

export default function useReportSync(handler, intervalMs = 20000) {
  useEffect(() => {
    if (typeof handler !== 'function') return undefined;
    const run = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') handler();
    };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    const timer = window.setInterval(run, intervalMs);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
      window.clearInterval(timer);
    };
  }, [handler, intervalMs]);
}
