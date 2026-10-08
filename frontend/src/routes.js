/**
 * NEXUS ESPORTS — Route table
 *
 * Single source of truth for the React router. Paths mirror the static
 * page tree 1:1 (`/pages/<area>/<page>.html`) so existing deep links and query
 * params (?id=, ?compId=, ?teamId=, ?admin=, ?redirect=) keep working unchanged.
 *
 * Route shape:
 *   path   — absolute URL path (the .html form is preserved on purpose)
 *   label  — human label (used by navigation)
 *   group  — logical area: public | participant | team-lead | organizer |
 *            disputes | admin | super-admin
 *   roles  — when set, only these normalized roles may view the route; any other
 *            signed-in role is sent to its own home (see RoleGuard). `null` means
 *            "any signed-in user".
 *
 * Note: auth protection applies to the signed-in areas, and role protection only
 * where the model is unambiguous (team-lead, admin, super-admin). Other routes
 * may be viewed by any signed-in user.
 */

export const LOGIN_PATH = '/pages/login.html';
export const SIGNUP_PATH = '/pages/signup.html';
export const FALLBACK_PATH = '/';

/** role -> landing route — absolute form of the `login.js` roleRoutes map. */
export const ROLE_ROUTES = {
  regular: '/pages/profile.html',
  participant: '/pages/profile.html',
  team_lead: '/pages/team-lead-dashboard.html',
  teamlead: '/pages/team-lead-dashboard.html',
  admin: '/pages/admin/dashboard.html',
  comp_admin: '/pages/admin/dashboard.html',
  dispute_admin: '/pages/admin/disputes.html',
  revenue_admin: '/pages/admin/revenue-transactions.html',
  'super-admin': '/pages/super-admin/super-dashboard.html',
  super_admin: '/pages/super-admin/super-dashboard.html',
};

/**
 * Roles allowed into the admin area. Per the current admin/dispute model the
 * Super Admin has its own area and no admin-route access, so it is excluded.
 */
export const ADMIN_ROLES = ['admin', 'comp_admin', 'dispute_admin', 'revenue_admin'];
export const SUPER_ADMIN_ROLES = ['super-admin'];
export const TEAM_LEAD_ROLES = ['team_lead'];

const route = (path, label, group, roles = null) => ({ path, label, group, roles });

export const PUBLIC_ROUTES = [
  route('/', 'Home', 'public'),
  route('/pages/about.html', 'About', 'public'),
  route('/pages/login.html', 'Log in', 'public'),
  route('/pages/signup.html', 'Sign up', 'public'),
  route('/pages/competitions.html', 'Competitions', 'public'),
  route('/pages/competition-detail.html', 'Competition detail', 'public'),
  route('/pages/comp-info.html', 'Competition info', 'public'),
  route('/pages/view-team.html', 'View team', 'public'),
  route('/pages/watch-live.html', 'Watch live', 'public'),
];

