import { createHmac, timingSafeEqual } from 'crypto';

export function platformFeeMinor(prize: number, percentage: number, minimum: number): number {
  if (![prize, percentage, minimum].every(Number.isFinite) || prize < 0 || percentage < 0 || minimum < 0) {
    throw new Error('Invalid platform fee configuration');
  }
  const amount = Math.max(Math.round(minimum * 100), Math.round(prize * percentage));
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 2147483647) {
    throw new Error('Platform fee must be at least INR 1 and within the supported amount range');
  }
  return amount;
}

export function validWebhookSignature(body: Buffer, signature: string, secret: string): boolean {
  if (!body || !secret || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export function captureMatches(payment: any, transaction: { amountMinor: number; currency: string; gatewayOrderId: string }): boolean {
  return payment?.status === 'captured' && payment?.captured === true &&
    typeof payment.id === 'string' && payment.id.startsWith('pay_') &&
    payment.order_id === transaction.gatewayOrderId &&
    payment.amount === transaction.amountMinor && payment.currency === transaction.currency;
}

/** Payment states after which no money can move except a finance reversal. */
export const TERMINAL_PAYMENT_STATES = ['PRIZE_RELEASED', 'REFUND_ISSUED', 'CANCELLED', 'EXPIRED', 'ABANDONED', 'REVERSED'];

/**
 * The prize pool must be funded before this instant, otherwise the competition is
 * auto-cancelled and registrations are refunded. `hoursBefore` comes from
 * AUTO_CANCEL_HOURS_BEFORE_START (0 = deadline is the start time itself).
 */
export function prizeDeadline(startDate: Date | string, hoursBefore: number): Date {
  const hours = Number.isFinite(hoursBefore) && hoursBefore > 0 ? hoursBefore : 0;
  return new Date(+new Date(startDate) - hours * 3600000);
}

/** Organizers whose trust score drops below this cannot create new competitions. */
export const DEFAULT_MIN_ORGANIZER_TRUST = 50;
export const TRUST_PENALTY_CANCEL = 10;
export const TRUST_PENALTY_FRAUD = 25;

export function organizerTrusted(score: number | null | undefined, minimum = DEFAULT_MIN_ORGANIZER_TRUST): boolean {
  return Number(score ?? 100) >= minimum;
}

const SUBJECTS: Record<string, (name: string) => string> = {
  'competition-live': n => `Your competition "${n}" is live`,
  'new-competition-alert': n => `New competition available: ${n}`,
  'registration-confirmed': n => `Registration confirmed for ${n}`,
  'new-team-joined': n => `New team registered in ${n}`,
  'prize-pool-confirmed': n => `Prize pool locked for ${n}`,
  'prize-pool-reminder': n => `Reminder: fund the prize pool for ${n}`,
  'prize-pool-urgent': n => `URGENT: pay the prize pool or ${n} will be cancelled`,
  'tournament-completed': n => `${n} has been completed`,
  'winner-payout': n => `Prize released for ${n}`,
  'organizer-revenue-released': n => `Registration revenue released for ${n}`,
  'refund-apology': n => `Apology: ${n} has been cancelled`,
  'registration-refunded': n => `Registration fee refunded for ${n}`,
  'held-prize-distributed': n => `Held prize pool distributed for ${n}`,
  'trust-score-reviewed': () => 'Your organizer trust score was reviewed',
  'competition-cancelled-player': n => `${n} has been cancelled`,
  'competition-cancelled-organizer': n => `Competition cancelled: ${n}`,
  'settlement-reversed-organizer': n => `Settlement reversed for ${n}`,
};

export function mailSubject(template: string, competitionName: string): string {
  const build = SUBJECTS[template];
  return build ? build(competitionName) : template.replace(/-/g, ' ');
}

/**
 * Splits the prize distribution (paise, by finishing place) between ranked groups
 * of teams. Teams in the same group are tied: they share the prizes for every
 * place they jointly occupy, equally (the odd paise go to the first ids in
 * sorted order, so the result is deterministic). Places with no team to fill
 * them are returned as `unawarded`.
 */
export function allocatePrizes(distribution: number[], groups: string[][]) {
  const allocations: { teamId: string; amount: number; label: string }[] = [];
  let position = 0;
  for (const group of groups) {
    if (!group.length) continue;
    const ids = [...group].sort();
    const pool = distribution.slice(position, position + ids.length).reduce((a, b) => a + b, 0);
    const label = ids.length === 1 ? `#${position + 1}` : `joint #${position + 1}`;
    ids.forEach((teamId, i) => {
      const amount = Math.floor(pool / ids.length) + (i < pool % ids.length ? 1 : 0);
      if (amount > 0) allocations.push({ teamId, amount, label });
    });
    position += ids.length;
  }
  const unawarded = distribution.slice(position).reduce((a, b) => a + b, 0);
  return { allocations, unawarded };
}

/** Groups standings rows into ranks; rows level on points and wins are tied. */
export function standingsGroups<T extends { pts: number; w: number }>(rows: T[], key: (row: T) => string): string[][] {
  const sorted = [...rows].sort((a, b) => b.pts - a.pts || b.w - a.w);
  const groups: string[][] = [];
  let previous: T | null = null;
  for (const row of sorted) {
    if (previous && previous.pts === row.pts && previous.w === row.w) groups[groups.length - 1].push(key(row));
    else groups.push([key(row)]);
    previous = row;
  }
  return groups;
}
