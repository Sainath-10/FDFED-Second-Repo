/**
 * NEXUS ESPORTS — team slice
 *
 * The team the team pages (Roster, Matches, Chat, Add players, ...) are about.
 * It lives in the store so TeamHeader and TeamTabs can read it themselves
 * instead of every page passing it down as props, and so switching between
 * the team tabs shows the team straight away instead of a loading screen.
 *
 *   state.team.key                 → which team this data is for ("teamId|compId|username"),
 *                                    '' before anything has loaded
 *   state.team.team                → the team row from the server (or null)
 *   state.team.comp                → the team's competition (or null)
 *   state.team.removal             → whether the viewer was removed from that competition
 *   state.team.error               → error message, '' when fine
 *   state.team.pendingJoinRequests → number shown as a badge on the "Join requests" tab
 *
 * Thunks:
 *   fetchTeam({ key, teamId, compId, username }) → loads the team for a team page
 *   fetchJoinRequestCount(teamId)                → loads the badge number
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { CompetitionsAPI, ReportsAPI, TeamsAPI } from '../services/api.js';

const normalize = (value) => String(value || '').trim().toLowerCase();
const INACTIVE = ['rejected', 'banned', 'disbanded'];

/** The team in the URL, else the viewer's own active team (captains first). */
async function resolveTeam(teamId, compId, username) {
  if (teamId) {
    const res = await TeamsAPI.getById(teamId);
    if (res.ok && res.data) return res.data;
    if (res.status === 403) throw new Error(res.error || 'You cannot open this team.');
  }
  const res = compId ? await TeamsAPI.getByCompetition(compId) : await TeamsAPI.getAll();
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

// ---------- Thunks ----------

/** Loads the team, its competition and the viewer's removal status. */
export const fetchTeam = createAsyncThunk('team/fetch', async ({ key, teamId, compId, username }, { rejectWithValue }) => {
  try {
    const team = await resolveTeam(teamId, compId, username);
    let comp = null;
    let removal = null;
    let error = '';
    const competitionId = team?.competitionId || compId;
    if (competitionId) {
      const [compRes, removalRes] = await Promise.all([
        CompetitionsAPI.getById(competitionId),
        username ? ReportsAPI.removalStatus(competitionId) : Promise.resolve(null),
      ]);
      comp = compRes.ok ? compRes.data : null;
      removal = removalRes && removalRes.ok ? removalRes.data : null;
      if (team && !compRes.ok && compRes.status === 403) error = compRes.error || '';
    }
    return { key, team, comp, removal, error };
  } catch (err) {
    return rejectWithValue({ key, error: err.message || 'Unable to load this team.' });
  }
});

/** Counts the team's pending join requests (the badge on the "Join requests" tab). */
export const fetchJoinRequestCount = createAsyncThunk('team/fetchJoinRequestCount', async (teamId, { rejectWithValue }) => {
  const res = await TeamsAPI.getJoinRequests(teamId);
  if (!res.ok || !Array.isArray(res.data)) return rejectWithValue(res.error || 'Unable to load join requests.');
  return res.data.filter((r) => r.status === 'pending').length;
});

// ---------- Slice ----------

const initialState = {
  key: '',
  team: null,
  comp: null,
  removal: null,
  error: '',
  pendingJoinRequests: 0,
};

const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {
    // payload = the number of pending join requests (the Join requests page already has the list)
    setPendingJoinRequests(state, action) {
      state.pendingJoinRequests = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeam.fulfilled, (state, action) => {
        const { key, team, comp, removal, error } = action.payload;
        // A different team than before: its join-request badge starts from 0.
        if (state.key !== key) state.pendingJoinRequests = 0;
        state.key = key;
        state.team = team;
        state.comp = comp;
        state.removal = removal;
        state.error = error;
      })
      .addCase(fetchTeam.rejected, (state, action) => {
        // The page was left before the request finished (thunk aborted): ignore it.
        if (action.meta.aborted || !action.payload) return;
        if (state.key !== action.payload.key) state.pendingJoinRequests = 0;
        state.key = action.payload.key;
        state.team = null;
        state.error = action.payload.error;
      })
      .addCase(fetchJoinRequestCount.fulfilled, (state, action) => {
        state.pendingJoinRequests = action.payload;
      });
  },
});

export const { setPendingJoinRequests } = teamSlice.actions;
export default teamSlice.reducer;
