export enum UserRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  TEAM_LEAD = 'team_lead',
  PARTICIPANT = 'participant',
}

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
  firstName: string;
  lastName: string;
  role: UserRole;
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
