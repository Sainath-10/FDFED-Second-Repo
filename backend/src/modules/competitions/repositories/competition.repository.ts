import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompetitionEntity } from '../../../entities/competition.entity';

@Injectable()
export class CompetitionRepository {
  constructor(
    @InjectRepository(CompetitionEntity)
    private readonly repo: Repository<CompetitionEntity>,
  ) {}

  async create(
    name: string,
    description: string,
    startDate: Date,
    endDate: Date,
    createdBy: string = 'system',
    coOrganizers: string[] = [],
    extras: Partial<CompetitionEntity> = {},
  ): Promise<CompetitionEntity> {
    const organizersSet = new Set([createdBy, ...(coOrganizers || [])]);
    const competition = this.repo.create({
      name,
      description,
      startDate,
      endDate,
      status: 'active',
      createdBy,
      organizers: Array.from(organizersSet),
      approvalStatus: 'approved',
      ...extras,
    });
    return this.repo.save(competition);
  }

  async findById(id: string): Promise<CompetitionEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAll(): Promise<CompetitionEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findByCreator(userId: string): Promise<CompetitionEntity[]> {
    // Use raw query to search inside simple-array organizers column
    return this.repo
      .createQueryBuilder('c')
      .where('c.createdBy = :userId', { userId })
      .orWhere("c.organizers LIKE :pat", { pat: `%${userId}%` })
      .orderBy('c.createdAt', 'DESC')
      .getMany();
  }

  async findByOrganizer(userId: string): Promise<CompetitionEntity[]> {
    return this.findByCreator(userId);
  }

  async findByStatus(status: string): Promise<CompetitionEntity[]> {
    return this.repo.find({ where: { status }, order: { createdAt: 'DESC' } });
  }

  async findByApprovalStatus(approvalStatus: string): Promise<CompetitionEntity[]> {
    return this.repo.find({ where: { approvalStatus }, order: { createdAt: 'DESC' } });
  }

  async addCoOrganizer(id: string, organizerId: string): Promise<CompetitionEntity> {
    const comp = await this.repo.findOne({ where: { id } });
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);

    const organizers = Array.isArray(comp.organizers) ? comp.organizers : [comp.createdBy];
    if (!organizers.includes(organizerId)) {
      organizers.push(organizerId);
    }
    await this.repo.update(id, { organizers });
    return this.repo.findOne({ where: { id } });
  }

  async removeCoOrganizer(id: string, organizerId: string): Promise<CompetitionEntity> {
    const comp = await this.repo.findOne({ where: { id } });
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);

    // Do not remove the primary creator
    if (comp.createdBy === organizerId) return comp;

    const organizers = (comp.organizers || []).filter((o) => o !== organizerId);
    await this.repo.update(id, { organizers });
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, updates: Partial<CompetitionEntity>): Promise<CompetitionEntity> {
    const comp = await this.repo.findOne({ where: { id } });
    if (!comp) throw new NotFoundException(`Competition ${id} not found`);

    const { id: _id, createdBy: _cb, createdAt: _ca, ...safeUpdates } = updates as any;
    await this.repo.update(id, safeUpdates);
    return this.repo.findOne({ where: { id } });
  }

  async setApproval(
    id: string,
    approvalStatus: string,
    approvalUpdatedBy: string,
  ): Promise<CompetitionEntity> {
    await this.repo.update(id, {
      approvalStatus,
      approvalUpdatedBy,
      approvalUpdatedAt: new Date(),
    });
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  async seedDemoCompetitions(): Promise<void> {
    const demoComps = [
      {
        name: 'Global Masters',
        description: 'World-class League of Legends tournament for elite teams.',
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-14'),
        createdBy: 'admin@nexus.gg',
        extras: { game: 'League of Legends', type: 'league', location: 'Berlin, Germany', prizePool: '₹1,00,000', season: 'Season 2', format: 'Round Robin', maxTeams: 32, bannerColor: '#1a2e2e' },
      },
      {
        name: 'Pro Circuit Week 3',
        description: 'Fast-paced Counter-Strike 2 weekly competitive circuit.',
        startDate: new Date('2026-02-18'),
        endDate: new Date('2026-02-20'),
        createdBy: 'admin@nexus.gg',
        extras: { game: 'Counter-Strike 2', type: 'tournament', location: 'Online', prizePool: '₹75,000', season: 'Season 1', format: 'Single Elimination', maxTeams: 64, bannerColor: '#2e1a2e' },
      },
      {
        name: 'Champions League',
        description: 'Premier Rocket League competition across top teams.',
        startDate: new Date('2026-05-10'),
        endDate: new Date('2026-05-15'),
        createdBy: 'regular@nexus.gg',
        extras: { game: 'Rocket League', type: 'league', location: 'Sri City, India', prizePool: '₹35,000', season: 'Season 3', format: 'Round Robin', maxTeams: 24, bannerColor: '#1a2a1a' },
      },
      {
        name: 'Open Series #12',
        description: 'Dota 2 double elimination open to all skilled players.',
        startDate: new Date('2026-03-22'),
        endDate: new Date('2026-03-24'),
        createdBy: 'regular@nexus.gg',
        extras: { game: 'Dota 2', type: 'tournament', location: 'Online', prizePool: '₹18,000', season: 'Season 1', format: 'Double Elimination', maxTeams: 32, bannerColor: '#2a1a2e' },
      },
    ];

    for (const c of demoComps) {
      const existing = await this.repo.findOne({ where: { name: c.name } });
      if (!existing) {
        await this.create(c.name, c.description, c.startDate, c.endDate, c.createdBy, [], c.extras);
        console.log(`✓ Seeded competition: ${c.name}`);
      }
    }
  }
}
