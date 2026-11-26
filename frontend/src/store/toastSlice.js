/**
 * NEXUS ESPORTS — toast slice
 *
 * The small pop-up messages in the bottom-right corner ("Saved!", errors).
 * They are global UI state: any page can show one, and <Toaster /> renders
 * whatever is in the store.
 *
 *   state.toasts.items → [{ id, message, type: 'success' | 'error', leaving }]
 *
 * Plain actions: toastAdded, toastLeaving (starts the fade-out), toastRemoved
 * Thunk: showToast(message, type) → adds a toast and removes it after 3 seconds.
 */
import { createSlice } from '@reduxjs/toolkit';

const SHOW_MS = 3000;
const FADE_MS = 300;
let nextId = 1;

const toastSlice = createSlice({
  name: 'toasts',
  initialState: { items: [] },
  reducers: {
    // payload = { id, message, type }
    toastAdded(state, action) {
      state.items.push({ ...action.payload, leaving: false });
    },
    // payload = id
    toastLeaving(state, action) {
      const toast = state.items.find((t) => t.id === action.payload);
      if (toast) toast.leaving = true;
    },
    // payload = id
    toastRemoved(state, action) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
  },
});

export const { toastAdded, toastLeaving, toastRemoved } = toastSlice.actions;

/**
 * A hand-written thunk: it dispatches now and again later (timers), which a
 * reducer is not allowed to do.
 */
export const showToast = (message, type = 'success') => (dispatch) => {
  const id = nextId++;
  dispatch(toastAdded({ id, message: String(message), type }));
  setTimeout(() => dispatch(toastLeaving(id)), SHOW_MS);
  setTimeout(() => dispatch(toastRemoved(id)), SHOW_MS + FADE_MS);
};

export default toastSlice.reducer;
