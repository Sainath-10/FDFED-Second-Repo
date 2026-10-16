import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TeamRepository } from './repositories/team.repository';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto';
import { ITeam, UserRole } from '../../common/interfaces';

@Injectable()
export class TeamsService {
  constructor(private teamRepository: TeamRepository) {}

  async verifyTeamOwnership(teamId: string, user: any): Promise<ITeam> {
    const team = await this.getTeamById(teamId);
    if (!user) {
      throw new ForbiddenException('User context required');
    }
    const role = user.role;
    if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
      return team;
    }
    const currentUsername = (user.username || user.id || '').toLowerCase();
    const leaderId = (team.leaderId || '').toLowerCase();
    const createdBy = (team.createdBy || '').toLowerCase();
    const leaderUsername = ((team as any).leaderUsername || '').toLowerCase();

    if (currentUsername !== leaderId && currentUsername !== createdBy && currentUsername !== leaderUsername) {
      throw new ForbiddenException('Only the team captain or an administrator can manage this team');
    }
    return team;
  }

  async createTeam(createTeamDto: CreateTeamDto, leaderId: string = 'system'): Promise<ITeam> {
    const { name, competitionId, members } = createTeamDto;

    return this.teamRepository.create(name, competitionId, leaderId, members || []);
  }

  async getTeamById(id: string): Promise<ITeam> {
    const team = await this.teamRepository.findById(id);
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
    return team;
  }

  async getAllTeams(): Promise<ITeam[]> {
    return this.teamRepository.findAll();
  }

  async getTeamsByCompetition(competitionId: string): Promise<ITeam[]> {
    return this.teamRepository.findByCompetition(competitionId);
  }

  async getTeamsByLeader(leaderId: string): Promise<ITeam[]> {
    return this.teamRepository.findByLeader(leaderId);
  }

  async updateTeam(id: string, updateTeamDto: UpdateTeamDto): Promise<ITeam> {
    const updates: Partial<ITeam> = {};

    if (updateTeamDto.name) updates.name = updateTeamDto.name;
    if (updateTeamDto.members) updates.members = updateTeamDto.members;

    return this.teamRepository.update(id, updates);
  }

  async addMember(teamId: string, addTeamMemberDto: AddTeamMemberDto): Promise<ITeam> {
    return this.teamRepository.addMember(teamId, addTeamMemberDto.memberId);
  }

  async removeMember(teamId: string, memberId: string): Promise<ITeam> {
    return this.teamRepository.removeMember(teamId, memberId);
  }

  async deleteTeam(id: string): Promise<void> {
    await this.teamRepository.delete(id);
  }

  async addWarning(teamId: string, issuedBy: string) {
    return this.teamRepository.addWarning(teamId, issuedBy);
  }

  async banTeam(teamId: string, issuedBy: string) {
    return this.teamRepository.banTeam(teamId, issuedBy);
  }

  async setStatus(teamId: string, status: string, issuedBy: string) {
    return this.teamRepository.setStatus(teamId, status, issuedBy);
  }

  async createJoinRequest(teamId: string, competitionId: string, fromUsername: string, message?: string) {
    return this.teamRepository.createJoinRequest(teamId, competitionId, fromUsername, message);
  }

  async getJoinRequestsByTeam(teamId: string) {
    return this.teamRepository.getJoinRequestsByTeam(teamId);
  }

  async updateJoinRequest(id: string, status: string, user: any) {
    const req = await this.teamRepository.findJoinRequestById(id);
    if (!req) {
      throw new NotFoundException(`Join request with ID ${id} not found`);
    }
    await this.verifyTeamOwnership(req.teamId, user);
    const reviewer = user?.username || user?.id || 'captain';
    return this.teamRepository.updateJoinRequest(id, status, reviewer);
  }

  async createInvite(teamId: string, competitionId: string, toUsername: string, fromUsername: string) {
    return this.teamRepository.createInvite(teamId, competitionId, toUsername, fromUsername);
  }

  async getInvitesByUser(toUsername: string) {
    return this.teamRepository.getInvitesByUser(toUsername);
  }

  async updateInvite(id: string, status: string) {
    return this.teamRepository.updateInvite(id, status);
  }
}
