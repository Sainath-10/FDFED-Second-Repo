/**
 * NEXUS ESPORTS — sidebar navigation config
 *
 * Sidebar navigation builders:
 * getSidebar / getTeamSidebar / getAdminSidebar / getSuperAdminSidebar
 *
 * `getSidebarNav(session)` returns the { top, bottom, showLogin, variant } that
 * the <Sidebar> renders, using the same split (top = first 4 items, or the
 * index rule for the logged-out main sidebar).
 */
import {
  HomeIcon,
  TrophyIcon,
  ActivityIcon,
  BellIcon,
  ProfileIcon,
  InfoIcon,
  ShieldIcon,
  CheckCircleIcon,
  UsersIcon,
  MoneyIcon,
} from '../components/icons.jsx';

/** Roles that use an admin-area sidebar. */
export const ADMIN_ROLES = ['finance_moderator', 'admin'];

const MAIN_NAV = [
  { id: 'home', label: 'Home', to: '/', icon: HomeIcon, end: true },
  { id: 'competitions', label: 'Competitions', to: '/pages/competitions.html', icon: TrophyIcon },
  { id: 'activity', label: 'Activity', to: '/pages/my-activity.html', icon: ActivityIcon, protected: true },
  { id: 'disputes', label: 'Disputes', to: '/pages/disputes.html', icon: CheckCircleIcon, protected: true },
  { id: 'reports', label: 'Reports', to: '/pages/my-reports.html', icon: ShieldIcon, protected: true },
  { id: 'payments', label: 'Payments', to: '/pages/my-payments.html', icon: MoneyIcon, protected: true },
  { id: 'notifications', label: 'Alerts', to: '/pages/notifications.html', icon: BellIcon, protected: true },
  { id: 'profile', label: 'Profile', to: '/pages/profile.html', icon: ProfileIcon, protected: true },
  { id: 'about', label: 'About', to: '/pages/about.html', icon: InfoIcon },
];

const ALERTS = { id: 'notifications', label: 'Alerts', to: '/pages/notifications.html', icon: BellIcon };

/** Community Moderator sidebar: Reports, Activity, and Profile (Profile at the bottom). */
const MODERATOR_NAV = [
  { id: 'reports', label: 'Reports', to: '/pages/moderator/reports.html', icon: ShieldIcon, end: true },
  { id: 'activity', label: 'Activity', to: '/pages/moderator/activity.html', icon: ActivityIcon },
  ALERTS,
  { id: 'profile', label: 'Profile', to: '/pages/moderator/profile.html', icon: ProfileIcon },
];

const ADMIN_NAV = {
  finance_moderator: [
    { id: 'finance', label: 'Finance', to: '/pages/admin/finance.html', icon: MoneyIcon, end: true },
    { id: 'disputes', label: 'Disputes', to: '/pages/admin/disputes.html', icon: ShieldIcon },
    { id: 'ledger', label: 'Ledger', to: '/pages/admin/revenue-transactions.html', icon: TrophyIcon },
    { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
    ALERTS,
    { id: 'profile', label: 'Profile', to: '/pages/admin/admin-profile.html', icon: ProfileIcon },
  ],
  admin: [
    { id: 'home', label: 'Dashboard', to: '/pages/admin/dashboard.html', icon: HomeIcon, end: true },
    { id: 'disputes', label: 'Disputes', to: '/pages/admin/disputes.html', icon: ShieldIcon },
    { id: 'finance', label: 'Finance', to: '/pages/admin/finance.html', icon: MoneyIcon },
    { id: 'revenue', label: 'Revenue', to: '/pages/admin/revenue-transactions.html', icon: TrophyIcon },
    { id: 'users', label: 'Users', to: '/pages/admin/users.html', icon: UsersIcon },
    { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
    ALERTS,
    { id: 'profile', label: 'Profile', to: '/pages/admin/admin-profile.html', icon: ProfileIcon },
  ],
};

/** Disputes are handled by Admins and Finance; the Super Admin manages people and platform rules. */
const SUPER_ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', to: '/pages/super-admin/super-dashboard.html', icon: HomeIcon, end: true },
  { id: 'users', label: 'Users', to: '/pages/super-admin/users.html', icon: UsersIcon },
  { id: 'admins', label: 'Admins', to: '/pages/super-admin/admins.html', icon: ShieldIcon },
  { id: 'finance', label: 'Finance', to: '/pages/admin/finance.html', icon: MoneyIcon },
  { id: 'revenue', label: 'Revenue', to: '/pages/admin/revenue-transactions.html', icon: TrophyIcon },
  { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
  ALERTS,
  { id: 'profile', label: 'Profile', to: '/pages/super-admin/profile.html', icon: ProfileIcon },
];


/** Every role has the same shape: main items on top; Alerts, Profile and About at the bottom. */
function split(items) {
  const bottomIds = ['notifications', 'profile', 'about'];
  return {
    top: items.filter((i) => !bottomIds.includes(i.id)),
    bottom: items.filter((i) => bottomIds.includes(i.id)),
  };
}

export function getSidebarNav(session) {
  if (!session) {
    return { variant: 'main', ...split(MAIN_NAV.filter((i) => !i.protected)), showLogin: true };
  }
  const role = session.role;
  if (role === 'community_moderator') return { variant: 'admin', ...split(MODERATOR_NAV), showLogin: false };
  if (role === 'super-admin') return { variant: 'super-admin', ...split(SUPER_ADMIN_NAV), showLogin: false };
  if (ADMIN_ROLES.includes(role)) return { variant: 'admin', ...split(ADMIN_NAV[role] || ADMIN_NAV.admin), showLogin: false };
  return { variant: 'main', ...split(MAIN_NAV), showLogin: false };
}
