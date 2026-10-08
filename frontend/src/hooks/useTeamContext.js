/**
 * NEXUS ESPORTS — useTeamContext
 *
 * Resolves the active team context (via the team workflow service) for the team
 * pages, and exposes a `refresh()` to re-resolve after mutations.
 */
import { useCallback, useMemo, useState } from 'react';
import NexusTeamWorkflow from '../services/teamWorkflow.js';

export function useTeamContext() {
  const [version, setVersion] = useState(0);

  const ctx = useMemo(() => {
    if (!NexusTeamWorkflow || typeof NexusTeamWorkflow.resolveTeamContext !== 'function') return null;
    return NexusTeamWorkflow.resolveTeamContext();
  }, [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { ctx, refresh };
}

export default useTeamContext;


