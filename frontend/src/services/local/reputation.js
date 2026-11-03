/**
 * NEXUS ESPORTS — local organiser reputation engine.
 *
 * Four levels (Blue / Green / Orange / Red), permanent prize-pool limits, a
 * configurable global ceiling (₹3,00,000), auditable transitions, persistent
 * sanctions and competition-specific prize-pool exceptions.
 *
 * Reputation only ever changes through an explicit reviewer decision. Reports
 * under investigation never mutate a profile.
 */
import { LEVEL_META } from '../../lib/reporting.js';
import {
  KEYS, read, write, asArray, asObject, uid, now, norm,
  sameUser, withLock,
} from './storage.js';

export const DEFAULT_GLOBAL_MAX = 300000;
export const LEVEL_ORDER = ['blue', 'green', 'orange', 'red'];

const SEVERITY = { blue: 0, green: 1, orange: 2, red: 3 };

function defaultCounters() {
  return {
    qualifyingAbove50k: 0,
    qualifyingAbove7k: 0,
    qualifyingAbove5k: 0,
    overduePaymentCount: 0,
    mediumViolationCount: 0,
    seriousViolationCount: 0,
    outstandingObligations: 0,
    completedCompetitions: 0,
    substantiatedReports: 0,
    warnings: 0,
  };
}

function defaultProfile(username) {
  return {
    username,
    level: 'blue',
    counters: defaultCounters(),
    flags: { recoveredFromOrange: false, redRecoveryBanCount: 0, historyVerified: false },
    bannedUntil: null,
    lifetimeBan: false,
    recoveryProgress: { qualifyingAbove7k: 0, qualifyingAbove5k: 0, debtResolved: false },
    createdAt: now(),
    updatedAt: now(),
  };
}

export function getGlobalMax() {
  const config = asObject(read(KEYS.prizeConfig, null));
  const value = Number(config.globalMaximumPrizePool);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GLOBAL_MAX;
}

export function levelLimit(level) {
  return LEVEL_META[level]?.limit ?? DEFAULT_GLOBAL_MAX;
}

/** Effective limit = min(level limit, global ceiling). */
export function effectiveLimit(level) {
  return Math.min(levelLimit(level), getGlobalMax());
}

function saveProfile(profile) {
  const all = asObject(read(KEYS.reputation, {}));
  all[norm(profile.username)] = profile;
  return write(KEYS.reputation, all);
}

export function ensureProfile(username) {
  const key = norm(username);
  if (!key) return null;
  const all = asObject(read(KEYS.reputation, {}));
  let profile = all[key];
  if (!profile || typeof profile !== 'object') {
    profile = defaultProfile(username);
    all[key] = profile;
    write(KEYS.reputation, all);
  }
  profile.counters = { ...defaultCounters(), ...asObject(profile.counters) };
  profile.flags = { recoveredFromOrange: false, redRecoveryBanCount: 0, historyVerified: false, ...asObject(profile.flags) };
  profile.recoveryProgress = { qualifyingAbove7k: 0, qualifyingAbove5k: 0, debtResolved: false, ...asObject(profile.recoveryProgress) };
  return profile;
}

