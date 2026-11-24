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

/** Roles that use an admin-area sidebar (the retired Admin role is gone). */
export const ADMIN_ROLES = ['finance_moderator'];

const MAIN_NAV = [
  { id: 'home', label: 'Home', to: '/', icon: HomeIcon, end: true },
  { id: 'competitions', label: 'Competitions', to: '/pages/competitions.html', icon: TrophyIcon },
  { id: 'activity', label: 'Activity', to: '/pages/my-activity.html', icon: ActivityIcon, protected: true },
  { id: 'reports', label: 'Reports', to: '/pages/my-reports.html', icon: ShieldIcon, protected: true },
  { id: 'payments', label: 'Payments', to: '/pages/my-payments.html', icon: MoneyIcon, protected: true },
  { id: 'notifications', label: 'Alerts', to: '/pages/notifications.html', icon: BellIcon, protected: true },
  { id: 'profile', label: 'Profile', to: '/pages/profile.html', icon: ProfileIcon, protected: true },
  { id: 'about', label: 'About', to: '/pages/about.html', icon: InfoIcon },
];

const ALERTS = { id: 'notifications', label: 'Alerts', to: '/pages/notifications.html', icon: BellIcon };

/** Community Moderator sidebar: Reports and Activity (Profile is in the account menu). */
const MODERATOR_NAV = [
  { id: 'reports', label: 'Reports', to: '/pages/moderator/reports.html', icon: ShieldIcon, end: true },
  { id: 'activity', label: 'Activity', to: '/pages/moderator/activity.html', icon: ActivityIcon },
  ALERTS,
  { id: 'profile', label: 'Profile', to: '/pages/moderator/profile.html', icon: ProfileIcon },
];

const ADMIN_NAV = {
  finance_moderator: [
    { id: 'finance', label: 'Finance', to: '/pages/admin/finance.html', icon: MoneyIcon, end: true },
    { id: 'ledger', label: 'Ledger', to: '/pages/admin/revenue-transactions.html', icon: TrophyIcon },
    { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
    ALERTS,
    { id: 'profile', label: 'Profile', to: '/pages/admin/admin-profile.html', icon: ProfileIcon },
  ],
};

/** Disputes and the Finance dashboard belong to the Finance Moderator; the Super Admin manages people and platform rules. */
const SUPER_ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', to: '/pages/super-admin/super-dashboard.html', icon: HomeIcon, end: true },
  { id: 'users', label: 'Users', to: '/pages/super-admin/users.html', icon: UsersIcon },
  { id: 'admins', label: 'Admins', to: '/pages/super-admin/admins.html', icon: ShieldIcon },
  { id: 'revenue', label: 'Revenue', to: '/pages/admin/revenue-transactions.html', icon: TrophyIcon },
  { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
  ALERTS,
  { id: 'profile', label: 'Profile', to: '/pages/super-admin/profile.html', icon: ProfileIcon },
];


/**
 * Every role has the same shape: main items on top; Alerts and About at the
 * bottom. Profile is not a sidebar item: it lives in the top-right account menu
 * (see UserMenu), so it is returned separately as `profileTo`.
 */
function split(items) {
  const bottomIds = ['notifications', 'about'];
  const profile = items.find((i) => i.id === 'profile');
  const rest = items.filter((i) => i.id !== 'profile');
  return {
    top: rest.filter((i) => !bottomIds.includes(i.id)),
    bottom: rest.filter((i) => bottomIds.includes(i.id)),
    profileTo: profile ? profile.to : null,
  };
}

export function getSidebarNav(session) {
  if (!session) {
    return { variant: 'main', ...split(MAIN_NAV.filter((i) => !i.protected)), showLogin: true };
  }
  const role = session.role;
  if (role === 'community_moderator') return { variant: 'admin', ...split(MODERATOR_NAV), showLogin: false };
  if (role === 'super-admin') return { variant: 'super-admin', ...split(SUPER_ADMIN_NAV), showLogin: false };
  if (ADMIN_ROLES.includes(role)) return { variant: 'admin', ...split(ADMIN_NAV[role]), showLogin: false };
  return { variant: 'main', ...split(MAIN_NAV), showLogin: false };
}
