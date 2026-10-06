import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Group 2: Player & Competition Discovery
import CompetitionsPage from './pages/CompetitionsPage';
import CompetitionDetailPage from './pages/CompetitionDetailPage';
import CompInfoPage from './pages/CompInfoPage';
import CompParticipantPage from './pages/CompParticipantPage';
import JoinTeamsPage from './pages/JoinTeamsPage';
import CreateCompetitionPage from './pages/CreateCompetitionPage';
import EditCompetitionPage from './pages/EditCompetitionPage';

// Group 3: Team Management & Roster
import CreateTeamPage from './pages/CreateTeamPage';
import TeamRosterPage from './pages/team/TeamRosterPage';
import TeamFindPlayersPage from './pages/team/TeamFindPlayersPage';
import TeamInvitesPage from './pages/team/TeamInvitesPage';
import TeamJoinRequestsPage from './pages/team/TeamJoinRequestsPage';
import TeamSettingsPage from './pages/team/TeamSettingsPage';

// Group 4: Competition Management & Organizer
import CompManageTeamsPage from './pages/CompManageTeamsPage';
import CompManageMatchesPage from './pages/CompManageMatchesPage';
import CompMatchResultsPage from './pages/CompMatchResultsPage';
import CompStandingsPage from './pages/CompStandingsPage';
import CompManageOrganizersPage from './pages/CompManageOrganizersPage';
import CompDisputeReviewPage from './pages/CompDisputeReviewPage';
import OrganizerRevenuePage from './pages/OrganizerRevenuePage';

// Group 5: User Activity, Team Lead & Public Views
import ProfilePage from './pages/ProfilePage';
import MyActivityPage from './pages/MyActivityPage';
import NotificationsPage from './pages/NotificationsPage';
import CompetitionsParticipatedPage from './pages/CompetitionsParticipatedPage';
import TeamLeadDashboardPage from './pages/TeamLeadDashboardPage';
import ViewTeamPage from './pages/ViewTeamPage';
import WatchLivePage from './pages/WatchLivePage';
import SubmitReportPage from './pages/SubmitReportPage';
import DisputesPage from './pages/DisputesPage';

// Group 6: Admin & Super Admin Sections
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminActivityPage from './pages/admin/AdminActivityPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import AdminDisputesPage from './pages/admin/AdminDisputesPage';
import AdminDisputeReviewPage from './pages/admin/AdminDisputeReviewPage';
import AdminRevenueTransactionsPage from './pages/admin/AdminRevenueTransactionsPage';
import AdminRevenueConfigPage from './pages/admin/AdminRevenueConfigPage';
import AdminCompDetailPage from './pages/admin/AdminCompDetailPage';
import AdminManageTeamsPage from './pages/admin/AdminManageTeamsPage';
import AdminManageMatchesPage from './pages/admin/AdminManageMatchesPage';
import AdminMatchResultsPage from './pages/admin/AdminMatchResultsPage';
import AdminViewStandingsPage from './pages/admin/AdminViewStandingsPage';
import AdminEditCompPage from './pages/admin/AdminEditCompPage';

import SuperDashboardPage from './pages/super-admin/SuperDashboardPage';
import SuperAdminUsersPage from './pages/super-admin/SuperAdminUsersPage';
import SuperAdminAdminsPage from './pages/super-admin/SuperAdminAdminsPage';
import SuperAdminAddAdminPage from './pages/super-admin/SuperAdminAddAdminPage';
import SuperAdminRevokeAdminPage from './pages/super-admin/SuperAdminRevokeAdminPage';
import SuperAdminPolicyManagementPage from './pages/super-admin/SuperAdminPolicyManagementPage';
import SuperAdminCreatePolicyPage from './pages/super-admin/SuperAdminCreatePolicyPage';
import SuperAdminEditPolicyPage from './pages/super-admin/SuperAdminEditPolicyPage';
import SuperAdminViewPolicyPage from './pages/super-admin/SuperAdminViewPolicyPage';
import SuperAdminProfilePage from './pages/super-admin/SuperAdminProfilePage';

