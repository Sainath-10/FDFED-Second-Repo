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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamsAPI } from '../services/api.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';

export function useTeamContext() {
  const [version, setVersion] = useState(0);
  const [serverTeam, setServerTeam] = useState(null);
  const [checkingPermission, setCheckingPermission] = useState(true);

  const ctx = useMemo(() => {
    if (!NexusTeamWorkflow || typeof NexusTeamWorkflow.resolveTeamContext !== 'function') return null;
    return NexusTeamWorkflow.resolveTeamContext();
  }, [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Roster and invites change on other devices, so refresh them from the backend.
  const compId = ctx && ctx.comp ? ctx.comp.id : null;
  const teamId = ctx && ctx.team ? ctx.team.id : null;
  useEffect(() => {
    if (!compId || !teamId || !NexusTeamWorkflow || typeof NexusTeamWorkflow.syncTeamFromBackend !== 'function') { setCheckingPermission(false); return undefined; }
    let cancelled = false;
    setCheckingPermission(true);
    async function sync() {
      const response = await TeamsAPI.getById(ctx.team.dbId || teamId);
      if (cancelled) return;
      setServerTeam(response.ok ? response.data : null);
      setCheckingPermission(false);
      if (response.ok) {
        const changed = await NexusTeamWorkflow.syncTeamFromBackend(compId, teamId);
        if (changed && !cancelled) refresh();
      }
    }
    sync().catch(() => { if (!cancelled) { setServerTeam(null); setCheckingPermission(false); } });
    const timer = setInterval(() => sync().catch(() => { if (!cancelled) { setServerTeam(null); setCheckingPermission(false); } }), 10000);
    const onFocus = () => sync().catch(() => { if (!cancelled) { setServerTeam(null); setCheckingPermission(false); } });
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [compId, teamId, refresh]);

  const canManage = useMemo(() => {
    if (!ctx?.session || !serverTeam || String(serverTeam.id) !== String(ctx.team.dbId || teamId)) return false;
    const username = (ctx.session.username || '').toLowerCase();
    if (['admin', 'super_admin'].includes(ctx.session.role)) return true;
    return !['rejected', 'banned', 'disbanded'].includes(serverTeam.status)
      && username === (serverTeam.leaderId || '').toLowerCase()
      && (serverTeam.memberUsernames || []).some(name => name.toLowerCase() === username);
  }, [ctx, serverTeam, teamId]);

  const isEnded = useMemo(() => {
    if (!ctx || !ctx.comp) return false;
    return !!(ctx.comp.ended || ctx.comp.status === 'completed');
  }, [ctx]);

  const isStarted = useMemo(() => hasCompetitionStarted(ctx && ctx.comp), ctx ? [ctx.comp] : [ctx]);

  return { ctx, refresh, canManage, checkingPermission, isEnded, isStarted };
}

export default useTeamContext;


