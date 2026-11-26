/**
 * NEXUS ESPORTS — competitions service
 *
 * The backend is the only source of competition and team data. These helpers
 * fetch it, shape it for the pages, and compute display state (badges,
 * registration window) the same way the server enforces it.
 */
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CompetitionsAPI, RevenueAPI, TeamsAPI } from './api.js';
import { competitionsFailed, competitionsLoaded } from '../store/competitionsSlice.js';

/** Unpublished drafts: waiting for finance approval or for the platform fee. */
export const isDraft = (c) => ['AWAITING_PLATFORM_FEE', 'AWAITING_FINANCE_APPROVAL'].includes(c?.paymentStatus);

/** Payment states after which a competition is over. */
const CLOSED_PAYMENT_STATES = ['PRIZE_RELEASED', 'REFUND_ISSUED', 'CANCELLED', 'EXPIRED', 'ABANDONED', 'REVERSED'];
const CANCELLED_PAYMENT_STATES = ['REFUND_ISSUED', 'CANCELLED', 'EXPIRED', 'ABANDONED'];
const INACTIVE_TEAM = ['rejected', 'banned', 'disbanded'];

const time = (v) => (v ? +new Date(v) : NaN);
const shortDate = (v) => new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function isCancelledCompetition(c) {
  return !!c && (String(c.status || '').toLowerCase() === 'cancelled' || CANCELLED_PAYMENT_STATES.includes(c.paymentStatus));
}

export function isClosedCompetition(c) {
  return !!c && (['completed', 'cancelled'].includes(String(c.status || '').toLowerCase())
    || CLOSED_PAYMENT_STATES.includes(c.paymentStatus)
    || c.paymentStatus === 'COMPLETED');
}

export const isCompEnded = isClosedCompetition;

export function hasStarted(c, now = Date.now()) {
  return !!c && time(c.startDate) <= now;
}

/** The scheduled end day is over (the organiser may not have pressed End yet). */
export function isPastEndDate(c, now = Date.now()) {
  return !!c && time(c.endDate) < now;
}

/** In progress right now: started, not closed, and its end date not yet passed. */
export function isLiveCompetition(c, now = Date.now()) {
  return hasStarted(c, now) && !isClosedCompetition(c) && !isPastEndDate(c, now);
}

/** Whether teams can register right now — the same rules the server applies. */
export function registrationState(c, now = Date.now()) {
  if (!c) return { open: false, reason: 'missing', label: 'Competition unavailable' };
  if (isCancelledCompetition(c)) return { open: false, reason: 'cancelled', label: 'Competition cancelled' };
  if (isClosedCompetition(c)) return { open: false, reason: 'ended', label: 'Competition ended' };
  if (String(c.status).toLowerCase() === 'suspended') return { open: false, reason: 'suspended', label: 'Competition suspended' };
  if (isDraft(c)) return { open: false, reason: 'draft', label: 'Not published yet' };
  if (time(c.startDate) <= now) return { open: false, reason: 'started', label: 'Registration closed — competition started', detail: `Started ${shortDate(c.startDate)}` };
  if (time(c.registrationCloseAt) <= now) return { open: false, reason: 'closed', label: 'Registration closed', detail: `Closed ${shortDate(c.registrationCloseAt)}` };
  if (time(c.registrationOpenAt) > now) return { open: false, reason: 'not_open', label: `Registration opens ${shortDate(c.registrationOpenAt)}` };
  const closesAt = c.registrationCloseAt || c.startDate;
  return { open: true, reason: 'open', label: 'Registration open', detail: closesAt ? `Closes ${shortDate(closesAt)}` : '' };
}

function badgeFor(c) {
  if (isCancelledCompetition(c)) return { badge: 'Cancelled', badgeClass: 'cancelled' };
  if (isClosedCompetition(c)) return { badge: 'Completed', badgeClass: 'ended' };
  if (String(c.status).toLowerCase() === 'suspended') return { badge: 'Suspended', badgeClass: 'ended' };
  if (isPastEndDate(c)) return { badge: 'Ended', badgeClass: 'ended' };
  const reg = registrationState(c);
  if (reg.reason === 'started') return { badge: 'Live', badgeClass: 'live' };
  if (reg.reason === 'closed') return { badge: 'Registration closed', badgeClass: 'ended' };
  if (reg.open) return { badge: 'Open', badgeClass: 'new' };
  return { badge: 'Upcoming', badgeClass: 'hot' };
}

const PLACE_LABELS = ['1st Place', '2nd Place', '3rd Place'];

export function formatDateRange(startDate, endDate) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || Number.isNaN(+start)) return 'TBD';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!end || Number.isNaN(+end) || start.toDateString() === end.toDateString()) return start.toLocaleDateString('en-IN', opts);
  return `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`;
}

export function mapTeam(t) {
  const leader = t.leaderId || t.leaderUsername || t.createdBy || '';
  const members = (t.memberUsernames || []).map((username) => ({
    username,
    role: String(username).toLowerCase() === String(leader).toLowerCase() ? 'captain' : 'player',
  }));
  return { ...t, dbId: t.id, leader, createdBy: leader, members, players: members.length, avatar: String(t.name || '?').charAt(0).toUpperCase() };
}

export function isActiveTeam(t) {
  return !!t && !INACTIVE_TEAM.includes(String(t.status || '').toLowerCase());
}

