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
export const ADMIN_ROLES = ['admin', 'comp_admin', 'dispute_admin', 'revenue_admin'];

const MAIN_NAV = [
  { id: 'home', label: 'Home', to: '/', icon: HomeIcon, end: true },
  { id: 'competitions', label: 'Competitions', to: '/pages/competitions.html', icon: TrophyIcon },
  { id: 'activity', label: 'Activity', to: '/pages/my-activity.html', icon: ActivityIcon, protected: true },
  { id: 'notifications', label: 'Notifications', to: '/pages/notifications.html', icon: BellIcon, protected: true },
  { id: 'profile', label: 'Profile', to: '/pages/profile.html', icon: ProfileIcon, protected: true },
  { id: 'about', label: 'About', to: '/pages/about.html', icon: InfoIcon },
];

const ADMIN_NAV = {
  comp_admin: [
    { id: 'home', label: 'Comp Dashboard', to: '/pages/admin/dashboard.html', icon: HomeIcon, end: true },
    { id: 'users', label: 'Users', to: '/pages/admin/users.html', icon: UsersIcon },
    { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
    { id: 'profile', label: 'Profile', to: '/pages/admin/admin-profile.html', icon: ProfileIcon },
  ],
  dispute_admin: [
    { id: 'disputes', label: 'Dispute Dashboard', to: '/pages/admin/disputes.html', icon: ShieldIcon, end: true },
    { id: 'users', label: 'Users', to: '/pages/admin/users.html', icon: UsersIcon },
    { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
    { id: 'profile', label: 'Profile', to: '/pages/admin/admin-profile.html', icon: ProfileIcon },
  ],
  revenue_admin: [
    { id: 'revenue', label: 'Revenue Dashboard', to: '/pages/admin/revenue-transactions.html', icon: MoneyIcon, end: true },
    { id: 'users', label: 'Users', to: '/pages/admin/users.html', icon: UsersIcon },
    { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
    { id: 'profile', label: 'Profile', to: '/pages/admin/admin-profile.html', icon: ProfileIcon },
  ],
  general: [
    { id: 'home', label: 'Comp Dashboard', to: '/pages/admin/dashboard.html', icon: HomeIcon, end: true },
    { id: 'disputes', label: 'Disputes', to: '/pages/admin/disputes.html', icon: ShieldIcon },
    { id: 'revenue', label: 'Revenue', to: '/pages/admin/revenue-transactions.html', icon: MoneyIcon },
    { id: 'users', label: 'Users', to: '/pages/admin/users.html', icon: UsersIcon },
    { id: 'activity', label: 'Activity', to: '/pages/admin/admin-activity.html', icon: CheckCircleIcon },
    { id: 'profile', label: 'Profile', to: '/pages/admin/admin-profile.html', icon: ProfileIcon },
  ],
};

// No Disputes entry — the Super Admin has no dispute authority (see Business Rules).
const SUPER_ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', to: '/pages/super-admin/super-dashboard.html', icon: HomeIcon, end: true },
  { id: 'policy', label: 'Policy', to: '/pages/super-admin/policy-management.html', icon: CheckCircleIcon },
  { id: 'users', label: 'Users', to: '/pages/super-admin/users.html', icon: UsersIcon },
  { id: 'admins', label: 'Admins', to: '/pages/super-admin/admins.html', icon: ShieldIcon },
  { id: 'profile', label: 'Profile', to: '/pages/super-admin/profile.html', icon: ProfileIcon },
];

/** Team-lead secondary tab nav (ported from getTeamTabs). */
export const TEAM_TABS = [
  { id: 'roster', label: 'Roster', to: '/pages/team/team-roster.html' },
  { id: 'add-players', label: 'Add Players', to: '/pages/team/add-players.html' },
  { id: 'join-requests', label: 'Join Requests', to: '/pages/team/join-requests.html' },
  { id: 'invitations', label: 'Invitations Sent', to: '/pages/team/invitations-sent.html' },
  { id: 'settings', label: 'Settings', to: '/pages/team/team-settings.html' },
];

export function getSidebarNav(session) {
  if (!session) {
 // Hide protected items, then split by original index (<4 top).
    const visible = MAIN_NAV.filter((i) => !i.protected);
    return {
      variant: 'main',
      top: visible.filter((i) => MAIN_NAV.indexOf(i) < 4),
      bottom: visible.filter((i) => MAIN_NAV.indexOf(i) >= 4),
      showLogin: true,
    };
  }

  const role = session.role;

  if (role === 'super-admin') {
    return {
      variant: 'super-admin',
      top: SUPER_ADMIN_NAV.slice(0, 4),
      bottom: SUPER_ADMIN_NAV.slice(4),
      showLogin: false,
    };
  }

  if (ADMIN_ROLES.includes(role)) {
    let key = String(session.adminType || role || '').trim().toLowerCase();
    if (key === 'admin') key = 'comp_admin';
    const items = ADMIN_NAV[key] || ADMIN_NAV.general;
    const cut = items.length > 4 ? 4 : 2;
    return { variant: 'admin', top: items.slice(0, cut), bottom: items.slice(cut), showLogin: false };
  }

 // participant / team_lead / regular share the main sidebar (logged in).
  return {
    variant: 'main',
    top: MAIN_NAV.slice(0, 4),
    bottom: MAIN_NAV.slice(4),
    showLogin: false,
  };
}