export function publicProfile(profile) {
  if (!profile) return null;
  const globalMax = getGlobalMax();
  const limit = Math.min(levelLimit(profile.level), globalMax);
  return {
    username: profile.username,
    level: profile.level,
    limit,
    levelLimit: levelLimit(profile.level),
    globalMax,
    bannedUntil: profile.bannedUntil || null,
    lifetimeBan: !!profile.lifetimeBan,
    counters: profile.counters,
    flags: profile.flags,
    recoveryProgress: profile.recoveryProgress,
    // Active sanctions are surfaced so competition creation can enforce
    // creation restrictions and organising bans, not just the prize limit.
    activeRestrictions: sanctionsOf(profile.username, { activeOnly: true }),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/** True when an active sanction blocks creating/editing competitions. */
export function isCreationBlocked(profile) {
  if (!profile) return false;
  if (profile.lifetimeBan) return true;
  if (profile.bannedUntil && new Date(profile.bannedUntil).getTime() > Date.now()) return true;
  const blocking = new Set(['creation_restriction', 'competition_suspension', 'organising_ban', 'lifetime_ban']);
  return asArray(profile.activeRestrictions).some((sanction) => (
    blocking.has(sanction.type)
    && (!sanction.endsAt || new Date(sanction.endsAt).getTime() > Date.now())
  ));
}

export function profileOf(username) {
  return publicProfile(ensureProfile(username));
}

export function historyOf(username) {
  return asArray(read(KEYS.history, [])).filter((entry) => sameUser(entry.username, username));
}

function pushHistory(username, fromLevel, toLevel, reason, reviewer, reportId) {
  const entry = {
    id: uid('rep'),
    username,
    fromLevel,
    toLevel,
    reason: reason || 'Reputation transition',
    reviewer: reviewer || 'system',
    reportId: reportId || null,
    createdAt: now(),
  };
  const all = asArray(read(KEYS.history, []));
  all.unshift(entry);
  write(KEYS.history, all);
  return entry;
}

export function applyLevelChange(username, toLevel, options = {}) {
  const profile = ensureProfile(username);
  if (!profile) return { ok: false, error: 'Unknown organiser.' };
  if (!LEVEL_META[toLevel]) return { ok: false, error: 'Unknown reputation level.' };
  const fromLevel = profile.level;
  if (fromLevel === toLevel) return { ok: true, profile: publicProfile(profile), unchanged: true };

  profile.level = toLevel;
  profile.updatedAt = now();
  if (toLevel === 'blue' && fromLevel === 'orange') profile.flags.recoveredFromOrange = true;
  saveProfile(profile);
  pushHistory(username, fromLevel, toLevel, options.reason, options.reviewer, options.reportId);
  return { ok: true, profile: publicProfile(profile) };
}

export function addSanction(username, payload = {}, reviewer = 'system') {
  const profile = ensureProfile(username);
  if (!profile) return { ok: false, error: 'Unknown organiser.' };
  const type = String(payload.type || '').trim();
  if (!type) return { ok: false, error: 'A sanction type is required.' };
  const days = Number(payload.days) || 0;
  const startsAt = now();
  const endsAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;

  const sanction = {
    id: uid('sanction'),
    username,
    type,
    reason: String(payload.reason || 'Recorded by an authorised reviewer.').slice(0, 1000),
    reportId: payload.reportId || null,
    reviewer,
    startsAt,
    endsAt,
    createdAt: now(),
  };
  const all = asArray(read(KEYS.sanctions, []));
  all.unshift(sanction);
  write(KEYS.sanctions, all);

  if (type === 'lifetime_ban') profile.lifetimeBan = true;
  if (type === 'organising_ban' && endsAt) profile.bannedUntil = endsAt;
  if (type === 'formal_warning' || type === 'final_warning') {
    const warnings = asObject(read(KEYS.warnings, {}));
    const key = norm(username);
    const current = asObject(warnings[key]);
    if (type === 'formal_warning') current.formal = (Number(current.formal) || 0) + 1;
    else current.final = (Number(current.final) || 0) + 1;
    current.updatedAt = now();
    warnings[key] = current;
    write(KEYS.warnings, warnings);
    profile.counters.warnings = (Number(current.formal) || 0) + (Number(current.final) || 0);
  }
  profile.updatedAt = now();
  saveProfile(profile);
  return { ok: true, sanction };
}

export function sanctionsOf(username, { activeOnly = false } = {}) {
  const nowMs = Date.now();
  return asArray(read(KEYS.sanctions, [])).filter((row) => {
    if (!sameUser(row.username, username)) return false;
    if (!activeOnly) return true;
    if (row.type === 'lifetime_ban') return true;
    if (row.endsAt) return new Date(row.endsAt).getTime() > nowMs;
    return true;
  });
}

export function warningsOf(username) {
  const row = asObject(asObject(read(KEYS.warnings, {}))[norm(username)]);
  return {
    formal: Number(row.formal) || 0,
    final: Number(row.final) || 0,
    automated: Number(row.automated) || 0,
    total: (Number(row.formal) || 0) + (Number(row.final) || 0),
  };
}

/** Derive the target level from recorded, substantiated facts. */
export function evaluateTransition(profile, facts = {}) {
  const f = {
    qualifyingAbove50k: Number(facts.qualifyingAbove50k ?? profile.counters.qualifyingAbove50k) || 0,
    qualifyingAbove7k: Number(facts.qualifyingAbove7k ?? profile.recoveryProgress.qualifyingAbove7k) || 0,
    qualifyingAbove5k: Number(facts.qualifyingAbove5k ?? profile.recoveryProgress.qualifyingAbove5k) || 0,
    overduePaymentCount: Number(facts.overduePaymentCount ?? profile.counters.overduePaymentCount) || 0,
    mediumViolationCount: Number(facts.mediumViolationCount ?? profile.counters.mediumViolationCount) || 0,
    seriousViolationCount: Number(facts.seriousViolationCount ?? profile.counters.seriousViolationCount) || 0,
    outstandingObligations: Number(facts.outstandingObligations ?? profile.counters.outstandingObligations) || 0,
    paymentOnTime: facts.paymentOnTime !== false,
    historyVerified: !!(facts.historyVerified ?? profile.flags.historyVerified),
    deliberateNonPayment: !!facts.deliberateNonPayment,
    seriousFraud: !!facts.seriousFraud,
    newSubstantiatedMisconduct: Number(facts.newSubstantiatedMisconduct) || 0,
    recoveryDispute: !!facts.recoveryDispute,
    recoveryPaymentFailure: !!facts.recoveryPaymentFailure,
  };

  const severe = f.deliberateNonPayment || f.seriousFraud || f.seriousViolationCount > 0;

  switch (profile.level) {
    case 'blue':
      if (severe) return 'red';
      if (f.mediumViolationCount >= 2 || f.overduePaymentCount >= 2) return 'orange';
      if (
        f.qualifyingAbove50k > 3
        && f.paymentOnTime
        && f.mediumViolationCount === 0
        && f.outstandingObligations === 0
        && f.historyVerified
      ) return 'green';
      return null;

    case 'green':
      if (severe) return 'red';
      if (f.mediumViolationCount >= 2 || f.overduePaymentCount >= 2) return 'orange';
      return null;

    case 'orange':
      if (severe) return 'red';
      if (f.recoveryDispute || f.recoveryPaymentFailure) return 'red';
      if (
        f.qualifyingAbove7k >= 3
        && f.paymentOnTime
        && f.newSubstantiatedMisconduct === 0
        && f.outstandingObligations === 0
      ) return 'blue';
      return null;

    case 'red': {
      if (f.recoveryDispute || f.recoveryPaymentFailure) {
        // Recovery sanctions: one-month ban, persistent; a repeat after the ban
        // escalates to a lifetime organising ban (handled by the caller).
        return null;
      }
      if (
        f.qualifyingAbove5k >= 3
        && f.paymentOnTime
        && f.newSubstantiatedMisconduct === 0
        && f.outstandingObligations === 0
      ) return 'orange';
      return null;
    }

    default:
      return null;
  }
}

/**
 * Evaluate and apply a transition using substantiated facts. Callers must be
 * authorised reviewers; this function never runs from report submission.
 */
export function evaluate(username, facts = {}, options = {}) {
  const profile = ensureProfile(username);
  if (!profile) return { ok: false, error: 'Unknown organiser.' };

  // Persist the recorded facts so future evaluations use the same history.
  profile.counters.qualifyingAbove50k = Number(facts.qualifyingAbove50k ?? profile.counters.qualifyingAbove50k) || 0;
  profile.counters.overduePaymentCount = Number(facts.overduePaymentCount ?? profile.counters.overduePaymentCount) || 0;
  profile.counters.mediumViolationCount = Number(facts.mediumViolationCount ?? profile.counters.mediumViolationCount) || 0;
  profile.counters.seriousViolationCount = Number(facts.seriousViolationCount ?? profile.counters.seriousViolationCount) || 0;
  profile.counters.outstandingObligations = Number(facts.outstandingObligations ?? profile.counters.outstandingObligations) || 0;
  profile.recoveryProgress.qualifyingAbove7k = Number(facts.qualifyingAbove7k ?? profile.recoveryProgress.qualifyingAbove7k) || 0;
  profile.recoveryProgress.qualifyingAbove5k = Number(facts.qualifyingAbove5k ?? profile.recoveryProgress.qualifyingAbove5k) || 0;
  profile.flags.historyVerified = !!(facts.historyVerified ?? profile.flags.historyVerified);
  profile.updatedAt = now();
  saveProfile(profile);

  const target = evaluateTransition(profile, facts);

  // Orange relapse rule: an organiser who recovered Orange → Blue and reaches
  // Orange again is demoted straight to Red.
  if (target === 'orange' && profile.flags.recoveredFromOrange) {
    return applyLevelChange(username, 'red', {
      reason: 'Relapsed to Orange after recovering from Orange — policy requires Red.',
      reviewer: options.reviewer,
      reportId: options.reportId,
    });
  }

  if (!target) {
    return { ok: true, profile: publicProfile(profile), transitioned: false };
  }

  const result = applyLevelChange(username, target, {
    reason: options.reason || `Reputation rule: ${profile.level} → ${target}.`,
    reviewer: options.reviewer,
    reportId: options.reportId,
  });

  if (profile.level === 'red' && target === 'red' && (facts.recoveryDispute || facts.recoveryPaymentFailure)) {
    // Handled below by the recovery sanction path in the moderator action.
  }
  return { ...result, transitioned: true };
}

/** Explicit reviewer downgrade. A warning alone must never call this. */
export function downgrade(username, level, reason, reportId, reviewer) {
  const profile = ensureProfile(username);
  if (!profile) return { ok: false, error: 'Unknown organiser.' };
  if (!LEVEL_META[level]) return { ok: false, error: 'Unknown reputation level.' };
  if (String(reason || '').trim().length < 10) {
    return { ok: false, error: 'A recorded reason (10+ characters) is required for a reputation change.' };
  }
  if (level !== 'blue' && SEVERITY[level] <= SEVERITY[profile.level]) {
    return { ok: false, error: 'That is not a downgrade from the current level.' };
  }
  return applyLevelChange(username, level, { reason, reviewer, reportId });
}

export function recordRecoverySanction(username, payload, reviewer) {
  const profile = ensureProfile(username);
  if (!profile) return { ok: false, error: 'Unknown organiser.' };
  if (profile.level !== 'red') return { ok: false, error: 'Recovery sanctions only apply to Red organisers.' };
  const priorBans = Number(profile.flags.redRecoveryBanCount) || 0;
  if (priorBans >= 1) {
    addSanction(username, {
      type: 'lifetime_ban',
      reason: payload.reason || 'Repeat violation after a recovery ban — lifetime organising ban.',
      reportId: payload.reportId,
    }, reviewer);
    return { ok: true, lifetimeBan: true };
  }
  profile.flags.redRecoveryBanCount = priorBans + 1;
  profile.updatedAt = now();
  saveProfile(profile);
  addSanction(username, {
    type: 'organising_ban',
    days: 30,
    reason: payload.reason || 'Recovery violation — one-month organising ban.',
    reportId: payload.reportId,
  }, reviewer);
  return { ok: true, banDays: 30 };
}

// ── Prize-pool configuration and exceptions ────────────────────────────────

export function getPrizeConfig() {
  const config = asObject(read(KEYS.prizeConfig, {}));
  return {
    globalMaximumPrizePool: getGlobalMax(),
    currency: config.currency || 'INR',
    updatedAt: config.updatedAt || null,
  };
}

export function setGlobalCeiling(value, actor) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid maximum prize pool.' };
  const config = { globalMaximumPrizePool: amount, currency: getPrizeConfig().currency, updatedAt: now(), updatedBy: actor || 'system' };
  write(KEYS.prizeConfig, config);
  return { ok: true, config: getPrizeConfig() };
}

export function checkPrizePool(username, amount, competitionId = null) {
  const profile = ensureProfile(username);
  const requested = Number(amount) || 0;
  const globalMax = getGlobalMax();
  const limit = Math.min(levelLimit(profile.level), globalMax);

  if (requested > globalMax) {
    return {
      ok: false,
      error: `The platform maximum prize pool is ₹${globalMax.toLocaleString('en-IN')}.`,
      globalMax,
      limit,
    };
  }

  if (requested > limit) {
    const approved = competitionId ? approvedExceptionFor(username, competitionId) : null;
    const allowedByException = approved && requested <= Math.min(Number(approved.requestedAmount) || 0, globalMax);
    if (!allowedByException) {
      return {
        ok: false,
        error: `Your current ${LEVEL_META[profile.level].label} reputation permits a maximum prize pool of ₹${limit.toLocaleString('en-IN')}.`,
        globalMax,
        limit,
        level: profile.level,
      };
    }
  }

  return { ok: true, globalMax, limit, level: profile.level };
}

export function approvedExceptionFor(username, competitionId) {
  return asArray(read(KEYS.exceptions, [])).find((row) => (
    sameUser(row.username, username)
    && String(row.competitionId || '') === String(competitionId || '')
    && row.status === 'approved'
  )) || null;
}

export function requestException(username, requestedAmount, reason) {
  const profile = ensureProfile(username);
  const amount = Number(requestedAmount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter the prize-pool amount you need.' };
  if (String(reason || '').trim().length < 10) return { ok: false, error: 'Explain why the exception is needed (10+ characters).' };
  const globalMax = getGlobalMax();
  if (amount > globalMax) return { ok: false, error: `An exception can never exceed the ₹${globalMax.toLocaleString('en-IN')} platform ceiling.` };
  if (!['blue', 'green'].includes(profile.level)) {
    return { ok: false, error: 'Only Blue or Green organisers may request a prize-pool exception.' };
  }
  const row = {
    id: uid('exc'),
    username,
    requestedAmount: amount,
    reason: String(reason).trim().slice(0, 1000),
    status: 'pending',
    reviewer: null,
    reviewNote: '',
    competitionId: null,
    createdAt: now(),
    updatedAt: now(),
  };
  const all = asArray(read(KEYS.exceptions, []));
  all.unshift(row);
  write(KEYS.exceptions, all);
  return { ok: true, exception: row };
}

export function myExceptions(username) {
  return asArray(read(KEYS.exceptions, [])).filter((row) => sameUser(row.username, username));
}

export function allExceptions(status) {
  return asArray(read(KEYS.exceptions, [])).filter((row) => !status || row.status === status);
}

export function reviewException(id, status, note, reviewer) {
  if (!['approved', 'rejected'].includes(status)) return { ok: false, error: 'Invalid review decision.' };
  const all = asArray(read(KEYS.exceptions, []));
  const index = all.findIndex((row) => row.id === id);
  if (index < 0) return { ok: false, error: 'Exception request not found.' };
  const row = all[index];
  if (status === 'approved' && Number(row.requestedAmount) > getGlobalMax()) {
    return { ok: false, error: 'An exception can never exceed the platform ceiling.' };
  }
  all[index] = { ...row, status, reviewNote: String(note || '').slice(0, 1000), reviewer: reviewer || 'admin', updatedAt: now() };
  write(KEYS.exceptions, all);
  return { ok: true, exception: all[index] };
}

/** Serialise reputation writes so two actions cannot clobber each other. */
export function mutateProfile(username, mutator) {
  return withLock(`reputation:${norm(username)}`, () => {
    const profile = ensureProfile(username);
    const result = mutator(profile);
    profile.updatedAt = now();
    saveProfile(profile);
    return result;
  });
}
