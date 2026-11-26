/**
 * NEXUS ESPORTS — toast helper
 *
 * Keeps the plain API every page already uses — `showToast('Saved!')` or
 * `showToast('Failed', 'error')` — but the toast now lives in the Redux store:
 * this dispatches the showToast thunk (store/toastSlice.js) and <Toaster />
 * renders it. Using `store.dispatch` here lets code outside React components
 * dispatch too.
 */
import { store } from '../store/store.js';
import { showToast as showToastThunk } from '../store/toastSlice.js';

export function showToast(msg, type = 'success') {
  store.dispatch(showToastThunk(msg, type));
}
