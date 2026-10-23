/**
 * NEXUS ESPORTS — Competition business rules (pure functions)
 *
 * Shared by create/update services and unit tests. All monetary amounts are in INR.
 *
 * Implements (§2.2, §2.4, §3.1–§3.4):
 *  - Max prize pool ₹10,00,000, min entry fee ₹10 (where a fee applies)
 *  - Prize pools above ₹50,000 no longer require administrative approval
 *  - Registration window validated separately from competition dates
 *  - Registration-closed field locks for name/game/type/description
 *  - Capacity (max teams / players per team) may not decrease below current values
 *  - Co-organizer rules: must exist, no self-assignment, no duplicates
 */

export const MAX_PRIZE_POOL = 1_000_000; // ₹10,00,000
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
 * Validates chronology of the registration window and competition dates as
 * separate concepts (§3.4). Registration may close before or after the
 * competition starts — only logical ordering is enforced, and no restriction is
 * imposed between reg-close and competition start.
 */
export function validateDateWindow(w: DateWindow): ValidationError[] {
  const errors: ValidationError[] = [];
  const { registrationOpenAt, registrationCloseAt, startDate, endDate } = w;

  const hasAnyDate = [registrationOpenAt, registrationCloseAt, startDate, endDate].some(validDate);
  if (!hasAnyDate) return errors;

  if (validDate(registrationOpenAt) && validDate(registrationCloseAt) && registrationCloseAt.getTime() < registrationOpenAt.getTime()) {
    errors.push({ field: 'registrationCloseAt', message: 'Registration Close must be on or after Registration Open.' });
  }
  if (validDate(startDate) && validDate(endDate) && endDate.getTime() <= startDate.getTime()) {
    errors.push({ field: 'endDate', message: 'Competition End Date must be strictly after the Start Date.' });
  }
  if (validDate(registrationOpenAt) && validDate(endDate) && endDate.getTime() < registrationOpenAt.getTime()) {
    errors.push({ field: 'endDate', message: 'Competition End Date cannot be before Registration Open.' });
  }
  return errors;
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
  }
  const total = prizeDistributionTotal(prizes);
  if (total > MAX_PRIZE_POOL) {
    return `Total prize pool cannot exceed ₹${MAX_PRIZE_POOL.toLocaleString('en-IN')} (₹10 lakh).`;
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
  if (num > MAX_PRIZE_POOL) return `Prize pool cannot exceed ₹${MAX_PRIZE_POOL.toLocaleString('en-IN')} (₹10 lakh).`;
  return null;
}

/** Validates the entry fee on create/edit. Returns null when valid. Minimum ₹10 applies only when a fee applies. */
export function validateEntryFee(feeType: string | undefined, amount: unknown): string | null {
  if (!feeType || feeType === 'free') return null;
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (Number.isNaN(num)) return 'Entry fee must be a valid number.';
  if (num < MIN_ENTRY_FEE) return 'Entry fee must be at least ₹10.';
  if (num > MAX_PRIZE_POOL) return 'Entry fee is unreasonably high.';
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
    if (Number.isNaN(next) || next < 2) {
      errors.push({ field: 'maxTeams', message: 'Max Teams must be at least 2.' });
    } else if (comp.maxTeams !== undefined && next < comp.maxTeams) {
      errors.push({ field: 'maxTeams', message: `Max Teams cannot be decreased below its current value (${comp.maxTeams}).` });
    } else if (registeredTeamsCount > 0 && next < registeredTeamsCount) {
      errors.push({ field: 'maxTeams', message: `Max Teams cannot be decreased below the ${registeredTeamsCount} currently registered team(s).` });
    }
  }
  if (updates.maxPlayersPerTeam !== undefined) {
    const next = Number(updates.maxPlayersPerTeam);
    if (Number.isNaN(next) || next < 1) {
      errors.push({ field: 'maxPlayersPerTeam', message: 'Max Players per Team must be at least 1.' });
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
      errors.push({ field: 'coOrganizers', message: 'This username does not exist.' });
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