// Helper component to preserve query params during redirect
function RedirectWithSearch({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/index.html" element={<RedirectWithSearch to="/" />} />
        
        {/* Public & Auth Routes (Group 1) */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pages/about.html" element={<RedirectWithSearch to="/about" />} />
        
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pages/login.html" element={<RedirectWithSearch to="/login" />} />

        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pages/signup.html" element={<RedirectWithSearch to="/signup" />} />

        {/* Player & Competition Discovery (Group 2) */}
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/pages/competitions.html" element={<RedirectWithSearch to="/competitions" />} />

        <Route path="/competition-detail" element={<CompetitionDetailPage />} />
        <Route path="/pages/competition-detail.html" element={<RedirectWithSearch to="/competition-detail" />} />

        <Route path="/comp-info" element={<CompInfoPage />} />
        <Route path="/pages/comp-info.html" element={<RedirectWithSearch to="/comp-info" />} />

        <Route path="/comp-participant" element={<CompParticipantPage />} />
        <Route path="/pages/comp-participant.html" element={<RedirectWithSearch to="/comp-participant" />} />

        <Route path="/join-teams" element={<JoinTeamsPage />} />
        <Route path="/pages/join-teams.html" element={<RedirectWithSearch to="/join-teams" />} />

        <Route path="/create-competition" element={<CreateCompetitionPage />} />
        <Route path="/pages/create-competition.html" element={<RedirectWithSearch to="/create-competition" />} />

        <Route path="/edit-competition" element={<EditCompetitionPage />} />
        <Route path="/pages/edit-competition.html" element={<RedirectWithSearch to="/edit-competition" />} />

        {/* Team Management & Roster (Group 3) */}
        <Route path="/create-team" element={<CreateTeamPage />} />
        <Route path="/pages/create-team.html" element={<RedirectWithSearch to="/create-team" />} />

        <Route path="/team/team-roster" element={<TeamRosterPage />} />
        <Route path="/pages/team/team-roster.html" element={<RedirectWithSearch to="/team/team-roster" />} />

        <Route path="/team/add-players" element={<TeamFindPlayersPage />} />
        <Route path="/pages/team/add-players.html" element={<RedirectWithSearch to="/team/add-players" />} />
        <Route path="/team/team-find-players" element={<TeamFindPlayersPage />} />
        <Route path="/pages/team/team-find-players.html" element={<RedirectWithSearch to="/team/add-players" />} />

        <Route path="/team/invitations-sent" element={<TeamInvitesPage />} />
        <Route path="/pages/team/invitations-sent.html" element={<RedirectWithSearch to="/team/invitations-sent" />} />

        <Route path="/team/join-requests" element={<TeamJoinRequestsPage />} />
        <Route path="/pages/team/join-requests.html" element={<RedirectWithSearch to="/team/join-requests" />} />

        <Route path="/team/team-settings" element={<TeamSettingsPage />} />
        <Route path="/pages/team/team-settings.html" element={<RedirectWithSearch to="/team/team-settings" />} />

        {/* Competition Management & Organizer (Group 4) */}
        <Route path="/comp-manage-teams" element={<CompManageTeamsPage />} />
        <Route path="/pages/comp-manage-teams.html" element={<RedirectWithSearch to="/comp-manage-teams" />} />

        <Route path="/comp-manage-matches" element={<CompManageMatchesPage />} />
        <Route path="/pages/comp-manage-matches.html" element={<RedirectWithSearch to="/comp-manage-matches" />} />

        <Route path="/comp-match-results" element={<CompMatchResultsPage />} />
        <Route path="/pages/comp-match-results.html" element={<RedirectWithSearch to="/comp-match-results" />} />

        <Route path="/comp-standings" element={<CompStandingsPage />} />
        <Route path="/pages/comp-standings.html" element={<RedirectWithSearch to="/comp-standings" />} />

        <Route path="/comp-manage-organizers" element={<CompManageOrganizersPage />} />
        <Route path="/pages/comp-manage-organizers.html" element={<RedirectWithSearch to="/comp-manage-organizers" />} />

        <Route path="/comp-dispute-review" element={<CompDisputeReviewPage />} />
        <Route path="/pages/comp-dispute-review.html" element={<RedirectWithSearch to="/comp-dispute-review" />} />

        <Route path="/organizer-revenue" element={<OrganizerRevenuePage />} />
        <Route path="/pages/organizer-revenue.html" element={<RedirectWithSearch to="/organizer-revenue" />} />

        {/* User Activity, Team Lead & Public Views (Group 5) */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/pages/profile.html" element={<RedirectWithSearch to="/profile" />} />

        <Route path="/my-activity" element={<MyActivityPage />} />
        <Route path="/pages/my-activity.html" element={<RedirectWithSearch to="/my-activity" />} />

        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/pages/notifications.html" element={<RedirectWithSearch to="/notifications" />} />

        <Route path="/competitions-participated" element={<CompetitionsParticipatedPage />} />
        <Route path="/pages/competitions-participated.html" element={<RedirectWithSearch to="/competitions-participated" />} />

        <Route path="/team-lead-dashboard" element={<TeamLeadDashboardPage />} />
        <Route path="/pages/team-lead-dashboard.html" element={<RedirectWithSearch to="/team-lead-dashboard" />} />

        <Route path="/view-team" element={<ViewTeamPage />} />
        <Route path="/pages/view-team.html" element={<RedirectWithSearch to="/view-team" />} />

        <Route path="/watch-live" element={<WatchLivePage />} />
        <Route path="/pages/watch-live.html" element={<RedirectWithSearch to="/watch-live" />} />

        <Route path="/submit-report" element={<SubmitReportPage />} />
        <Route path="/pages/submit-report.html" element={<RedirectWithSearch to="/submit-report" />} />

        <Route path="/disputes" element={<DisputesPage />} />
        <Route path="/pages/disputes.html" element={<RedirectWithSearch to="/disputes" />} />

        {/* Admin & Super Admin Sections (Group 6) */}
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/pages/admin/dashboard.html" element={<RedirectWithSearch to="/admin/dashboard" />} />

        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/pages/admin/users.html" element={<RedirectWithSearch to="/admin/users" />} />

        <Route path="/admin/admin-activity" element={<AdminActivityPage />} />
        <Route path="/pages/admin/admin-activity.html" element={<RedirectWithSearch to="/admin/admin-activity" />} />

        <Route path="/admin/admin-profile" element={<AdminProfilePage />} />
        <Route path="/pages/admin/admin-profile.html" element={<RedirectWithSearch to="/admin/admin-profile" />} />

        <Route path="/admin/disputes" element={<AdminDisputesPage />} />
        <Route path="/pages/admin/disputes.html" element={<RedirectWithSearch to="/admin/disputes" />} />

        <Route path="/admin/dispute-review" element={<AdminDisputeReviewPage />} />
        <Route path="/pages/admin/dispute-review.html" element={<RedirectWithSearch to="/admin/dispute-review" />} />

        <Route path="/admin/revenue-transactions" element={<AdminRevenueTransactionsPage />} />
        <Route path="/pages/admin/revenue-transactions.html" element={<RedirectWithSearch to="/admin/revenue-transactions" />} />

        <Route path="/admin/revenue-config" element={<AdminRevenueConfigPage />} />
        <Route path="/pages/admin/revenue-config.html" element={<RedirectWithSearch to="/admin/revenue-config" />} />

        <Route path="/admin/competition-detail" element={<AdminCompDetailPage />} />
        <Route path="/pages/admin/competition-detail.html" element={<RedirectWithSearch to="/admin/competition-detail" />} />

        <Route path="/admin/manage-teams" element={<AdminManageTeamsPage />} />
        <Route path="/pages/admin/manage-teams.html" element={<RedirectWithSearch to="/admin/manage-teams" />} />

        <Route path="/admin/manage-matches" element={<AdminManageMatchesPage />} />
        <Route path="/pages/admin/manage-matches.html" element={<RedirectWithSearch to="/admin/manage-matches" />} />

        <Route path="/admin/match-results" element={<AdminMatchResultsPage />} />
        <Route path="/pages/admin/match-results.html" element={<RedirectWithSearch to="/admin/match-results" />} />

        <Route path="/admin/view-standings" element={<AdminViewStandingsPage />} />
        <Route path="/pages/admin/view-standings.html" element={<RedirectWithSearch to="/admin/view-standings" />} />

        <Route path="/admin/edit-competition" element={<AdminEditCompPage />} />
        <Route path="/pages/admin/edit-competition.html" element={<RedirectWithSearch to="/admin/edit-competition" />} />

        {/* Super Admin Routes */}
        <Route path="/super-dashboard" element={<SuperDashboardPage />} />
        <Route path="/pages/super-admin/super-dashboard.html" element={<RedirectWithSearch to="/super-dashboard" />} />

        <Route path="/super-admin/users" element={<SuperAdminUsersPage />} />
        <Route path="/pages/super-admin/users.html" element={<RedirectWithSearch to="/super-admin/users" />} />

        <Route path="/super-admin/admins" element={<SuperAdminAdminsPage />} />
        <Route path="/pages/super-admin/admins.html" element={<RedirectWithSearch to="/super-admin/admins" />} />

        <Route path="/super-admin/add-admin" element={<SuperAdminAddAdminPage />} />
        <Route path="/pages/super-admin/add-admin.html" element={<RedirectWithSearch to="/super-admin/add-admin" />} />

        <Route path="/super-admin/revoke-admin" element={<SuperAdminRevokeAdminPage />} />
        <Route path="/pages/super-admin/revoke-admin.html" element={<RedirectWithSearch to="/super-admin/revoke-admin" />} />

        <Route path="/super-admin/policy-management" element={<SuperAdminPolicyManagementPage />} />
        <Route path="/pages/super-admin/policy-management.html" element={<RedirectWithSearch to="/super-admin/policy-management" />} />

        <Route path="/super-admin/create-policy" element={<SuperAdminCreatePolicyPage />} />
        <Route path="/pages/super-admin/create-policy.html" element={<RedirectWithSearch to="/super-admin/create-policy" />} />

        <Route path="/super-admin/edit-policy" element={<SuperAdminEditPolicyPage />} />
        <Route path="/pages/super-admin/edit-policy.html" element={<RedirectWithSearch to="/super-admin/edit-policy" />} />

        <Route path="/super-admin/view-policy" element={<SuperAdminViewPolicyPage />} />
        <Route path="/pages/super-admin/view-policy.html" element={<RedirectWithSearch to="/super-admin/view-policy" />} />

        <Route path="/super-admin/profile" element={<SuperAdminProfilePage />} />
        <Route path="/pages/super-admin/profile.html" element={<RedirectWithSearch to="/super-admin/profile" />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
