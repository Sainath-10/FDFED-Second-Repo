import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamEntity } from '../../../entities/team.entity';
import { TeamJoinRequestEntity } from '../../../entities/team-join-request.entity';
import { TeamInviteEntity } from '../../../entities/team-invite.entity';

@Injectable()
export class TeamRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repo: Repository<TeamEntity>,
    @InjectRepository(TeamJoinRequestEntity)
    private readonly joinRepo: Repository<TeamJoinRequestEntity>,
    @InjectRepository(TeamInviteEntity)
    private readonly inviteRepo: Repository<TeamInviteEntity>,
  ) {}

  // ─── Teams ─────────────────────────────────────────────────────────────────

  async create(
    name: string,
    competitionId: string,
    leaderId: string,
    members: string[] = [],
  ): Promise<TeamEntity> {
    const memberSet = new Set([leaderId, ...members]);
    const team = this.repo.create({
      name,
      competitionId,
      leaderId,
      leaderUsername: leaderId,
      createdBy: leaderId,
      memberUsernames: Array.from(memberSet),
      status: 'pending',
      warningsCount: 0,
    });
    return this.repo.save(team);
  }

  async findById(id: string): Promise<TeamEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAll(): Promise<TeamEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findByCompetition(competitionId: string): Promise<TeamEntity[]> {
    return this.repo.find({ where: { competitionId }, order: { createdAt: 'ASC' } });
  }

  async findByLeader(leaderId: string): Promise<TeamEntity[]> {
    return this.repo.find({ where: { leaderId }, order: { createdAt: 'DESC' } });
  }

  async findByCompetitionAndStatus(competitionId: string, status: string): Promise<TeamEntity[]> {
    return this.repo.find({ where: { competitionId, status } });
  }

  async update(id: string, updates: Partial<TeamEntity>): Promise<TeamEntity> {
    const team = await this.repo.findOne({ where: { id } });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    const { id: _id, createdAt: _ca, ...safeUpdates } = updates as any;
    await this.repo.update(id, safeUpdates);
    return this.repo.findOne({ where: { id } });
  }

  async addMember(teamId: string, username: string): Promise<TeamEntity> {
    const team = await this.repo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
    if (team.memberUsernames.includes(username)) {
      throw new BadRequestException('Member already in team');
    }
    const memberUsernames = [...team.memberUsernames, username];
    await this.repo.update(teamId, { memberUsernames });
    return this.repo.findOne({ where: { id: teamId } });
  }

  async removeMember(teamId: string, username: string): Promise<TeamEntity> {
    const team = await this.repo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
    if (team.leaderId === username) {
      throw new BadRequestException('Cannot remove team leader');
    }
    const memberUsernames = team.memberUsernames.filter((m) => m !== username);
    await this.repo.update(teamId, { memberUsernames });
    return this.repo.findOne({ where: { id: teamId } });
  }

  async addWarning(teamId: string, issuedBy: string): Promise<{ warningsCount: number; banned: boolean }> {
    const team = await this.repo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    const newCount = (team.warningsCount || 0) + 1;
    const banned = newCount >= 3;
    const status = banned ? 'banned' : team.status;
    await this.repo.update(teamId, {
      warningsCount: newCount,
      status,
      statusUpdatedBy: issuedBy,
      statusUpdatedAt: new Date(),
    });
    return { warningsCount: newCount, banned };
  }

  async banTeam(teamId: string, issuedBy: string): Promise<TeamEntity> {
    await this.repo.update(teamId, {
      status: 'banned',
      statusUpdatedBy: issuedBy,
      statusUpdatedAt: new Date(),
    });
    return this.repo.findOne({ where: { id: teamId } });
  }

  async setStatus(teamId: string, status: string, issuedBy: string): Promise<TeamEntity> {
    await this.repo.update(teamId, {
      status,
      statusUpdatedBy: issuedBy,
      statusUpdatedAt: new Date(),
    });
    return this.repo.findOne({ where: { id: teamId } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ─── Join Requests ─────────────────────────────────────────────────────────

  async createJoinRequest(teamId: string, competitionId: string, fromUsername: string, message?: string): Promise<TeamJoinRequestEntity> {
    const req = this.joinRepo.create({ teamId, competitionId, fromUsername, message });
    return this.joinRepo.save(req);
  }

  async getJoinRequestsByTeam(teamId: string): Promise<TeamJoinRequestEntity[]> {
    return this.joinRepo.find({ where: { teamId }, order: { createdAt: 'DESC' } });
  }

  async updateJoinRequest(id: string, status: string, reviewedBy: string): Promise<TeamJoinRequestEntity> {
    await this.joinRepo.update(id, { status, reviewedBy });
    return this.joinRepo.findOne({ where: { id } });
  }

  // ─── Invites ───────────────────────────────────────────────────────────────

  async createInvite(teamId: string, competitionId: string, toUsername: string, fromUsername: string): Promise<TeamInviteEntity> {
    const invite = this.inviteRepo.create({ teamId, competitionId, toUsername, fromUsername });
    return this.inviteRepo.save(invite);
  }

  async getInvitesByUser(toUsername: string): Promise<TeamInviteEntity[]> {
    return this.inviteRepo.find({ where: { toUsername }, order: { createdAt: 'DESC' } });
  }

  async updateInvite(id: string, status: string): Promise<TeamInviteEntity> {
    await this.inviteRepo.update(id, { status });
    return this.inviteRepo.findOne({ where: { id } });
  }
}
