/**
 * NEXUS ESPORTS — report-system sync hook.
 *
 * Re-runs the caller's loader whenever this tab or another tab writes to the
 * local report/reputation store. Pass a stable loader (useCallback) so the
 * subscription is not recreated on every render.
 */
import { useEffect } from 'react';
import { subscribe } from '../services/local/storage.js';

export default function useReportSync(handler) {
  useEffect(() => {
    if (typeof handler !== 'function') return undefined;
    return subscribe(() => handler());
  }, [handler]);
}
