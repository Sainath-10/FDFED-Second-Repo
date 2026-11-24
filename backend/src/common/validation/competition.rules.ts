/**
 * NEXUS ESPORTS — Competition business rules (pure functions)
 *
 * Shared by create/update services and unit tests. All monetary amounts are in INR.
 *
 * Implements (§2.2, §2.4, §3.1–§3.4):
 *  - Platform prize-pool ceiling ₹1,00,00,000 (organiser reputation limits may be stricter), min entry fee ₹10
 *  - Prize pools above ₹10,00,000 need a finance moderator's approval (with the organiser's contact details)
 *  - Registration window validated separately from competition dates
 *  - Registration-closed field locks for name/game/type/description
 *  - Capacity (max teams / players per team) may not decrease below current values
 *  - Co-organizer rules: must exist, no self-assignment, no duplicates
 */

export const MAX_PRIZE_POOL = 10_000_000; // ₹1,00,00,000 platform-wide ceiling
/** Prize pools above this need a finance moderator's approval before the competition can be published. */
export const LARGE_PRIZE_POOL = 1_000_000; // ₹10,00,000
export const MAX_ENTRY_FEE = 10_000;
/** How many times the schedule may be edited before play starts, and the end date after it starts. */
export const MAX_DATE_EDITS = 2;

/** Drafts nobody else can see yet: waiting for finance approval or for the platform fee. */
export const UNPUBLISHED_PAYMENT_STATES = ['AWAITING_FINANCE_APPROVAL', 'AWAITING_PLATFORM_FEE'];
export const isUnpublished = (competition: { paymentStatus?: string } | null | undefined) =>
  UNPUBLISHED_PAYMENT_STATES.includes(String(competition?.paymentStatus || ''));
export const MIN_ENTRY_FEE = 10; // ₹10
export const MIN_COMPETITION_NAME = 3;
export const MIN_DESCRIPTION = 10;

