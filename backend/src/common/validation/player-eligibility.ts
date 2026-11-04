import { UserRole } from '../interfaces';

/**
 * Accounts that can be invited to a team or join a competition.
 *
 * Only normal player accounts are eligible. Administrative and staff accounts
 * are excluded here (not just in the UI) so the Add Players search, the invite
 * endpoint, team creation, join requests and invitation acceptance all agree on
 * the same rule. The stored role / adminType is the authoritative source; the
 * retired administrator role values are listed explicitly so accounts that were
 * never migrated can still never become participants.
 */
const ELIGIBLE_ROLES = new Set<string>([
  UserRole.PARTICIPANT,
  UserRole.TEAM_LEAD,
  'regular',
  'user',
]);

/** Privileged roles that must never be added to a competition roster. */
const PRIVILEGED_ROLES = new Set<string>([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.COMMUNITY_MODERATOR,
  'super-admin',
  'finance_moderator',
  'finance-admin',
  'finance_admin',
  'support',
  'support_team',
  'staff',
  // Retired administrator roles: removed from the application, still rejected
  // if a legacy row survives the migration.
  'comp_admin',
  'dispute_admin',
  'revenue_admin',
]);

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

// Secondary safety net for imported staff identities that kept an ordinary
// stored role. The role check above decides eligibility; this only refuses
// accounts that are clearly staff-named so they can never be offered as players.
const PRIVILEGED_IDENTITY = /(^|[^a-z])(admin|moderator|communitymod|support|finance|revenue|staff)([^a-z]|$)/i;

export function isPrivilegedRole(role?: string | null, adminType?: string | null): boolean {
  return PRIVILEGED_ROLES.has(normalise(role)) || !!normalise(adminType);
}

export function isEligiblePlayerAccount(account: any): boolean {
  if (!account || account.banned) return false;

  const role = normalise(account.role);
  const adminType = normalise(account.adminType);
  if (isPrivilegedRole(role, adminType)) return false;
  if (!ELIGIBLE_ROLES.has(role)) return false;
  if (adminType) return false;

  const identity = `${account.username || ''} ${account.email || ''}`;
  return !PRIVILEGED_IDENTITY.test(identity);
}
