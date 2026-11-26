/**
 * NEXUS ESPORTS — platform slice
 *
 * Platform-wide settings that several pages need, fetched once and shared:
 *
 *   state.platform.settings        → { allowKnockout, allowRoundRobin, maxTeams } (Super Admin's switches)
 *   state.platform.settingsStatus  → 'idle' | 'loading' | 'succeeded' | 'failed'
 *   state.platform.online          → true / false once the server has answered (footer "Server online")
 *   state.platform.revenueConfig   → { percentage, minCost, updatedAt, updatedBy } — the platform fee formula
 *   state.platform.revenueStatus   → 'idle' | 'loading' | 'succeeded' | 'failed'
 *   state.platform.revenueLoaded   → true once the real config has arrived from the server
 *
 * Thunks:
 *   fetchPlatformSettings()          → GET /platform/settings (also the footer's health check)
 *   fetchRevenueConfig({ force })    → GET /revenue/config, skipped if already loaded unless force
 *   saveRevenueConfig({ percentage, minCost }) → POST /revenue/config + activity log
 * Plain action:
 *   platformSettingsSaved(settings)  → the Super Admin saved new switches
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { AdminAPI, PlatformAPI, RevenueAPI } from '../services/api.js';
import { formatINR } from '../lib/reporting.js';

// ---------- Thunks ----------

export const fetchPlatformSettings = createAsyncThunk(
  'platform/fetchSettings',
  async (_, { rejectWithValue }) => {
    const res = await PlatformAPI.settings();
    if (!res.ok || !res.data) return rejectWithValue(res.error || 'Platform settings are unavailable.');
    return res.data;
  },
  // `condition` runs before the thunk: returning false cancels it, so two
  // components asking at the same moment cause only one request.
  { condition: (_, { getState }) => getState().platform.settingsStatus !== 'loading' },
);

export const fetchRevenueConfig = createAsyncThunk(
  'platform/fetchRevenueConfig',
  async (_options, { rejectWithValue }) => {
    const res = await RevenueAPI.getConfig();
    if (!res.ok || !res.data) return rejectWithValue(res.error || 'Unable to load the configuration.');
    return {
      percentage: Number(res.data.percentage),
      minCost: Number(res.data.minCost),
      updatedAt: res.data.updatedAt || null,
      updatedBy: res.data.updatedBy || null,
    };
  },
  {
    condition: (options, { getState }) => {
      const { revenueStatus, revenueLoaded } = getState().platform;
      if (revenueStatus === 'loading') return false;
      return !!options?.force || !revenueLoaded;
    },
  },
);

/** Saves a new platform fee and records the change in the admin activity log. */
export const saveRevenueConfig = createAsyncThunk('platform/saveRevenueConfig', async ({ percentage, minCost }, { getState, rejectWithValue }) => {
  const previous = getState().platform.revenueConfig;
  const res = await RevenueAPI.saveConfig({ percentage, minCost });
  if (!res.ok) return rejectWithValue(res.error || 'The configuration was not saved.');
  await AdminAPI.logActivity(null, 'REVENUE_CONFIG_CHANGE', `Platform fee changed from ${previous.percentage}% (min ${formatINR(previous.minCost)}) to ${percentage}% (min ${formatINR(minCost)}).`, {
    prevPercentage: previous.percentage, newPercentage: percentage, prevMinCost: previous.minCost, newMinCost: minCost,
  });
  return { percentage, minCost };
});

// ---------- Slice ----------

const initialState = {
  settings: { allowKnockout: true, allowRoundRobin: true, maxTeams: 256 },
  settingsStatus: 'idle',
  online: null,
  revenueConfig: { percentage: 7, minCost: 50, updatedAt: null, updatedBy: null },
  revenueStatus: 'idle',
  revenueLoaded: false,
  revenueError: '',
};

const platformSlice = createSlice({
  name: 'platform',
  initialState,
  reducers: {
    // payload = { allowKnockout, allowRoundRobin, maxTeams }
    platformSettingsSaved(state, action) {
      state.settings = { ...state.settings, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlatformSettings.pending, (state) => { state.settingsStatus = 'loading'; })
      .addCase(fetchPlatformSettings.fulfilled, (state, action) => {
        state.settingsStatus = 'succeeded';
        state.settings = { ...state.settings, ...action.payload };
        state.online = true;
      })
      .addCase(fetchPlatformSettings.rejected, (state) => {
        state.settingsStatus = 'failed';
        state.online = false;
      })
      .addCase(fetchRevenueConfig.pending, (state) => { state.revenueStatus = 'loading'; })
      .addCase(fetchRevenueConfig.fulfilled, (state, action) => {
        state.revenueStatus = 'succeeded';
        state.revenueLoaded = true;
        state.revenueConfig = action.payload;
        state.revenueError = '';
      })
      .addCase(fetchRevenueConfig.rejected, (state, action) => {
        state.revenueStatus = 'failed';
        state.revenueError = action.payload || 'Unable to load the configuration.';
      })
      .addCase(saveRevenueConfig.fulfilled, (state, action) => {
        state.revenueConfig = { ...state.revenueConfig, ...action.payload };
      });
  },
});

export const { platformSettingsSaved } = platformSlice.actions;
export default platformSlice.reducer;
