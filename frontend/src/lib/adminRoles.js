/**
 * NEXUS ESPORTS — administrative role catalogue.
 *
 * Single source of truth for the Super Admin Administration Directory, the
 * Add Admin / Create Community Moderator form and the local account helpers.
 * Values mirror the roles used by the existing routing and authentication code.
 */

export const ADMIN_ROLE_OPTIONS = [
  {
    value: 'super_admin',
    role: 'super-admin',
    adminType: 'super_admin',
    label: 'Super Admin',
    icon: '⚡',
    color: '#c6ff33',
    bg: 'rgba(198, 255, 51, 0.15)',
    border: 'rgba(198, 255, 51, 0.3)',
  },
  {
    value: 'comp_admin',
    role: 'comp_admin',
    adminType: 'comp_admin',
    label: 'Competition Admin',
    icon: '🏆',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  {
    value: 'dispute_admin',
    role: 'dispute_admin',
    adminType: 'dispute_admin',
    label: 'Dispute Admin',
    icon: '🛡️',
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.15)',
    border: 'rgba(251, 146, 60, 0.3)',
  },
  {
    value: 'revenue_admin',
    role: 'revenue_admin',
    adminType: 'revenue_admin',
    label: 'Revenue Admin',
    icon: '💳',
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.15)',
    border: 'rgba(192, 132, 252, 0.3)',
  },
  {
    value: 'community_moderator',
    role: 'community_moderator',
    adminType: 'community_moderator',
    label: 'Community Moderator',
    icon: '🚩',
    color: '#f472b6',
    bg: 'rgba(244, 114, 182, 0.15)',
    border: 'rgba(244, 114, 182, 0.3)',
  },
  {
    value: 'admin',
    role: 'admin',
    adminType: 'admin',
    label: 'Admin',
    icon: '🔧',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.3)',
  },
];

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Match an account's role/adminType to its catalogue entry. */
export function adminRoleMeta(role, adminType) {
  const r = normalize(role);
  const t = normalize(adminType);
  return ADMIN_ROLE_OPTIONS.find((option) => (
    normalize(option.role) === r
    || normalize(option.value) === r
    || (t && normalize(option.adminType) === t)
  )) || null;
}

export function isAdministrativeAccount(account) {
  if (!account) return false;
  const r = normalize(account.role);
  const t = normalize(account.adminType);
  if (['participant', 'regular', 'team_lead', 'user'].includes(r)) return false;
  return !!adminRoleMeta(account.role, account.adminType);
}

/** Accepts either the catalogue value or the stored role value. */
export function resolveAdminRole(value) {
  const key = normalize(value);
  return ADMIN_ROLE_OPTIONS.find((option) => (
    normalize(option.value) === key || normalize(option.role) === key
  )) || null;
}

export const ADMIN_ROLE_VALUES = ADMIN_ROLE_OPTIONS.map((option) => option.value);

/** Roles a Super Admin may assign from the creation form (never participant). */
export const CREATABLE_ADMIN_ROLES = ADMIN_ROLE_OPTIONS.filter((option) => option.value !== 'admin');
