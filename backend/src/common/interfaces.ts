export enum UserRole {
  FINANCE_MODERATOR = 'finance_moderator',
  /** Platform administrator: competition, dispute and revenue operations. */
  SUPER_ADMIN = 'super_admin',
  TEAM_LEAD = 'team_lead',
  PARTICIPANT = 'participant',
  /** Handles reports against organisers only (separate dashboard). */
  COMMUNITY_MODERATOR = 'community_moderator',
}

/**
 * Retired staff roles (the generic Admin role and the Dispute, Competition and
 * Revenue Admin roles it replaced). They can no longer be assigned, and an
 * account still carrying one can neither log in nor use an existing token.
 */
export const RETIRED_STAFF_ROLES: readonly string[] = ['admin', 'comp_admin', 'competition_admin', 'dispute_admin', 'revenue_admin'];

export const hasRetiredStaffRole = (user: { role?: string | null; adminType?: string | null } | null | undefined) =>
  !!user && [user.role, user.adminType].some((value) => RETIRED_STAFF_ROLES.includes(String(value || '').trim().toLowerCase()));

export enum DisputeStatus {
  OPEN_ORGANIZER = 'open_organizer',
  OPEN_ADMIN = 'open_admin',
  UNDER_REVIEW = 'under_review',
  ESCALATED_TO_ADMIN = 'escalated_to_admin',
  RESOLVED = 'resolved',
}

export enum DisputeTargetType {
  OPPONENT_TEAM = 'opponent_team',
  MATCH_RULE = 'match_rule',
  ORGANIZER = 'organizer',
}

export interface IUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  adminType?: string;
  revokedReason?: string;
  banned?: boolean;
  createdAt: Date;
}

export interface ICompetition {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: string;
  createdBy: string;
  organizers: string[];
  game?: string;
  type?: string;
  location?: string;
  prizePool?: string;
  prize?: number;
  format?: string;
  season?: string;
  maxTeams?: number;
  maxPlayersPerTeam?: number;
  img?: string;
  badge?: string;
  badgeClass?: string;
  platformFee?: number;
  feeType?: string;
  entryFeeAmount?: number;
  entryFee?: string;
  organizerPaid?: boolean;
  approvalStatus?: string;
  approvalUpdatedBy?: string;
  approvalUpdatedAt?: Date;
  createdAt: Date;
}

export interface ITeam {
  id: string;
  name: string;
  competitionId: string;
  leaderId: string;
  members?: string[];
  memberUsernames?: string[];
  status?: string;
  statusUpdatedBy?: string;
  statusUpdatedAt?: Date;
  warningsCount?: number;
  createdBy?: string;
  createdAt: Date;
}

export interface IDispute {
  id: string;
  competitionId: string;
  matchId?: string;
  teamId?: string;
  reportedBy: string;
  targetType: DisputeTargetType;
  targetUserOrTeam?: string;
  reason: string;
  evidenceUrls?: string[];
  organizers: string[];
  status: DisputeStatus;
  organizerNotes?: string;
  adminNotes?: string;
  resolvedBy?: string;
  banRequested?: boolean;
  banApplied?: boolean;
  organizerWarnings?: number;
  teamBanned?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
