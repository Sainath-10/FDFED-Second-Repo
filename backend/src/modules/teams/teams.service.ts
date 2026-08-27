import { Injectable, NotFoundException } from '@nestjs/common';
import { TeamRepository } from './repositories/team.repository';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto';
import { ITeam } from '../../common/interfaces';

@Injectable()
export class TeamsService {
  constructor(private teamRepository: TeamRepository) {}

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

  async updateJoinRequest(id: string, status: string, reviewedBy: string) {
    return this.teamRepository.updateJoinRequest(id, status, reviewedBy);
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
