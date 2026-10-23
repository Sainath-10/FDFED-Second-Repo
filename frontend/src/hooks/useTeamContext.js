/**
 * §6 — a single, shared competition-started check used by every team page so
 * roster rules cannot diverge between screens.
 */
export function hasCompetitionStarted(comp, now = new Date()) {
  if (!comp) return false;
  if (comp.started === true || comp.startedAt) return true;
  if (String(comp.status || '').toLowerCase() === 'ongoing') return true;
  const startRaw = comp.startDate || comp.startAt || comp.startedAt || null;
  if (!startRaw) return false;
  // date-only values count as start-of-day in local time → matches organizer intent
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(startRaw))) {
    const [y, m, d] = String(startRaw).split('-').map(Number);
    const d0 = new Date(y, m - 1, d, 0, 0, 0, 0);
    return now.getTime() >= d0.getTime();
  }
  const d = new Date(startRaw);
  return !isNaN(d.getTime()) && now.getTime() >= d.getTime();
}

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

  const isStarted = useMemo(() => hasCompetitionStarted(ctx && ctx.comp), ctx ? [ctx.comp] : [ctx]);

  return { ctx, refresh, canManage, isEnded, isStarted };
}

export default useTeamContext;


