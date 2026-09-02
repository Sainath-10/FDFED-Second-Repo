import { Injectable, NotFoundException } from '@nestjs/common';
import { TeamRepository } from './repositories/team.repository';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto';
import { ITeam } from '@/common/interfaces';

@Injectable()
export class TeamsService {
  constructor(private teamRepository: TeamRepository) {}

  async createTeam(createTeamDto: CreateTeamDto): Promise<ITeam> {
    const { name, competitionId, members } = createTeamDto;

    return this.teamRepository.create(name, competitionId, members || []);
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
}
