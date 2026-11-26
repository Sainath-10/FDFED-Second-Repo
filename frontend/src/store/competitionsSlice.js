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
 * Thunk:
 *   loadCompetitions() → fetches competitions + teams; the result lands in `list`.
 * Pages use it through useCompetitions() in services/competitions.js.
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchAllTeams, fetchCompetitions, isActiveTeam } from '../services/competitions.js';

export const loadCompetitions = createAsyncThunk('competitions/load', async (_, { rejectWithValue }) => {
  const [res, teams] = await Promise.all([fetchCompetitions(), fetchAllTeams()]);
  if (!res.ok) return rejectWithValue(res.error || 'Unable to load competitions.');
  // Attach each competition's teams (one request for all teams instead of one per competition).
  const byComp = new Map();
  teams.forEach((t) => { if (!byComp.has(t.competitionId)) byComp.set(t.competitionId, []); byComp.get(t.competitionId).push(t); });
  return res.data.map((c) => {
    const teamList = byComp.get(c.id) || [];
    return { ...c, teams: teamList, activeTeams: teamList.filter(isActiveTeam) };
  });
});

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
    // payload = the filter tab id, e.g. 'upcoming'
    setFilter(state, action) {
      state.filter = action.payload;
    },
    // payload = the text typed in the search box
    setQuery(state, action) {
      state.query = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCompetitions.fulfilled, (state, action) => {
        state.list = action.payload;
        state.loaded = true;
        state.error = '';
      })
      .addCase(loadCompetitions.rejected, (state, action) => {
        state.list = [];
        state.loaded = true;
        state.error = action.payload || 'Unable to load competitions.';
      });
  },
});

export const { setFilter, setQuery } = competitionsSlice.actions;
export default competitionsSlice.reducer;
