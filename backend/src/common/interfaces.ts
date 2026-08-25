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
  teamId: string;
  reportedBy: string;
  organizers?: string[];
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  resolutionNotes?: string;
  resolvedBy?: string;
  createdAt: Date;
}
