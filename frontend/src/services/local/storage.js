/**
 * NEXUS ESPORTS — localStorage manager for the report / reputation system.
 *
 * Every record written by this system lives in localStorage under the
 * `nexus.rs.` namespace. Existing application keys are never touched, and
 * initialisation only fills in missing keys — it never clears or resets data.
 *
 * Limits are documented in the implementation report: localStorage is shared
 * per browser profile, is user-editable, and has a small quota. Validation in
 * this module protects against corrupted records and quota overflows, not
 * against a user who deliberately edits their own storage.
 */

export const SCHEMA_VERSION = 1;
export const NAMESPACE = 'nexus.rs.';
export const STORAGE_EVENT = 'nexus:rs-change';

export const KEYS = {
  version: `${NAMESPACE}version`,
  reputation: `${NAMESPACE}reputation`,
  history: `${NAMESPACE}reputation.history`,
  sanctions: `${NAMESPACE}sanctions`,
  prizeConfig: `${NAMESPACE}prizePool.config`,
  exceptions: `${NAMESPACE}prizePool.exceptions`,
  reports: `${NAMESPACE}reports`,
  discussions: `${NAMESPACE}discussions`,
  messages: `${NAMESPACE}discussions.messages`,
  restrictions: `${NAMESPACE}reports.restrictions`,
  investigations: `${NAMESPACE}reports.investigations`,
  audit: `${NAMESPACE}audit`,
  warnings: `${NAMESPACE}warnings`,
  automatedWarnings: `${NAMESPACE}warnings.automated`,
  moderatorActivity: `${NAMESPACE}moderator.activity`,
  deadlines: `${NAMESPACE}reports.deadlines`,
};

const listeners = new Set();
let crossTabBound = false;

function bindCrossTab() {
  if (crossTabBound || typeof window === 'undefined') return;
  crossTabBound = true;
  window.addEventListener('storage', (event) => {
    if (!event.key || !String(event.key).startsWith(NAMESPACE)) return;
    emit(event.key);
  });
}

export function emit(changedKey) {
  bindCrossTab();
  listeners.forEach((listener) => {
    try { listener(changedKey); } catch (err) { /* a render error must not stop other listeners */ }
  });
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key: changedKey } }));
    } catch (err) { /* CustomEvent unsupported — same-tab listeners already ran */ }
  }
}

/** Subscribe to same-tab and cross-tab changes. Returns an unsubscribe function. */
export function subscribe(listener) {
  bindCrossTab();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readRaw(key) {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch (err) { return null; }
}

/** Safe JSON read: corrupted or missing data falls back to the supplied value. */
export function read(key, fallback) {
  const raw = readRaw(key);
  if (raw === null || raw === undefined) return fallback;
  try { return JSON.parse(raw); } catch (err) { return fallback; }
}

/**
 * Safe JSON write. Returns { ok, error }. Quota failures are surfaced to the
 * caller so screens can show a real message instead of silently losing data.
 */
export function write(key, value) {
  if (typeof window === 'undefined') return { ok: false, error: 'Storage is not available.' };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emit(key);
    return { ok: true };
  } catch (err) {
    const quota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    return {
      ok: false,
      error: quota
        ? 'Browser storage is full. Remove some evidence attachments and try again.'
        : 'Unable to save to browser storage.',
    };
  }
}

export function update(key, updater, fallback) {
  const current = read(key, fallback);
  const next = updater(current);
  if (next === undefined) return { ok: false, error: 'Nothing to save.' };
  return write(key, next);
}

export function remove(key) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
    emit(key);
  } catch (err) { /* ignore */ }
}

export function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export const now = () => new Date().toISOString();

/** Case-insensitive username keys so @User and @user are the same account. */
export function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

export function sameUser(a, b) {
  return norm(a) === norm(b) && norm(a) !== '';
}

/** Ensure a top-level object (never an array) so callers can assign keys safely. */
export function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Best-effort mutex. localStorage offers no atomic compare-and-swap, so this
 * cannot give database-grade guarantees; it prevents the common double-submit
 * races within a browser profile. The lock expires so a crashed tab cannot
 * block writes forever.
 */
export function withLock(name, fn, ttlMs = 5000) {
  const key = `${NAMESPACE}lock.${name}`;
  const deadline = Date.now() + ttlMs;
  let acquired = false;
  try {
    const raw = readRaw(key);
    const until = raw ? Number(raw) : 0;
    if (!raw || !Number.isFinite(until) || until < Date.now()) {
      window.localStorage.setItem(key, String(deadline));
      acquired = true;
    }
  } catch (err) {
    // Storage unavailable — run without the lock rather than blocking the user.
    acquired = true;
  }

  if (!acquired) {
    return { ok: false, error: 'Another action is being saved right now. Please try again.', busy: true };
  }

  try {
    return fn();
  } finally {
    try { window.localStorage.removeItem(key); } catch (err) { /* ignore */ }
  }
}

/** Initialise only missing keys; never overwrite existing data. */
export function initialiseSchema() {
  const current = Number(readRaw(KEYS.version) || 0);
  if (current >= SCHEMA_VERSION) return;

  const defaults = [
    [KEYS.reputation, {}],
    [KEYS.history, []],
    [KEYS.sanctions, []],
    [KEYS.prizeConfig, { globalMaximumPrizePool: 300000, currency: 'INR' }],
    [KEYS.exceptions, []],
    [KEYS.reports, []],
    [KEYS.discussions, []],
    [KEYS.messages, []],
    [KEYS.restrictions, {}],
    [KEYS.investigations, {}],
    [KEYS.audit, []],
    [KEYS.warnings, {}],
    [KEYS.automatedWarnings, []],
    [KEYS.moderatorActivity, []],
    [KEYS.deadlines, {}],
  ];

  defaults.forEach(([key, value]) => {
    if (readRaw(key) === null) write(key, value);
  });
  try { window.localStorage.setItem(KEYS.version, String(SCHEMA_VERSION)); } catch (err) { /* ignore */ }
}

initialiseSchema();
