/**
 * NEXUS ESPORTS — page registry
 *
 * Maps a route path to its ported page component. App.jsx renders the mapped
 * component when present, otherwise falls back to RoutePlaceholder. New pages
 * are registered here as the later phases port them.
 */
import Login from './auth/Login.jsx';
import Signup from './auth/Signup.jsx';
import Competitions from './Competitions.jsx';
import CompetitionsParticipated from './CompetitionsParticipated.jsx';
import ViewTeam from './ViewTeam.jsx';
import WatchLive from './WatchLive.jsx';
import About from './About.jsx';
import Index from './Index.jsx';
import CompInfo from './CompInfo.jsx';
import CompetitionDetail from './CompetitionDetail.jsx';
import Notifications from './Notifications.jsx';
import CreateTeam from './CreateTeam.jsx';
import JoinTeams from './JoinTeams.jsx';
import TeamRoster from './team/TeamRoster.jsx';
import AddPlayers from './team/AddPlayers.jsx';
import InvitePlayer from './team/InvitePlayer.jsx';
import InvitationsSent from './team/InvitationsSent.jsx';
import JoinRequests from './team/JoinRequests.jsx';
import TeamSettings from './team/TeamSettings.jsx';
import Profile from './Profile.jsx';
import MyActivity from './MyActivity.jsx';
import CompStandings from './CompStandings.jsx';
import CompReports from './CompReports.jsx';
import CompManageTeams from './CompManageTeams.jsx';
import CompManageMatches from './CompManageMatches.jsx';
import CompMatchResults from './CompMatchResults.jsx';
import CompDisputeReview from './CompDisputeReview.jsx';
import CompParticipant from './CompParticipant.jsx';
import CompManageOrganizers from './CompManageOrganizers.jsx';
import OrganizerRevenue from './OrganizerRevenue.jsx';
import CreateCompetition from './CreateCompetition.jsx';
import EditCompetition from './EditCompetition.jsx';
import Disputes from './Disputes.jsx';
import SubmitReport from './SubmitReport.jsx';
import DisputeEscalation from './DisputeEscalation.jsx';
import AdminCompetitionDetail2 from './AdminCompetitionDetail2.jsx';
import AdminManageMatches2 from './AdminManageMatches2.jsx';
import AdminManageTeams2 from './AdminManageTeams2.jsx';
import AdminMatchResults2 from './AdminMatchResults2.jsx';
import AdminDisputeReview2 from './AdminDisputeReview2.jsx';
import AdminEditCompetition2 from './AdminEditCompetition2.jsx';
import AdminDisputeReview from './AdminDisputeReview.jsx';
import AdminMatchResults from './AdminMatchResults.jsx';
import AdminViewStandings from './AdminViewStandings.jsx';
import AdminUsers from './AdminUsers.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AdminActivity from './AdminActivity.jsx';
import AdminCompetitionDetail from './AdminCompetitionDetail.jsx';
import AdminManageTeams from './AdminManageTeams.jsx';
import AdminManageMatches from './AdminManageMatches.jsx';
import AdminEditCompetition from './AdminEditCompetition.jsx';
import AdminProfile from './AdminProfile.jsx';
import AdminRevenueConfig from './AdminRevenueConfig.jsx';
import AdminDisputes from './AdminDisputes.jsx';
import AdminRevenueTransactions from './AdminRevenueTransactions.jsx';
import AdminManageCompetition from './AdminManageCompetition.jsx';
import Admins from './Admins.jsx';
import AddAdmin from './AddAdmin.jsx';
import RevokeAdmin from './RevokeAdmin.jsx';
import SuperDashboard from './SuperDashboard.jsx';
import SuperUsers from './SuperUsers.jsx';
import PolicyManagement from './PolicyManagement.jsx';
import CreatePolicy from './CreatePolicy.jsx';
import EditPolicy from './EditPolicy.jsx';
import ViewPolicy from './ViewPolicy.jsx';
import SuperProfile from './SuperProfile.jsx';
import TeamLeadDashboard from './TeamLeadDashboard.jsx';

