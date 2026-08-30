export enum UserRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  TEAM_LEAD = 'team_lead',
  PARTICIPANT = 'participant',
}

export interface IUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
}

export interface ICompetition {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'active' | 'completed';
  createdBy: string;
  organizers: string[];
  createdAt: Date;
}

export interface ITeam {
  id: string;
  name: string;
  competitionId: string;
  leaderId: string;
  members: string[];
  createdAt: Date;
}

export interface IDispute {
  id: string;
  competitionId: string;
  teamId?: string;
  targetType: 'organizer' | 'user';
  targetId?: string;
  reportedBy: string;
  organizers: string[];
  title?: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  resolutionNotes?: string;
  resolvedBy?: string;
  createdAt: Date;
}

/**
 * Revenue: Platform fee calculation
 * platformFee = max(₹50, 7% of prizePool)
 */
export interface ICompetitionFee {
  id: string;
  competitionId: string;
  entryFee: number;
  prizePool: number;
  platformFee: number;
  platformFeePct: number;
  currency: string;
  feePaid: boolean;
  createdAt: Date;
}

export interface ITransaction {
  id: string;
  competitionId?: string;
  teamId?: string;
  type: 'platform_fee' | 'entry_fee' | 'prize_payout';
  amount: number;
  currency: string;
  description?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}