/** Server competition → display shape used by the pages. */
export function mapCompetition(c, teams) {
  if (!c) return null;
  const prizes = (Array.isArray(c.prizeDistributionMinor) ? c.prizeDistributionMinor : [])
    .map(Number).filter((n) => n > 0)
    .map((minor, i) => ({ place: PLACE_LABELS[i] || `${i + 1}th Place`, amount: minor / 100 }));
  const mappedTeams = Array.isArray(teams) ? teams.map(mapTeam) : undefined;
  const fee = Number(c.entryFeeAmount) || 0;
  const entryFee = c.feeType === 'per_team' ? `₹${fee.toLocaleString('en-IN')} / team`
    : c.feeType === 'per_player' ? `₹${fee.toLocaleString('en-IN')} / player` : 'Free';
  return {
    ...c,
    dbId: c.id,
    organizers: Array.isArray(c.organizers) && c.organizers.length ? c.organizers : [c.createdBy].filter(Boolean),
    pendingOrganizers: Array.isArray(c.pendingOrganizers) ? c.pendingOrganizers.filter(Boolean) : [],
    ...badgeFor(c),
    game: c.game || 'Unknown game',
    type: c.type || 'tournament',
    format: c.format || (c.type === 'league' ? 'Round Robin' : 'Single Elimination'),
    dates: formatDateRange(c.startDate, c.endDate),
    location: c.location || 'Online',
    prize: Number(c.prize) || 0,
    prizePool: `₹${(Number(c.prize) || 0).toLocaleString('en-IN')}`,
    prizes,
    maxTeams: c.maxTeams || 0,
    maxPlayersPerTeam: c.maxPlayersPerTeam || 0,
    feeType: c.feeType || 'free',
    entryFeeAmount: fee,
    entryFee,
    teams: mappedTeams || [],
    activeTeams: mappedTeams ? mappedTeams.filter(isActiveTeam) : [],
    registration: registrationState(c),
  };
}

export function isOrganizerOf(comp, username) {
  const me = String(username || '').toLowerCase();
  if (!comp || !me) return false;
  return [comp.createdBy, ...(comp.organizers || [])].some((o) => String(o || '').toLowerCase() === me);
}

export async function fetchCompetitions() {
  const res = await CompetitionsAPI.getAll();
  if (!res.ok) return { ok: false, error: res.error, data: [] };
  return { ok: true, data: (res.data || []).map((c) => mapCompetition(c)) };
}

/** One competition with its registered teams. */
export async function fetchCompetition(id) {
  if (!id) return { ok: false, status: 404, error: 'No competition was selected.' };
  const [compRes, teamsRes] = await Promise.all([CompetitionsAPI.getById(id), TeamsAPI.getByCompetition(id)]);
  if (!compRes.ok) return { ok: false, status: compRes.status, error: compRes.status === 404 ? 'That competition could not be found.' : compRes.error };
  return { ok: true, data: mapCompetition(compRes.data, teamsRes.ok ? teamsRes.data : []) };
}

/** Teams for many competitions in one request (used by lists that show team counts). */
export async function fetchAllTeams() {
  const res = await TeamsAPI.getAll();
  return res.ok && Array.isArray(res.data) ? res.data.map(mapTeam) : [];
}

/**
 * Every competition with its teams, kept in the Redux store (state.competitions)
 * so Home, Competitions and Live now share one copy. Each page that uses it
 * shows the stored list straight away and refreshes it in the background.
 */
export function useCompetitions() {
  const dispatch = useDispatch();
  const list = useSelector((state) => state.competitions.list);
  const loaded = useSelector((state) => state.competitions.loaded);
  const error = useSelector((state) => state.competitions.error);

  const load = useCallback(async () => {
    const [res, teams] = await Promise.all([fetchCompetitions(), fetchAllTeams()]);
    if (!res.ok) { dispatch(competitionsFailed(res.error || 'Unable to load competitions.')); return; }
    const byComp = new Map();
    teams.forEach((t) => { if (!byComp.has(t.competitionId)) byComp.set(t.competitionId, []); byComp.get(t.competitionId).push(t); });
    const data = res.data.map((c) => {
      const teamList = byComp.get(c.id) || [];
      return { ...c, teams: teamList, activeTeams: teamList.filter(isActiveTeam) };
    });
    dispatch(competitionsLoaded(data));
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);
  return { loading: !loaded, error, data: list, reload: load };
}

export function useCompetition(id) {
  const [state, setState] = useState({ loading: true, error: '', status: 0, data: null });
  const load = useCallback(async () => {
    const res = await fetchCompetition(id);
    setState(res.ok ? { loading: false, error: '', status: 200, data: res.data } : { loading: false, error: res.error, status: res.status, data: null });
  }, [id]);
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);
  return { ...state, reload: load };
}

/** Platform fee for a prize pool under the current revenue configuration (whole rupees). */
export function calculatePlatformFee(prize, config = { percentage: 7, minCost: 50 }) {
  // Same formula as the server (payment.rules.ts), worked in paise.
  const amount = Math.max(0, Number(prize) || 0);
  const minor = Math.max(Math.round((Number(config.minCost) || 0) * 100), Math.round(amount * (Number(config.percentage) || 0)));
  return minor / 100;
}

export function useRevenueConfig() {
  const [config, setConfig] = useState({ percentage: 7, minCost: 50 });
  useEffect(() => {
    RevenueAPI.getConfig().then((res) => { if (res.ok && res.data) setConfig({ percentage: Number(res.data.percentage), minCost: Number(res.data.minCost) }); });
  }, []);
  return config;
}

export function competitionIdFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return p.get('id') || p.get('compId') || '';
}
