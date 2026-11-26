/**
 * NEXUS ESPORTS — notifications slice
 *
 * The signed-in user's notifications, shared by:
 *   - the sidebar (unread badge on "Alerts"),
 *   - the "While you were away" pop-up, and
 *   - the Notifications page (list, tabs, search).
 * Marking one as read anywhere updates all three at once.
 *
 *   state.notifications.owner   → whose notifications these are (username)
 *   state.notifications.items   → the notifications from the server
 *   state.notifications.loaded  → false until the first load for `owner` finishes
 *   state.notifications.error   → error message, '' when fine
 *   state.notifications.tab     → 'all' | 'pending' | 'approved' | 'rejected' | 'info'
 *   state.notifications.query   → the search text
 *
 * Thunks: fetchNotifications(username), markNotificationRead(id),
 *         markAllNotificationsRead(username), setNotificationStatus({ id, status }),
 *         deleteNotification(id)
 * Plain actions: setNotificationTab(tab), setNotificationQuery(text)
 * Also listens to auth's logout() and clears itself.
 */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { NotificationsAPI } from '../services/api.js';
import { logout } from './authSlice.js';

// ---------- Thunks ----------

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (username, { rejectWithValue }) => {
  const res = await NotificationsAPI.getForUser(username);
  if (!res.ok) return rejectWithValue(res.error || 'Unable to load notifications.');
  return Array.isArray(res.data) ? res.data : [];
});

export const markNotificationRead = createAsyncThunk('notifications/markRead', async (id) => {
  await NotificationsAPI.markRead(id);
  return id;
});

export const markAllNotificationsRead = createAsyncThunk('notifications/markAllRead', async (username, { rejectWithValue }) => {
  const res = await NotificationsAPI.markAllRead(username);
  if (!res.ok) return rejectWithValue(res.error || 'Unable to mark notifications as read.');
  return true;
});

/** Records how the user answered an actionable notification (approved | rejected | info). */
export const setNotificationStatus = createAsyncThunk('notifications/setStatus', async ({ id, status }) => {
  await NotificationsAPI.setStatus(id, status);
  return { id, status };
});

export const deleteNotification = createAsyncThunk('notifications/delete', async (id, { rejectWithValue }) => {
  const res = await NotificationsAPI.delete(id);
  if (!res.ok) return rejectWithValue(res.error || 'Unable to delete the notification.');
  return id;
});

// ---------- Slice ----------

const initialState = {
  owner: '',
  items: [],
  loaded: false,
  error: '',
  tab: 'all',
  query: '',
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotificationTab(state, action) {
      state.tab = action.payload;
    },
    setNotificationQuery(state, action) {
      state.query = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // action.meta.arg is what the thunk was called with (here: the username)
      .addCase(fetchNotifications.pending, (state, action) => {
        if (state.owner !== action.meta.arg) return { ...initialState, owner: action.meta.arg };
        return undefined;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        if (state.owner !== action.meta.arg) return; // answer for a user who has since logged out
        state.items = action.payload;
        state.loaded = true;
        state.error = '';
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        if (state.owner !== action.meta.arg) return;
        state.loaded = true;
        state.error = action.payload || 'Unable to load notifications.';
      })
      // Mark as read straight away (on pending) so the badge drops instantly.
      .addCase(markNotificationRead.pending, (state, action) => {
        const item = state.items.find((n) => n.id === action.meta.arg);
        if (item) item.read = true;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.read = true; });
      })
      .addCase(setNotificationStatus.fulfilled, (state, action) => {
        const item = state.items.find((n) => n.id === action.payload.id);
        if (item) item.status = action.payload.status;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.items = state.items.filter((n) => n.id !== action.payload);
      })
      // Another slice's action: logging out clears the notifications.
      .addCase(logout, () => initialState);
  },
});

export const { setNotificationTab, setNotificationQuery } = notificationsSlice.actions;

/** Selector: how many notifications are unread (for the sidebar badge). */
export const selectUnreadCount = (state) => state.notifications.items.filter((n) => !n.read).length;

export default notificationsSlice.reducer;
