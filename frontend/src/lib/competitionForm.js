/**
 * NEXUS ESPORTS — competition form rules
 *
 * One set of rules for the Create and Edit forms, matching the backend
 * (competition.rules.ts): registration open ≤ registration close ≤ start ≤ end,
 * no past dates, whole-rupee amounts, and descending prizes.
 *
 * Dates come from <input type="date"> as YYYY-MM-DD in the organizer's time zone.
 * The start is saved as 00:00 and the end as 23:59:59. A competition must end
 * at least one day after it starts. Registration closes at the end of
 * its day — or when the competition starts, if that is the same day.
 */

export const GAMES = [
  'Counter-Strike 2',
  'League of Legends',
  'Dota 2',
  'Fortnite',
  'Valorant',
  'Rocket League',
  'Apex Legends',
  'Overwatch 2',
  'Street Fighter 6',
];
export const FORMATS = ['Single Elimination', 'Round Robin'];
/** Platform ceiling; prize pools above LARGE_PRIZE_POOL need a finance moderator's approval first. */
export const MAX_PRIZE_POOL = 10_000_000;
export const LARGE_PRIZE_POOL = 1_000_000;
export const MAX_ENTRY_FEE = 10_000;
/** Schedule saves allowed before the start, and end-date changes after it (the server enforces both). */
export const MAX_DATE_EDITS = 2;
export const MIN_ENTRY_FEE = 10;
export const MAX_TEAMS = 256;
export const MAX_PLAYERS = 20;
export const MAX_NAME = 100;
export const MAX_DESCRIPTION = 2000;

const pad = (n) => String(n).padStart(2, '0');

/** Date → "YYYY-MM-DD" in local time (for date inputs). */
export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayInput = () => toDateInput(new Date());
/** The calendar day after a YYYY-MM-DD date (for the earliest allowed end date). */
export const nextDay = (value) => { const d = new Date(`${value}T00:00:00`); d.setDate(d.getDate() + 1); return toDateInput(d); };

/** Input value for `days` from today (local time). */
export function daysFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

/**
 * Sensible starting schedule for a new competition: registration opens today
 * and closes the day before play, which starts in a week and runs two days.
 */
export function defaultSchedule() {
  return { regOpen: todayInput(), regClose: daysFromToday(6), start: daysFromToday(7), end: daysFromToday(8) };
}

/** Same checks as the backend's OrganiserContactDto. Returns { field: message }. */
export function validateContact(contact) {
  const errors = {};
  const c = contact || {};
  if (String(c.fullName || '').trim().length < 2) errors.fullName = 'Enter your full name.';
  if (!/^\+?[0-9][0-9 -]{7,17}$/.test(String(c.phone || '').trim())) errors.phone = 'Enter a valid phone number (digits, spaces or dashes, optionally starting with +).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email || '').trim())) errors.email = 'Enter a valid email address.';
  if (String(c.purpose || '').trim().length < 20) errors.purpose = 'Explain in at least 20 characters how the prize pool is funded and why it is this large.';
  return errors;
}
export const startOfDay = (input) => (input ? new Date(`${input}T00:00:00`) : null);
export const endOfDay = (input) => (input ? new Date(`${input}T23:59:59`) : null);

/** The four ISO timestamps the API expects. */
export function scheduleToIso({ regOpen, regClose, start, end }) {
  const startAt = startOfDay(start);
  let closeAt = endOfDay(regClose);
  if (closeAt && startAt && closeAt > startAt) closeAt = startAt;
  return {
    registrationOpenAt: regOpen ? startOfDay(regOpen).toISOString() : undefined,
    registrationCloseAt: closeAt ? closeAt.toISOString() : undefined,
    startDate: startAt ? startAt.toISOString() : undefined,
    endDate: end ? endOfDay(end).toISOString() : undefined,
  };
}

/**
 * Validates the schedule. `changed` limits the "not in the past" checks to the
 * fields an edit actually changes; on create every field is checked.
 */
export function validateSchedule({ regOpen, regClose, start, end }, { changed = null } = {}) {
  const errors = {};
  const today = todayInput();
  const checks = (field) => !changed || changed.includes(field);

  if (!regOpen) errors.regOpen = 'Choose when registration opens.';
  if (!regClose) errors.regClose = 'Choose when registration closes.';
  if (!start) errors.start = 'Choose the start date.';
  if (!end) errors.end = 'Choose the end date.';

  if (regOpen && checks('regOpen') && regOpen < today) errors.regOpen = 'Registration cannot open in the past.';
  if (regClose && checks('regClose') && regClose < today) errors.regClose = 'Registration cannot close in the past.';
  if (start && checks('start') && start <= today) errors.start = 'The competition must start after today.';
  if (end && checks('end') && end < today) errors.end = 'The end date cannot be in the past.';

  if (regOpen && regClose && regClose < regOpen) errors.regClose = 'Registration must close on or after the day it opens.';
  if (regClose && start && regClose > start) errors.regClose = 'Registration must close on or before the start date.';
  if (regOpen && start && regOpen > start) errors.regOpen = 'Registration must open before the competition starts.';
  if (start && end && end <= start) errors.end = 'The competition must end at least one day after it starts.';

  if (start) {
    const limit = new Date();
    limit.setDate(limit.getDate() + 730);
    if (startOfDay(start) > limit) errors.start = 'Competitions can be scheduled at most two years ahead.';
  }
  return errors;
}

/** Whole rupees, 0 or more. Returns { value, error }. */
export function parseRupees(raw, { label = 'Amount', allowEmpty = true } = {}) {
  const text = String(raw ?? '').trim();
  if (!text) return allowEmpty ? { value: 0, error: '' } : { value: 0, error: `${label} is required.` };
  if (!/^\d+$/.test(text)) return { value: NaN, error: `${label} must be a whole number of rupees (no paise or symbols).` };
  return { value: Number(text), error: '' };
}

/** Prizes must not increase down the places, and no place pays after an empty one. */
export function validatePrizes(amounts) {
  const errors = {};
  for (let i = 1; i < amounts.length; i++) {
    if (amounts[i] > 0 && !(amounts[i - 1] > 0)) errors[i] = `Set place ${i} before giving place ${i + 1} a prize.`;
    else if (amounts[i] > amounts[i - 1]) errors[i] = `Place ${i + 1} cannot pay more than place ${i}.`;
  }
  return errors;
}

export function validateName(name) {
  const clean = String(name || '').trim();
  if (clean.length < 3) return 'Enter at least 3 characters (spaces do not count).';
  if (clean.length > MAX_NAME) return `At most ${MAX_NAME} characters.`;
  if (/[<>]/.test(clean)) return 'The name cannot contain < or >.';
  return '';
}

export function validateDescription(text) {
  const clean = String(text || '').trim();
  if (clean.length < 10) return 'Enter at least 10 characters (spaces do not count).';
  if (clean.length > MAX_DESCRIPTION) return `At most ${MAX_DESCRIPTION} characters.`;
  return '';
}

/** Reads an image file as a data URL after checking type and size (PNG/JPEG, 5 MB). */
export function readBanner(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No file selected.')); return; }
    if (!/^image\/(png|jpeg)$/.test(file.type)) { reject(new Error('Choose a PNG or JPEG image.')); return; }
    if (file.size > 5 * 1024 * 1024) { reject(new Error('The banner must be 5 MB or smaller.')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
