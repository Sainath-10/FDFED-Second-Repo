import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
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
    // A malformed id cannot match a row; Postgres would otherwise reject it with a raw error.
    if (!isUUID(String(id || ''))) return null;
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
    // Exact membership (never a substring match): co-organisers see the same
    // reports queue as the creator, but an organiser named "bob" must not match
    // a competition organised by "bobby".
    return this.repo
      .createQueryBuilder('c')
      .where('c.createdBy = :userId', { userId })
      .orWhere(":userId = ANY(string_to_array(c.organizers, ','))", { userId })
      .orderBy('c.createdAt', 'DESC')
      .getMany();
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

  /**
   * Demo competitions are free, public and upcoming: registration is open
   * today, closes in ten days, and play starts two weeks out. They are
   * organized by a normal player account so staff never organize events.
   */
  async seedDemoCompetitions(): Promise<void> {
    const day = 86_400_000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const at = (days: number, endOfDay = false) => {
      const d = new Date(today.getTime() + days * day);
      if (endOfDay) d.setHours(23, 59, 59, 0);
      return d;
    };
    const demoComps = [
      {
        name: 'Global Masters',
        description: 'World-class League of Legends league for competitive teams.',
        game: 'League of Legends', type: 'league', format: 'Round Robin', location: 'Online', prize: 100000, maxTeams: 16, offset: 14, length: 4,
      },
      {
        name: 'Pro Circuit Week 3',
        description: 'Fast-paced Counter-Strike 2 single-elimination weekly circuit.',
        game: 'Counter-Strike 2', type: 'tournament', format: 'Single Elimination', location: 'Online', prize: 75000, maxTeams: 16, offset: 14, length: 1,
      },
      {
        name: 'Champions League',
        description: 'Premier Rocket League competition across top community teams.',
        game: 'Rocket League', type: 'league', format: 'Round Robin', location: 'Sri City, India', prize: 35000, maxTeams: 12, offset: 21, length: 5,
      },
      {
        name: 'Open Series #12',
        description: 'Dota 2 single-elimination open to all skilled players.',
        game: 'Dota 2', type: 'tournament', format: 'Single Elimination', location: 'Online', prize: 18000, maxTeams: 16, offset: 21, length: 2,
      },
    ];

    for (const c of demoComps) {
      const existing = await this.repo.findOne({ where: { name: c.name } });
      if (existing) continue;
      const startDate = at(c.offset);
      await this.create(c.name, c.description, startDate, at(c.offset + c.length - 1, true), 'regular', [], {
        game: c.game,
        type: c.type,
        format: c.format,
        location: c.location,
        prize: c.prize,
        prizePool: `₹${c.prize.toLocaleString('en-IN')}`,
        maxTeams: c.maxTeams,
        maxPlayersPerTeam: 5,
        feeType: 'free',
        entryFeeAmount: 0,
        entryFee: 'Free',
        visibility: 'public',
        registrationOpenAt: today,
        registrationCloseAt: at(c.offset - 4, true),
        organizerPaid: true,
        paymentStatus: 'LEGACY',
        status: 'active',
      });
      console.log(`Seeded competition: ${c.name}`);
    }
  }
}
