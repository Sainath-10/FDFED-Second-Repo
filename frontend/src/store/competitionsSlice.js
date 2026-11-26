/**
 * NEXUS ESPORTS — competitions slice
 *
 * The list of competitions (with their teams) shown on Home, Competitions and
 * Live now, plus the Competitions page's filter tab and search box.
 * Keeping them in the store means:
 *   - the three pages share one copy, so moving between them is instant
 *     (the list refreshes in the background), and
 *   - the filter and search are still there when you come back to the page.
 *
 *   state.competitions.list    → competitions, already mapped for display
 *   state.competitions.loaded  → false until the first load finishes
 *   state.competitions.error   → error message, '' when fine
 *   state.competitions.filter  → 'all' | 'upcoming' | 'league' | 'tournament'
 *   state.competitions.query   → the search text
 *
 * The API call itself is in services/competitions.js (useCompetitions), which
 * dispatches competitionsLoaded / competitionsFailed with the result.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [],
  loaded: false,
  error: '',
  filter: 'all',
  query: '',
};

const competitionsSlice = createSlice({
  name: 'competitions',
  initialState,
  reducers: {
    // payload = the list of competitions
    competitionsLoaded(state, action) {
      state.list = action.payload;
      state.loaded = true;
      state.error = '';
    },
    // payload = the error message
    competitionsFailed(state, action) {
      state.list = [];
      state.loaded = true;
      state.error = action.payload;
    },
    // payload = the filter tab id, e.g. 'upcoming'
    setFilter(state, action) {
      state.filter = action.payload;
    },
    // payload = the text typed in the search box
    setQuery(state, action) {
      state.query = action.payload;
    },
  },
});

export const { competitionsLoaded, competitionsFailed, setFilter, setQuery } = competitionsSlice.actions;
export default competitionsSlice.reducer;
