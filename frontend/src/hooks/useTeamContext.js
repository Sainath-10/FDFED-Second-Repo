/**
 * NEXUS ESPORTS — useTeamContext
 *
 * Resolves the team a team page is about, entirely from the backend, so the
 * pages work in any browser and on any device:
 *   1. the team in the URL (?teamId=…), else
 *   2. the viewer's own active team in the competition in the URL (?compId=…), else
 *   3. the viewer's most recent active team (captains first).
 * The viewer's role (captain / player) is read from the server roster.
 *
 * The loaded team is kept in the Redux store (store/teamSlice.js):
 *   useTeamContext() → used by each team PAGE: loads the team into the store
 *                      and returns everything the page needs.
 *   useTeamView()    → used by TeamHeader / TeamTabs: only reads the store,
 *                      so the page no longer has to pass the team down as props.
 */
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CompetitionsAPI, ReportsAPI, TeamsAPI } from '../services/api.js';
import { teamFailed, teamLoaded } from '../store/teamSlice.js';

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

/** Nothing loaded yet for this team: what the pages see while it loads. */
const EMPTY = { key: '', team: null, comp: null, removal: null, error: '', pendingJoinRequests: 0 };

/**
 * Turns the raw store data (state.team) into the values the team pages use:
 * the mapped team, the viewer's permissions and the competition's stage.
 */
function buildTeamView(data, session, loading, queryCompId = null, queryTeamId = null) {
  const mapped = toTeam(data.team);
  const comp = data.comp;
  const me = normalize(session?.username);
  const sessionRole = normalize(session?.role);
  const isStaff = ['super_admin', 'super-admin'].includes(sessionRole);
  const active = !!mapped && !INACTIVE.includes(normalize(mapped.status));
  const isMember = !!mapped && mapped.members.some((m) => normalize(m.username) === me);
  const isLeader = active && isMember && normalize(mapped.leader) === me;
  const isEnded = isCompetitionEnded(comp);
  const isStarted = hasCompetitionStarted(comp);
  const context = mapped ? { compId: mapped.competitionId, teamId: mapped.id } : (queryCompId ? { compId: queryCompId } : null);

  return {
    ctx: mapped && comp ? { session, comp, team: mapped, context } : null,
    loading,
    error: data.error,
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
    isRemoved: !!data.removal?.removed,
    removalReason: data.removal?.reason || '',
    isEnded,
    isStarted,
    rosterLocked: isEnded || isStarted,
    compId: mapped?.competitionId || queryCompId || null,
    teamId: mapped?.id || queryTeamId || null,
    teamName: mapped?.name || '',
    context,
    pendingJoinRequests: data.pendingJoinRequests,
  };
}

/** Read-only view of the team in the store, for components inside a team page. */
export function useTeamView() {
  const session = useSelector((state) => state.auth.session);
  const data = useSelector((state) => state.team);
  return useMemo(() => buildTeamView(data, session, false), [data, session]);
}

/** Loads the team for the current URL into the store and returns it. Call it once per team page. */
export function useTeamContext() {
  const session = useSelector((state) => state.auth.session);
  const stored = useSelector((state) => state.team);
  const dispatch = useDispatch();

  const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const queryTeamId = query.get('teamId');
  const queryCompId = query.get('compId') || query.get('id');
  const username = String(session?.username || '');
  // Which team this page wants. If the store holds a different one, we are still loading.
  const key = `${queryTeamId || ''}|${queryCompId || ''}|${username}`;

  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

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
        let comp = null;
        let removal = null;
        let error = '';
        const compId = row?.competitionId || queryCompId;
        if (compId) {
          const [compRes, removalRes] = await Promise.all([
            CompetitionsAPI.getById(compId),
            username ? ReportsAPI.removalStatus(compId) : Promise.resolve(null),
          ]);
          if (cancelled) return;
          comp = compRes.ok ? compRes.data : null;
          removal = removalRes && removalRes.ok ? removalRes.data : null;
          if (row && !compRes.ok && compRes.status === 403) error = compRes.error || '';
        }
        dispatch(teamLoaded({ key, team: row, comp, removal, error }));
      } catch (err) {
        if (!cancelled) dispatch(teamFailed({ key, error: err.message || 'Unable to load this team.' }));
      }
    }
    load();
    // Rosters change on other devices: keep this page current.
    const timer = window.setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [key, queryTeamId, queryCompId, username, version, dispatch]);

  const isCurrent = stored.key === key;
  const view = useMemo(
    () => buildTeamView(isCurrent ? stored : EMPTY, session, !isCurrent, queryCompId, queryTeamId),
    [isCurrent, stored, session, queryCompId, queryTeamId],
  );
  return { ...view, refresh };
}

export default useTeamContext;
