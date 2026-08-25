import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ITeam } from '@/common/interfaces';

@Injectable()
export class TeamRepository {
  private teams: Map<string, ITeam> = new Map();
  private competitionTeamsIndex: Map<string, string[]> = new Map();
  private nextId = 1;

  async create(
    name: string,
    competitionId: string,
    members: string[] = [],
  ): Promise<ITeam> {
    const id = String(this.nextId++);

    const team: ITeam = {
      id,
      name,
      competitionId,
      leaderId: 'system',
      members: ['system', ...members],
      createdAt: new Date(),
    };

    this.teams.set(id, team);

    // Update competition index
    if (!this.competitionTeamsIndex.has(competitionId)) {
      this.competitionTeamsIndex.set(competitionId, []);
    }
    this.competitionTeamsIndex.get(competitionId).push(id);

    return team;
  }

  async findById(id: string): Promise<ITeam | null> {
    return this.teams.get(id) || null;
  }

  async findAll(): Promise<ITeam[]> {
    return Array.from(this.teams.values());
  }

  async findByCompetition(competitionId: string): Promise<ITeam[]> {
    const teamIds = this.competitionTeamsIndex.get(competitionId) || [];
    return teamIds
      .map((id) => this.teams.get(id))
      .filter((team) => team !== undefined);
  }

  async findByLeader(leaderId: string): Promise<ITeam[]> {
    return Array.from(this.teams.values()).filter((team) => team.leaderId === leaderId);
  }

  async update(id: string, updates: Partial<ITeam>): Promise<ITeam> {
    const team = this.teams.get(id);
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    const updated: ITeam = {
      ...team,
      ...updates,
      id: team.id,
      competitionId: team.competitionId,
      leaderId: team.leaderId,
      createdAt: team.createdAt,
    };

    this.teams.set(id, updated);
    return updated;
  }

  async addMember(teamId: string, memberId: string): Promise<ITeam> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    if (team.members.includes(memberId)) {
      throw new BadRequestException('Member already in team');
    }

    team.members.push(memberId);
    this.teams.set(teamId, team);
    return team;
  }

  async removeMember(teamId: string, memberId: string): Promise<ITeam> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    if (team.leaderId === memberId) {
      throw new BadRequestException('Cannot remove team leader');
    }

    team.members = team.members.filter((id) => id !== memberId);
    this.teams.set(teamId, team);
    return team;
  }

  async delete(id: string): Promise<boolean> {
    const team = this.teams.get(id);
    if (!team) return false;

    // Remove from competition index
    const competitionTeams = this.competitionTeamsIndex.get(team.competitionId) || [];
    this.competitionTeamsIndex.set(
      team.competitionId,
      competitionTeams.filter((teamId) => teamId !== id),
    );

    return this.teams.delete(id);
  }
}