export const PAGE_COMPONENTS = {
  '/': Index,
  '/pages/team-lead-dashboard.html': TeamLeadDashboard,
  '/pages/admin/admin-profile.html': AdminProfile,
  '/pages/super-admin/profile.html': SuperProfile,
  '/pages/super-admin/create-policy.html': CreatePolicy,
  '/pages/super-admin/edit-policy.html': EditPolicy,
  '/pages/super-admin/view-policy.html': ViewPolicy,
  '/pages/super-admin/policy-management.html': PolicyManagement,
  '/pages/super-admin/super-dashboard.html': SuperDashboard,
  '/pages/super-admin/users.html': SuperUsers,
  '/pages/super-admin/admins.html': Admins,
  '/pages/super-admin/add-admin.html': AddAdmin,
  '/pages/super-admin/revoke-admin.html': RevokeAdmin,
  '/pages/admin/manage-competition.html': AdminManageCompetition,
  '/pages/admin/revenue-transactions.html': AdminRevenueTransactions,
  '/pages/admin/disputes.html': AdminDisputes,
  '/pages/admin/revenue-config.html': AdminRevenueConfig,
  '/pages/admin/competition-detail.html': AdminCompetitionDetail,
  '/pages/admin/manage-teams.html': AdminManageTeams,
  '/pages/admin/manage-matches.html': AdminManageMatches,
  '/pages/admin/edit-competition.html': AdminEditCompetition,
  '/pages/admin/dashboard.html': AdminDashboard,
  '/pages/admin/admin-activity.html': AdminActivity,
  '/pages/admin/users.html': AdminUsers,
  '/pages/admin/dispute-review.html': AdminDisputeReview,
  '/pages/admin/match-results.html': AdminMatchResults,
  '/pages/admin/view-standings.html': AdminViewStandings,
  '/pages/admin/competition-detail2.html': AdminCompetitionDetail2,
  '/pages/admin/manage-matches2.html': AdminManageMatches2,
  '/pages/admin/manage-teams2.html': AdminManageTeams2,
  '/pages/admin/match-results2.html': AdminMatchResults2,
  '/pages/admin/dispute-review2.html': AdminDisputeReview2,
  '/pages/admin/edit-competition2.html': AdminEditCompetition2,
  '/pages/create-competition.html': CreateCompetition,
  '/pages/edit-competition.html': EditCompetition,
  '/pages/disputes.html': Disputes,
  '/pages/submit-report.html': SubmitReport,
  '/pages/dispute-escalation.html': DisputeEscalation,
  '/pages/comp-participant.html': CompParticipant,
  '/pages/comp-manage-organizers.html': CompManageOrganizers,
  '/pages/organizer-revenue.html': OrganizerRevenue,
  '/pages/comp-manage-teams.html': CompManageTeams,
  '/pages/comp-manage-matches.html': CompManageMatches,
  '/pages/comp-match-results.html': CompMatchResults,
  '/pages/comp-dispute-review.html': CompDisputeReview,
  '/pages/profile.html': Profile,
  '/pages/my-activity.html': MyActivity,
  '/pages/comp-standings.html': CompStandings,
  '/pages/comp-reports.html': CompReports,
  '/pages/comp-info.html': CompInfo,
  '/pages/competition-detail.html': CompetitionDetail,
  '/pages/notifications.html': Notifications,
  '/pages/create-team.html': CreateTeam,
  '/pages/join-teams.html': JoinTeams,
  '/pages/team/team-roster.html': TeamRoster,
  '/pages/team/add-players.html': AddPlayers,
  '/pages/team/invite-player.html': InvitePlayer,
  '/pages/team/invitations-sent.html': InvitationsSent,
  '/pages/team/join-requests.html': JoinRequests,
  '/pages/team/team-settings.html': TeamSettings,
  '/pages/login.html': Login,
  '/pages/signup.html': Signup,
  '/pages/competitions.html': Competitions,
  '/pages/competitions-participated.html': CompetitionsParticipated,
  '/pages/view-team.html': ViewTeam,
  '/pages/watch-live.html': WatchLive,
  '/pages/about.html': About,
};


