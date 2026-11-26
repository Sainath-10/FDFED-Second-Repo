/**
 * NEXUS ESPORTS — Redux store
 *
 * One store for the whole app. Each slice gets a key here, and that key is
 * where its state lives: authReducer → state.auth
 */
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice.js';
import teamReducer from './teamSlice.js';
import competitionsReducer from './competitionsSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer, // → state.auth
    team: teamReducer, // → state.team
    competitions: competitionsReducer, // → state.competitions
  },
});
