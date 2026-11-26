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
 * The loading itself (API calls) is done in hooks/useTeamContext.js, which then
 * dispatches these actions with the results.
 */
import { createSlice } from '@reduxjs/toolkit';

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
    // A load finished. payload = { key, team, comp, removal, error }
    teamLoaded(state, action) {
      const { key, team, comp, removal, error } = action.payload;
      // A different team than before: its join-request badge starts from 0.
      if (state.key !== key) state.pendingJoinRequests = 0;
      state.key = key;
      state.team = team;
      state.comp = comp;
      state.removal = removal;
      state.error = error;
    },
    // A load failed. payload = { key, error }
    teamFailed(state, action) {
      if (state.key !== action.payload.key) state.pendingJoinRequests = 0;
      state.key = action.payload.key;
      state.team = null;
      state.error = action.payload.error;
    },
    // payload = the number of pending join requests
    setPendingJoinRequests(state, action) {
      state.pendingJoinRequests = action.payload;
    },
  },
});

export const { teamLoaded, teamFailed, setPendingJoinRequests } = teamSlice.actions;
export default teamSlice.reducer;
