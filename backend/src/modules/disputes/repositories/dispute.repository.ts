import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisputeEntity } from '../../../entities/dispute.entity';
import { DisputeStatus, DisputeTargetType } from '../../../common/interfaces';

@Injectable()
export class DisputeRepository {
  constructor(
    @InjectRepository(DisputeEntity)
    private readonly repo: Repository<DisputeEntity>,
  ) {}

  async create(data: {
    competitionId: string;
    matchId?: string;
    teamId?: string;
    reportedBy: string;
    organizers: string[];
    targetType: DisputeTargetType;
    targetUserOrTeam?: string;
    reason: string;
    evidenceUrls?: string[];
    status: DisputeStatus;
  }): Promise<DisputeEntity> {
    const dispute = this.repo.create({
      ...data,
      evidenceUrls: data.evidenceUrls || [],
      banRequested: false,
      banApplied: false,
    });
    return this.repo.save(dispute);
  }

  async findById(id: string): Promise<DisputeEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAll(): Promise<DisputeEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findByCompetition(competitionId: string): Promise<DisputeEntity[]> {
    return this.repo.find({ where: { competitionId }, order: { createdAt: 'DESC' } });
  }

  async findByTeam(teamId: string): Promise<DisputeEntity[]> {
    return this.repo.find({ where: { teamId }, order: { createdAt: 'DESC' } });
  }

  async findOrganizerQueue(): Promise<DisputeEntity[]> {
    return this.repo
      .createQueryBuilder('d')
      .where('d.status IN (:...statuses)', {
        statuses: [DisputeStatus.OPEN_ORGANIZER, DisputeStatus.UNDER_REVIEW],
      })
      .orderBy('d.createdAt', 'DESC')
      .getMany();
  }

  async findAdminQueue(): Promise<DisputeEntity[]> {
    return this.repo
      .createQueryBuilder('d')
      .where('d.status IN (:...statuses)', {
        statuses: [DisputeStatus.OPEN_ADMIN, DisputeStatus.ESCALATED_TO_ADMIN],
      })
      .andWhere('d.targetType != :teamTarget', { teamTarget: DisputeTargetType.OPPONENT_TEAM })
      .orderBy('d.createdAt', 'DESC')
      .getMany();
  }

  async findByStatus(status: DisputeStatus): Promise<DisputeEntity[]> {
    return this.repo.find({ where: { status }, order: { createdAt: 'DESC' } });
  }

  async findByOrganizer(organizerId: string): Promise<DisputeEntity[]> {
    return this.repo
      .createQueryBuilder('d')
      .where("d.organizers LIKE :pat", { pat: `%${organizerId}%` })
      .orderBy('d.createdAt', 'DESC')
      .getMany();
  }

  async update(id: string, updates: Partial<DisputeEntity>): Promise<DisputeEntity> {
    const dispute = await this.repo.findOne({ where: { id } });
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);

    const { id: _id, competitionId: _ci, reportedBy: _rb, createdAt: _ca, ...safeUpdates } = updates as any;
    await this.repo.update(id, safeUpdates);
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  async countByStatus(status: DisputeStatus): Promise<number> {
    return this.repo.count({ where: { status } });
  }
}
