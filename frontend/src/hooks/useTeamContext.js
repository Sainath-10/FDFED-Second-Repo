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

  const canManage = useMemo(() => {
    if (!ctx || !ctx.team || !ctx.session) return false;
    const sessionUser = (ctx.session.username || '').toLowerCase();
    const createdBy = (ctx.team.createdBy || '').toLowerCase();
    const leader = (ctx.team.leaderId || ctx.team.leaderUsername || ctx.team.leader || '').toLowerCase();
    const role = (ctx.session.role || '').toLowerCase();
    return sessionUser === createdBy || sessionUser === leader || role === 'admin' || role === 'super_admin';
  }, [ctx]);

  const isEnded = useMemo(() => {
    if (!ctx || !ctx.comp) return false;
    return !!(ctx.comp.ended || ctx.comp.status === 'completed');
  }, [ctx]);

  return { ctx, refresh, canManage, isEnded };
}

export default useTeamContext;