export const PROTECTED_ROUTES = [
 // Participant
  route('/pages/my-activity.html', 'My activity', 'participant'),
  route('/pages/profile.html', 'Profile', 'participant'),
  route('/pages/notifications.html', 'Notifications', 'participant'),
  route('/pages/competitions-participated.html', 'Competitions participated', 'participant'),
  route('/pages/create-team.html', 'Create team', 'participant'),
  route('/pages/join-teams.html', 'Join teams', 'participant'),
  route('/pages/team/team-roster.html', 'Team roster', 'participant'),
  route('/pages/team/add-players.html', 'Add players', 'participant'),
  route('/pages/team/invite-player.html', 'Invite player', 'participant'),
  route('/pages/team/invitations-sent.html', 'Invitations sent', 'participant'),
  route('/pages/team/join-requests.html', 'Join requests', 'participant'),
  route('/pages/team/team-settings.html', 'Team settings', 'participant'),

 // Team lead
  route('/pages/team-lead-dashboard.html', 'Team lead dashboard', 'team-lead', TEAM_LEAD_ROLES),

 // Organizer
  route('/pages/create-competition.html', 'Create competition', 'organizer'),
  route('/pages/edit-competition.html', 'Edit competition', 'organizer'),
  route('/pages/organizer-revenue.html', 'Organizer revenue', 'organizer'),
  route('/pages/comp-manage-teams.html', 'Manage teams', 'organizer'),
  route('/pages/comp-manage-matches.html', 'Manage matches', 'organizer'),
  route('/pages/comp-manage-organizers.html', 'Manage organizers', 'organizer'),
  route('/pages/comp-participant.html', 'Participant view', 'organizer'),
  route('/pages/comp-match-results.html', 'Match results', 'organizer'),
  route('/pages/comp-standings.html', 'Standings', 'organizer'),
  route('/pages/comp-reports.html', 'Reports', 'organizer'),
  route('/pages/comp-dispute-review.html', 'Dispute review', 'organizer'),

 // Disputes
  route('/pages/disputes.html', 'Disputes', 'disputes'),
  route('/pages/submit-report.html', 'Submit report', 'disputes'),
  route('/pages/dispute-escalation.html', 'Escalate dispute', 'disputes'),

 // Admin
  route('/pages/admin/dashboard.html', 'Admin dashboard', 'admin', ADMIN_ROLES),
  route('/pages/admin/users.html', 'Users', 'admin', ADMIN_ROLES),
  route('/pages/admin/disputes.html', 'Disputes', 'admin', ADMIN_ROLES),
  route('/pages/admin/dispute-review.html', 'Dispute review', 'admin', ADMIN_ROLES),
  route('/pages/admin/dispute-review2.html', 'Dispute review (2)', 'admin', ADMIN_ROLES),
  route('/pages/admin/manage-competition.html', 'Manage competition', 'admin', ADMIN_ROLES),
  route('/pages/admin/manage-teams.html', 'Manage teams', 'admin', ADMIN_ROLES),
  route('/pages/admin/manage-teams2.html', 'Manage teams (2)', 'admin', ADMIN_ROLES),
  route('/pages/admin/manage-matches.html', 'Manage matches', 'admin', ADMIN_ROLES),
  route('/pages/admin/manage-matches2.html', 'Manage matches (2)', 'admin', ADMIN_ROLES),
  route('/pages/admin/match-results.html', 'Match results', 'admin', ADMIN_ROLES),
  route('/pages/admin/match-results2.html', 'Match results (2)', 'admin', ADMIN_ROLES),
  route('/pages/admin/view-standings.html', 'View standings', 'admin', ADMIN_ROLES),
  route('/pages/admin/edit-competition.html', 'Edit competition', 'admin', ADMIN_ROLES),
  route('/pages/admin/edit-competition2.html', 'Edit competition (2)', 'admin', ADMIN_ROLES),
  route('/pages/admin/competition-detail.html', 'Competition detail', 'admin', ADMIN_ROLES),
  route('/pages/admin/competition-detail2.html', 'Competition detail (2)', 'admin', ADMIN_ROLES),
  route('/pages/admin/admin-activity.html', 'Admin activity', 'admin', ADMIN_ROLES),
  route('/pages/admin/admin-profile.html', 'Admin profile', 'admin', ADMIN_ROLES),
  route('/pages/admin/revenue-config.html', 'Revenue config', 'admin', ADMIN_ROLES),
  route('/pages/admin/revenue-transactions.html', 'Revenue transactions', 'admin', ADMIN_ROLES),

 // Super admin
  route('/pages/super-admin/super-dashboard.html', 'Super admin dashboard', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/users.html', 'Users', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/admins.html', 'Admins', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/add-admin.html', 'Add admin', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/revoke-admin.html', 'Revoke admin', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/policy-management.html', 'Policy management', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/create-policy.html', 'Create policy', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/edit-policy.html', 'Edit policy', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/view-policy.html', 'View policy', 'super-admin', SUPER_ADMIN_ROLES),
  route('/pages/super-admin/profile.html', 'Profile', 'super-admin', SUPER_ADMIN_ROLES),
];

export const ROUTES = [...PUBLIC_ROUTES, ...PROTECTED_ROUTES];

export default ROUTES;


