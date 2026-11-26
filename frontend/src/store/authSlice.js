/**
 * NEXUS ESPORTS — auth slice
 *
 * Holds the signed-in session in the Redux store.
 *
 *   state.auth.session → the logged-in user object, or null when logged out
 *   state.auth.status  → 'idle' | 'loading' | 'failed'  (a login / sign-up in progress)
 *   state.auth.error   → the last login / sign-up error message
 *
 * Plain actions (reducers):
 *   setSession(user)   → payload is the user object
 *   logout()           → no payload, clears the session
 *
 * Thunks (async actions — they call the API, then dispatch the result):
 *   loginUser({ username, password, roleRoutes, fallbackPath })
 *   signupUser({ username, email, password })
 *   refreshSession()   → re-reads the account from the server
 *   logoutUser()       → tells the server, clears storage, then dispatches logout()
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as AuthService from '../services/auth.js';
import { AuthAPI } from '../services/api.js';

// ---------- Thunks ----------

/** Logs in. Resolves with { user, revokedReason, redirectPath }; rejects with the error message. */
export const loginUser = createAsyncThunk('auth/login', async (options, { rejectWithValue }) => {
  const result = await AuthService.login(options);
  if (!result.ok) return rejectWithValue(result.error || 'Login failed. Please try again.');
  return { user: result.user, revokedReason: result.revokedReason, redirectPath: result.redirectPath };
});

/** Creates an account (does not log in — the page dispatches loginUser next). */
export const signupUser = createAsyncThunk('auth/signup', async (options, { rejectWithValue }) => {
  const result = await AuthService.createAccount(options);
  if (!result.ok) return rejectWithValue(result.error || 'Unable to create account.');
  return result.message;
});

/** Re-reads the account (role / profile changes made elsewhere). Resolves with the session or null. */
export const refreshSession = createAsyncThunk('auth/refresh', async () => {
  const fresh = await AuthService.refreshFromServer();
  return fresh || AuthService.getSession();
});

/**
 * A hand-written thunk (no API result to wait for): a function that receives
 * `dispatch`. It does the side effects, then dispatches the plain logout action.
 */
export const logoutUser = () => (dispatch) => {
  // The request captures the token synchronously, so clearing right after is safe.
  AuthAPI.recordLogout();
  AuthService.clearSession();
  dispatch(logout());
};

// ---------- Slice ----------

const initialState = {
  // Read whatever was saved in localStorage, so a page reload keeps you logged in.
  session: AuthService.getSession(),
  status: 'idle',
  error: '',
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
      state.status = 'idle';
      state.error = '';
    },
  },
  // Reducers for the thunks' automatic actions: <name>/pending, /fulfilled, /rejected
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.status = 'loading'; state.error = ''; })
      .addCase(loginUser.fulfilled, (state, action) => { state.status = 'idle'; state.session = action.payload.user; })
      .addCase(loginUser.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; })
      .addCase(signupUser.pending, (state) => { state.status = 'loading'; state.error = ''; })
      .addCase(signupUser.fulfilled, (state) => { state.status = 'idle'; })
      .addCase(signupUser.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; })
      .addCase(refreshSession.fulfilled, (state, action) => { state.session = action.payload; });
  },
});

export const { setSession, logout } = authSlice.actions;
export default authSlice.reducer;
