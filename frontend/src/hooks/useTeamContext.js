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
 *
 * The team in the page URL wins over whatever team was last stored in this
 * browser, so a team player who opens Team Chat and returns to the roster keeps
 * the same team. The viewer's role is then read from the backend roster of that
 * team — never from the open tab or from cached display state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeamsAPI } from '../services/api.js';
import { LocalReportsAPI } from '../services/local/reporting.js';
import NexusTeamWorkflow from '../services/teamWorkflow.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export function useTeamContext() {
  const [version, setVersion] = useState(0);
  const [serverTeam, setServerTeam] = useState(null);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [removal, setRemoval] = useState(null);

  const workflowCtx = useMemo(() => {
    if (!NexusTeamWorkflow || typeof NexusTeamWorkflow.resolveTeamContext !== 'function') return null;
    return NexusTeamWorkflow.resolveTeamContext();
  }, [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Roster and invites change on other devices, so refresh them from the backend.
  // A player can also open a team page straight from a link, where the local
  // copy of the team may not exist yet — the query string is the fallback.
  const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const queryCompId = query ? query.get('compId') : null;
  const queryTeamId = query ? query.get('teamId') : null;
  const compId = queryCompId || (workflowCtx && workflowCtx.comp ? workflowCtx.comp.id : null) || null;
  const teamId = queryTeamId || (workflowCtx && workflowCtx.team ? workflowCtx.team.id : null) || null;

  // A removed player keeps their account and reports, but loses every team and
  // competition surface. The server enforces this too; this keeps the UI honest.
  const viewerUsername = String((workflowCtx && workflowCtx.session && workflowCtx.session.username) || '');
  useEffect(() => {
    let cancelled = false;
    if (!compId || !viewerUsername) { setRemoval(null); return undefined; }
    LocalReportsAPI.removalStatus(compId)
      .then((res) => { if (!cancelled && res.ok && res.data) setRemoval(res.data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [compId, viewerUsername]);

  useEffect(() => {
    if (!compId || !teamId || !NexusTeamWorkflow || typeof NexusTeamWorkflow.syncTeamFromBackend !== 'function') { setCheckingPermission(false); return undefined; }
    let cancelled = false;
    setCheckingPermission(true);
    // A player who joined from another device may only know the local team id,
    // so membership is resolved from the competition roster as a fallback.
    // Chat access must never depend on the viewer being the team leader.
    async function resolveServerTeam() {
      const teamRef = teamId || (workflowCtx.team && workflowCtx.team.dbId) || null;
      if (!teamRef) return null;
      const response = await TeamsAPI.getById(teamRef);
      if (response.ok && response.data) return response.data;
      const roster = await TeamsAPI.getByCompetition((workflowCtx.comp && workflowCtx.comp.dbId) || compId);
      if (!roster.ok || !Array.isArray(roster.data)) return null;
      const wantedName = String((workflowCtx.team && workflowCtx.team.name) || '').toLowerCase();
      return roster.data.find((row) => String(row.id) === String(teamRef)
        || (wantedName && String(row.name || '').toLowerCase() === wantedName)) || null;
    }
    async function sync() {
      const resolved = await resolveServerTeam();
      if (cancelled) return;
      setServerTeam(resolved);
      setCheckingPermission(false);
      if (resolved) {
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

  // Keep the local team in step with the team named in the URL. Without this a
  // player returning from Team Chat could inherit a different team's context.
  const ctx = useMemo(() => {
    if (!workflowCtx) return workflowCtx;
    if (!queryTeamId) return workflowCtx;
    const comp = workflowCtx.comp || null;
    const teams = comp && Array.isArray(comp.teams) ? comp.teams : [];
    const localMatch = teams.find((team) => String(team.id) === String(queryTeamId)
      || (team.dbId && String(team.dbId) === String(queryTeamId))) || null;
    if (!localMatch || localMatch === workflowCtx.team) return workflowCtx;
    return { ...workflowCtx, team: localMatch, context: { compId: comp.id, teamId: localMatch.id } };
  }, [workflowCtx, queryTeamId]);

  // Team role is decided by the authenticated account against the server roster,
  // never by the tab that happens to be open or by cached display state.
  const sessionRole = normalize(ctx && ctx.session && ctx.session.role);
  const username = String((ctx && ctx.session && ctx.session.username) || '');
  const sessionUsername = normalize(username);
  const serverStatus = normalize(serverTeam && serverTeam.status);
  const serverMemberUsernames = Array.isArray(serverTeam && serverTeam.memberUsernames)
    ? serverTeam.memberUsernames
    : [];
  const localTeam = (ctx && ctx.team) || null;
  const localMembers = Array.isArray(localTeam && localTeam.members) ? localTeam.members : [];
  const memberOfServer = !!serverTeam && !!sessionUsername
    && serverMemberUsernames.some((name) => normalize(name) === sessionUsername);
  const memberOfLocal = !!sessionUsername
    && localMembers.some((member) => normalize(member && member.username) === sessionUsername);
  const isMember = memberOfServer || memberOfLocal;
  const isLocalLeader = !!sessionUsername && !!localTeam
    && !['rejected', 'banned', 'disbanded'].includes(normalize(localTeam.status))
    && sessionUsername === normalize(localTeam.createdBy || localTeam.leaderUsername);
  const isLeader = serverTeam
    ? (memberOfServer
      && !['rejected', 'banned', 'disbanded'].includes(serverStatus)
      && sessionUsername === normalize(serverTeam.leaderId))
    // Offline/local workflow fallback: a player promoted after a removal must
    // see the leader interface immediately, not the ordinary player one.
    : isLocalLeader;
  // A confirmed member who is not this team's leader.
  const isTeamPlayer = serverTeam
    ? (memberOfServer && !isLeader)
    : (memberOfLocal && !isLocalLeader);

  const canManage = useMemo(() => {
    if (!ctx || !ctx.session) return false;
    if (['admin', 'super_admin'].includes(sessionRole)) return true;
    return serverTeam ? isLeader : isLocalLeader;
  }, [ctx, serverTeam, sessionRole, isLeader, isLocalLeader]);

  // Every active member — leader or ordinary player — can use the team chat.
  // The local roster is a safe fallback while the server roster is still
  // loading, so an ordinary player never loses the tab because of timing.
  const teamStatus = normalize((serverTeam || localTeam) && (serverTeam || localTeam).status);
  const activeTeam = !!username && !['rejected', 'banned', 'disbanded'].includes(teamStatus);
  const canChat = activeTeam && isMember;
  const chatTeamId = (serverTeam && serverTeam.id) || (localTeam && localTeam.dbId) || (localTeam && localTeam.id) || null;

  const isEnded = useMemo(() => {
    if (!ctx || !ctx.comp) return false;
    return !!(ctx.comp.ended || ctx.comp.status === 'completed');
  }, [ctx]);

  const isStarted = useMemo(() => hasCompetitionStarted(ctx && ctx.comp), ctx ? [ctx.comp] : [ctx]);

  const teamName = (serverTeam && serverTeam.name) || (localTeam && localTeam.name) || '';

  return {
    ctx,
    refresh,
    canManage,
    isLeader,
    isMember,
    isTeamPlayer,
    canChat,
    chatTeamId,
    checkingPermission,
    isRemoved: !!removal?.removed,
    isEnded,
    isStarted,
    compId,
    teamId,
    teamName,
  };
}

export default useTeamContext;
