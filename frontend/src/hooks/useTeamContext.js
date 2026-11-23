/**
 * NEXUS ESPORTS — useTeamContext
 *
 * Resolves the team a team page is about, entirely from the backend, so the
 * pages work in any browser and on any device:
 *   1. the team in the URL (?teamId=…), else
 *   2. the viewer's own active team in the competition in the URL (?compId=…), else
 *   3. the viewer's most recent active team (captains first).
 * The viewer's role (captain / player) is read from the server roster.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { CompetitionsAPI, ReportsAPI, TeamsAPI } from '../services/api.js';

const normalize = (value) => String(value || '').trim().toLowerCase();
const INACTIVE = ['rejected', 'banned', 'disbanded'];

/** One shared competition-started check, so roster rules agree on every screen. */
export function hasCompetitionStarted(comp, now = new Date()) {
  if (!comp) return false;
  if (String(comp.status || '').toLowerCase() === 'ongoing') return true;
  const start = comp.startDate ? new Date(comp.startDate) : null;
  return !!start && !Number.isNaN(start.getTime()) && now.getTime() >= start.getTime();
}

export function isCompetitionEnded(comp) {
  if (!comp) return false;
  const status = String(comp.status || '').toLowerCase();
  const payment = String(comp.paymentStatus || '').toUpperCase();
  return status === 'completed' || status === 'cancelled' || ['COMPLETED', 'PRIZE_RELEASED', 'REVERSED', 'REFUND_ISSUED', 'CANCELLED', 'EXPIRED'].includes(payment);
}

/** Server team → the shape the team pages render. */
function toTeam(row) {
  if (!row) return null;
  const leader = row.leaderId || row.leaderUsername || row.createdBy || '';
  const members = (row.memberUsernames || []).map((username) => ({
    username,
    displayName: username,
    role: normalize(username) === normalize(leader) ? 'captain' : 'player',
  }));
  return { ...row, dbId: row.id, leader, createdBy: leader, members };
}

export function useTeamContext() {
  const { session } = useAuth();
  const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const queryTeamId = query.get('teamId');
  const queryCompId = query.get('compId') || query.get('id');

  const [version, setVersion] = useState(0);
  const [team, setTeam] = useState(null);
  const [comp, setComp] = useState(null);
  const [removal, setRemoval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const username = String(session?.username || '');

  useEffect(() => {
    let cancelled = false;
    async function resolveTeam() {
      if (queryTeamId) {
        const res = await TeamsAPI.getById(queryTeamId);
        if (res.ok && res.data) return res.data;
        if (res.status === 403) throw new Error(res.error || 'You cannot open this team.');
      }
      const res = queryCompId ? await TeamsAPI.getByCompetition(queryCompId) : await TeamsAPI.getAll();
      if (!res.ok || !Array.isArray(res.data)) throw new Error(res.error || 'Unable to load your teams.');
      const me = normalize(username);
      const mine = res.data
        .filter((t) => !INACTIVE.includes(normalize(t.status)))
        .filter((t) => (t.memberUsernames || []).some((m) => normalize(m) === me))
        .sort((a, b) => {
          const lead = Number(normalize(b.leaderId) === me) - Number(normalize(a.leaderId) === me);
          return lead || new Date(b.createdAt) - new Date(a.createdAt);
        });
      return mine[0] || null;
    }
    async function load() {
      try {
        const row = await resolveTeam();
        if (cancelled) return;
        setTeam(row);
        const compId = row?.competitionId || queryCompId;
        if (compId) {
          const [compRes, removalRes] = await Promise.all([
            CompetitionsAPI.getById(compId),
            username ? ReportsAPI.removalStatus(compId) : Promise.resolve(null),
          ]);
          if (cancelled) return;
          setComp(compRes.ok ? compRes.data : null);
          setRemoval(removalRes && removalRes.ok ? removalRes.data : null);
          if (!compRes.ok && compRes.status === 403) setError(compRes.error || '');
        } else {
          setComp(null);
        }
        setError((prev) => (row ? prev : ''));
      } catch (err) {
        if (!cancelled) { setTeam(null); setError(err.message || 'Unable to load this team.'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // Rosters change on other devices: keep this page current.
    const timer = window.setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [queryTeamId, queryCompId, username, version]);

  const mapped = useMemo(() => toTeam(team), [team]);
  const me = normalize(username);
  const sessionRole = normalize(session?.role);
  const isStaff = ['super_admin', 'super-admin'].includes(sessionRole);
  const active = !!mapped && !INACTIVE.includes(normalize(mapped.status));
  const isMember = !!mapped && mapped.members.some((m) => normalize(m.username) === me);
  const isLeader = active && isMember && normalize(mapped.leader) === me;
  const isEnded = isCompetitionEnded(comp);
  const isStarted = hasCompetitionStarted(comp);
  const context = mapped ? { compId: mapped.competitionId, teamId: mapped.id } : (queryCompId ? { compId: queryCompId } : null);

  const ctx = mapped && comp ? { session, comp, team: mapped, context } : null;

  return {
    ctx,
    refresh,
    loading,
    error,
    session,
    comp,
    team: mapped,
    members: mapped ? mapped.members : [],
    canManage: isStaff || isLeader,
    isLeader,
    isMember,
    isTeamPlayer: active && isMember && !isLeader,
    canChat: active && isMember,
    chatTeamId: mapped ? mapped.id : null,
    checkingPermission: loading,
    isRemoved: !!removal?.removed,
    removalReason: removal?.reason || '',
    isEnded,
    isStarted,
    rosterLocked: isEnded || isStarted,
    compId: mapped?.competitionId || queryCompId || null,
    teamId: mapped?.id || queryTeamId || null,
    teamName: mapped?.name || '',
    context,
  };
}

export default useTeamContext;
