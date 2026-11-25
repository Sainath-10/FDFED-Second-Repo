/**
 * NEXUS ESPORTS — competition-creation ban
 *
 * Works out from an organiser's reputation profile whether they may create
 * competitions, and for how long a ban lasts. Shared by the Create Competition
 * pop-up and the create page.
 */
const DAY = 86_400_000;
/** Sanctions that stop an organiser from creating competitions. */
export const BLOCKING_SANCTIONS = ['creation_restriction', 'one_month_ban', 'lifetime_ban', 'competition_suspension'];

/**
 * The organiser's creation ban, or null. `days` is the length the moderator set
 * (from the sanction's start and end); `until` is when it lifts.
 */
export function creationBan(profile) {
  if (!profile) return null;
  if (profile.lifetimeBan) {
    return { lifetime: true, message: 'You are permanently banned from creating competitions.' };
  }
  const now = Date.now();
  const sanction = (profile.activeSanctions || [])
    .filter((s) => BLOCKING_SANCTIONS.includes(s.type) && (!s.endsAt || new Date(s.endsAt).getTime() > now))
    .sort((a, b) => (b.endsAt ? new Date(b.endsAt).getTime() : Infinity) - (a.endsAt ? new Date(a.endsAt).getTime() : Infinity))[0];
  if (sanction?.endsAt) {
    const start = new Date(sanction.startsAt || sanction.createdAt || now).getTime();
    const days = Math.max(1, Math.round((new Date(sanction.endsAt).getTime() - start) / DAY));
    return {
      days,
      until: sanction.endsAt,
      reason: sanction.reason || '',
      message: `You are banned for ${days} day${days === 1 ? '' : 's'}.`,
    };
  }
  if (sanction) return { reason: sanction.reason || '', message: 'You are banned from creating competitions until a moderator lifts the restriction.' };
  if (profile.bannedUntil && new Date(profile.bannedUntil).getTime() > now) {
    const days = Math.max(1, Math.ceil((new Date(profile.bannedUntil).getTime() - now) / DAY));
    return { days, until: profile.bannedUntil, message: `You are banned for ${days} day${days === 1 ? '' : 's'}.` };
  }
  return null;
}
