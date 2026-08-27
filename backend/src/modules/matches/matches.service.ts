import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchEntity } from '../../entities/match.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly repo: Repository<MatchEntity>,
  ) {}

  async create(data: {
    competitionId: string;
    team1Id?: string;
    team2Id?: string;
    team1Name?: string;
    team2Name?: string;
    scheduledAt?: Date;
    round?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<MatchEntity> {
    const match = this.repo.create({ ...data, status: 'scheduled' });
    return this.repo.save(match);
  }

  async findByCompetition(competitionId: string): Promise<MatchEntity[]> {
    return this.repo.find({ where: { competitionId }, order: { scheduledAt: 'ASC' } });
  }

  async findById(id: string): Promise<MatchEntity> {
    const match = await this.repo.findOne({ where: { id } });
    if (!match) throw new NotFoundException(`Match ${id} not found`);
    return match;
  }

  async update(id: string, updates: Partial<MatchEntity>): Promise<MatchEntity> {
    const { id: _id, competitionId: _ci, createdAt: _ca, ...safeUpdates } = updates as any;
    await this.repo.update(id, safeUpdates);
    return this.findById(id);
  }

  async recordResult(id: string, winnerId: string, winnerName: string, score: string): Promise<MatchEntity> {
    await this.repo.update(id, { winnerId, winnerName, score, status: 'completed' });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async deleteByCompetition(competitionId: string): Promise<void> {
    await this.repo.delete({ competitionId });
  }
}
