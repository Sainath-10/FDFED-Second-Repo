/**
 * NEXUS ESPORTS — Redux store
 *
 * One store for the whole app. Each slice gets a key here, and that key is
 * where its state lives: authReducer → state.auth
 *
 * configureStore also adds the thunk middleware (so `dispatch` accepts
 * functions and createAsyncThunk actions) and connects Redux DevTools.
 */
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice.js';
import teamReducer from './teamSlice.js';
import competitionsReducer from './competitionsSlice.js';
import notificationsReducer from './notificationsSlice.js';
import toastReducer from './toastSlice.js';
import platformReducer from './platformSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer, // → state.auth           signed-in user
    team: teamReducer, // → state.team           the team the team pages show
    competitions: competitionsReducer, // → state.competitions   list + filter + search
    notifications: notificationsReducer, // → state.notifications  alerts, badge, tabs
    toasts: toastReducer, // → state.toasts         pop-up messages
    platform: platformReducer, // → state.platform       settings + platform fee
  },
});