export interface DateWindow {
  registrationOpenAt?: Date | null;
  registrationCloseAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export type ValidationError = { field: string; message: string };

function validDate(d: Date | null | undefined): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * Validates the order of the registration window and competition dates:
 * registration open <= registration close <= start <= end. The end may fall on
 * the start day because the form saves the end date as 23:59:59 (one-day events).
 */
export function validateDateWindow(w: DateWindow): ValidationError[] {
  const errors: ValidationError[] = [];
  const { registrationOpenAt, registrationCloseAt, startDate, endDate } = w;

  if (validDate(registrationOpenAt) && validDate(registrationCloseAt) && registrationCloseAt.getTime() < registrationOpenAt.getTime()) {
    errors.push({ field: 'registrationCloseAt', message: 'Registration must close on or after the day it opens.' });
  }
  if (validDate(registrationCloseAt) && validDate(startDate) && registrationCloseAt.getTime() > startDate.getTime()) {
    errors.push({ field: 'registrationCloseAt', message: 'Registration must close before the competition starts.' });
  }
  if (validDate(registrationOpenAt) && validDate(startDate) && registrationOpenAt.getTime() > startDate.getTime()) {
    errors.push({ field: 'registrationOpenAt', message: 'Registration must open before the competition starts.' });
  }
  // The end day must be at least one day after the start day. The start is
  // stored at 00:00 and the end at 23:59:59, so a gap under 24 hours means the
  // same calendar day (this holds in every timezone).
  if (validDate(startDate) && validDate(endDate) && endDate.getTime() - startDate.getTime() < 86_400_000) {
    errors.push({ field: 'endDate', message: 'The competition must end at least one day after it starts.' });
  }
  return errors;
}

/** Furthest a competition may be scheduled ahead. */
export const MAX_SCHEDULE_AHEAD_DAYS = 730;

/** New or changed dates must lie in the future and within the scheduling horizon. */
export function validateFutureDates(w: DateWindow, now: Date = new Date()): ValidationError[] {
  const errors: ValidationError[] = [];
  const horizon = now.getTime() + MAX_SCHEDULE_AHEAD_DAYS * 86_400_000;
  if (validDate(w.startDate)) {
    if (w.startDate.getTime() <= now.getTime()) errors.push({ field: 'startDate', message: 'The start date must be in the future.' });
    else if (w.startDate.getTime() > horizon) errors.push({ field: 'startDate', message: 'Competitions can be scheduled at most two years ahead.' });
  }
  if (validDate(w.endDate) && w.endDate.getTime() <= now.getTime()) {
    errors.push({ field: 'endDate', message: 'The end date must be in the future.' });
  }
  if (validDate(w.registrationCloseAt) && w.registrationCloseAt.getTime() <= now.getTime()) {
    errors.push({ field: 'registrationCloseAt', message: 'Registration must close in the future.' });
  }
  return errors;
}

/** Games, formats and fee models offered by the create and edit forms. */
export const SUPPORTED_GAMES = [
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
export const SUPPORTED_FORMATS = ['Single Elimination', 'Round Robin'];
export const COMPETITION_TYPES = ['tournament', 'league'];
export const FEE_TYPES = ['free', 'per_team', 'per_player'];
export const MAX_TEAMS_LIMIT = 256;
export const MAX_PLAYERS_LIMIT = 20;
export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 2000;

/** Plain-text name check shared by create and edit: trimmed length and no markup. */
export function validateCompetitionName(name: unknown): string | null {
  const clean = String(name ?? '').trim();
  if (clean.length < MIN_COMPETITION_NAME) return `Competition name must be at least ${MIN_COMPETITION_NAME} characters.`;
  if (clean.length > MAX_NAME_LENGTH) return `Competition name cannot exceed ${MAX_NAME_LENGTH} characters.`;
  if (/[<>]/.test(clean)) return 'Competition name cannot contain < or >.';
  return null;
}

export function validateDescription(description: unknown): string | null {
  const clean = String(description ?? '').trim();
  if (clean.length < MIN_DESCRIPTION) return `Description must be at least ${MIN_DESCRIPTION} characters (spaces do not count).`;
  if (clean.length > MAX_DESCRIPTION_LENGTH) return `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`;
  return null;
}

/** Whole rupees only, so no amount is silently rounded anywhere in the ledger. */
export function isWholeRupees(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

/**
 * Prize places must not increase (1st >= 2nd >= 3rd), and a later place cannot
 * pay when an earlier one pays nothing.
 */
export function validatePrizeOrder(amounts: number[]): string | null {
  for (let i = 1; i < amounts.length; i++) {
    if (amounts[i] > 0 && amounts[i - 1] <= 0) return `Place ${i + 1} cannot have a prize while place ${i} has none.`;
    if (amounts[i] > amounts[i - 1]) return `Place ${i} must pay at least as much as place ${i + 1}.`;
  }
  return null;
}

/** True when registration has closed for the competition (§3.1). */
export function isRegistrationClosed(
  comp: { registrationCloseAt?: Date | null; endDate?: Date | null; startDate?: Date | null },
  now: Date = new Date(),
): boolean {
  const cut = comp.registrationCloseAt ?? comp.startDate ?? comp.endDate;
  return validDate(cut) ? now.getTime() >= cut.getTime() : false;
}

/**
 * True once the competition has started (roster lock §6.2).
 *
 * §3.4 — registration closure and competition start are separate concepts:
 * closing registration never starts the competition.
 */
export function isCompetitionStarted(
  comp: { startDate?: Date | null },
  now: Date = new Date(),
): boolean {
  return validDate(comp.startDate) ? now.getTime() >= comp.startDate.getTime() : false;
}

/**
 * Parses a persisted/display prize amount: numbers, "₹1,00,000", "100000",
 * and "No Prize Pool" are supported. Returns NaN for malformed values.
 */
export function parsePrizeAmount(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const text = String(value).trim();
  if (!text) return 0;
  if (/^no\s+prize/i.test(text)) return 0;
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (!/^\d*\.?\d+$/.test(cleaned)) return NaN;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : NaN;
}

/** Sums a `prizes: [{ place, amount }]` distribution list. */
export function prizeDistributionTotal(prizes: unknown): number {
  if (!Array.isArray(prizes)) return 0;
  return prizes.reduce((sum, entry) => {
    const raw = entry && typeof entry === 'object' ? (entry as any).amount : entry;
    const amount = parsePrizeAmount(raw);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

/** Validates the full prize distribution list, including the ₹10 lakh total cap. */
export function validatePrizeDistribution(prizes: unknown): string | null {
  if (prizes === undefined || prizes === null) return null;
  if (!Array.isArray(prizes)) return 'Prize distribution must be a list of amounts.';
  for (const entry of prizes) {
    const raw = entry && typeof entry === 'object' ? (entry as any).amount : entry;
    const amount = parsePrizeAmount(raw);
    if (Number.isNaN(amount)) return 'Each prize distribution amount must be a valid number.';
    if (amount < 0) return 'Prize distribution amounts cannot be negative.';
    if (!isWholeRupees(amount)) return 'Prize amounts must be whole rupees (no paise).';
  }
  const orderError = validatePrizeOrder(prizes.map((entry) => parsePrizeAmount(entry && typeof entry === 'object' ? (entry as any).amount : entry)));
  if (orderError) return orderError;
  const total = prizeDistributionTotal(prizes);
  if (total > MAX_PRIZE_POOL) {
    return `Total prize pool cannot exceed ₹${MAX_PRIZE_POOL.toLocaleString('en-IN')} (platform maximum).`;
  }
  return null;
}

/**
 * Resolves the effective prize total from `prize`, `prizePool` and the
 * distribution list. Taking the maximum prevents a client from sending a
 * small `prize` while hiding a larger distribution in another field.
 */
export function resolvePrizeTotal(input: { prize?: unknown; prizePool?: unknown; prizes?: unknown }): number {
  const candidates: number[] = [];
  for (const value of [input.prize, input.prizePool]) {
    const parsed = parsePrizeAmount(value);
    if (Number.isFinite(parsed)) candidates.push(parsed);
  }
  const distributed = prizeDistributionTotal(input.prizes);
  if (Number.isFinite(distributed)) candidates.push(distributed);
  return candidates.length ? Math.max(...candidates) : 0;
}

/** Validates the prize pool on create. Returns null when valid. */
export function validatePrizePool(prize: unknown): string | null {
  if (prize === undefined || prize === null || prize === '') return null; // no prize pool allowed
  const num = typeof prize === 'number' ? prize : Number(prize);
  if (Number.isNaN(num)) return 'Prize pool must be a valid number.';
  if (num < 0) return 'Prize pool cannot be negative.';
  if (!isWholeRupees(num)) return 'Prize pool must be a whole number of rupees.';
  if (num > MAX_PRIZE_POOL) return `Prize pool cannot exceed ₹${MAX_PRIZE_POOL.toLocaleString('en-IN')} (platform maximum).`;
  return null;
}

/** Validates the entry fee on create/edit. Returns null when valid. Minimum ₹10 applies only when a fee applies. */
export function validateEntryFee(feeType: string | undefined, amount: unknown): string | null {
  if (!feeType || feeType === 'free') return null;
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (Number.isNaN(num)) return 'Entry fee must be a valid number.';
  if (!isWholeRupees(num)) return 'Entry fee must be a whole number of rupees.';
  if (num < MIN_ENTRY_FEE) return 'Entry fee must be at least ₹10.';
  if (num > MAX_ENTRY_FEE) return `Entry fee cannot exceed ₹${MAX_ENTRY_FEE.toLocaleString('en-IN')}.`;
  return null;
}

/**
 * Capacity edit check (§3.3). Values may not go below the current ones, and
 * maxPlayersPerTeam may not go below the largest existing roster size, and
 * maxTeams may not go below the current number of registered (non-rejected) teams.
 */
export function validateCapacityEdit(
  comp: { maxTeams?: number; maxPlayersPerTeam?: number },
  updates: { maxTeams?: number; maxPlayersPerTeam?: number },
  registeredTeamsCount: number,
  largestRosterSize: number,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (updates.maxTeams !== undefined) {
    const next = Number(updates.maxTeams);
    if (Number.isNaN(next) || !Number.isInteger(next) || next < 2) {
      errors.push({ field: 'maxTeams', message: 'Max Teams must be a whole number of at least 2.' });
    } else if (next > MAX_TEAMS_LIMIT) {
      errors.push({ field: 'maxTeams', message: `Max Teams cannot exceed ${MAX_TEAMS_LIMIT}.` });
    } else if (comp.maxTeams !== undefined && next < comp.maxTeams) {
      errors.push({ field: 'maxTeams', message: `Max Teams cannot be decreased below its current value (${comp.maxTeams}).` });
    } else if (registeredTeamsCount > 0 && next < registeredTeamsCount) {
      errors.push({ field: 'maxTeams', message: `Max Teams cannot be decreased below the ${registeredTeamsCount} currently registered team(s).` });
    }
  }
  if (updates.maxPlayersPerTeam !== undefined) {
    const next = Number(updates.maxPlayersPerTeam);
    if (Number.isNaN(next) || !Number.isInteger(next) || next < 1) {
      errors.push({ field: 'maxPlayersPerTeam', message: 'Max Players per Team must be a whole number of at least 1.' });
    } else if (next > MAX_PLAYERS_LIMIT) {
      errors.push({ field: 'maxPlayersPerTeam', message: `Max Players per Team cannot exceed ${MAX_PLAYERS_LIMIT}.` });
    } else if (comp.maxPlayersPerTeam !== undefined && next < comp.maxPlayersPerTeam) {
      errors.push({ field: 'maxPlayersPerTeam', message: `Max Players per Team cannot be decreased below its current value (${comp.maxPlayersPerTeam}).` });
    } else if (largestRosterSize > 0 && next < largestRosterSize) {
      errors.push({ field: 'maxPlayersPerTeam', message: `Max Players per Team cannot be less than the largest existing roster (${largestRosterSize} players).` });
    }
  }
  return errors;
}

/**
 * Co-organizer resolution (§2.1). Inputs are cleaned usernames; the caller must
 * supply `existingUsernames` (lower-cased set from the persisted accounts).
 */
export function resolveCoOrganizers(
  rawList: string[] | undefined,
  creatorUsername: string,
  existingUsernames: string[],
): { coOrganizers: string[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const existing = new Set(existingUsernames.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean));
  const creatorLower = String(creatorUsername || '').trim().toLowerCase();
  const seen = new Set<string>();
  const coOrganizers: string[] = [];

  (rawList || []).forEach((rawEntry) => {
    const clean = String(rawEntry || '').trim().replace(/^@/, '');
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (lower === creatorLower) {
      errors.push({ field: 'coOrganizers', message: 'The creator is already the primary organizer; self-assignment is not allowed.' });
      return;
    }
    if (seen.has(lower)) return; // silent dedupe of duplicates
    if (!existing.has(lower)) {
      errors.push({ field: 'coOrganizers', message: `Co-organizer username "${clean}" does not exist.` });
      return;
    }
    seen.add(lower);
    coOrganizers.push(clean);
  });

  return { coOrganizers, errors };
}

/** Generates an unpredictable join code for private competitions (§2.4). */
export function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  let code = '';
  const bytes = Buffer.alloc(12);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    crypto.randomFillSync(bytes);
  } catch (e) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}
