/**
 * NEXUS ESPORTS — auth slice
 *
 * Holds the signed-in session in the Redux store.
 *
 *   state.auth.session  → the logged-in user object, or null when logged out
 *
 * Actions:
 *   setSession(user)  → payload is the user object (after login or a refresh)
 *   logout()          → no payload, clears the session
 *
 * The API calls (login, refresh, ...) stay in services/auth.js. Components call
 * the service first and then dispatch one of these actions with the result.
 */
import { createSlice } from '@reduxjs/toolkit';
import { getSession } from '../services/auth.js';

const initialState = {
  // Read whatever was saved in localStorage, so a page reload keeps you logged in.
  session: getSession(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      state.session = action.payload;
    },
    logout(state) {
      state.session = null;
    },
  },
});

export const { setSession, logout } = authSlice.actions;
export default authSlice.reducer;
