import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { RevenueConfigEntity } from '../../entities/revenue-config.entity';
import { RevenueTransactionEntity } from '../../entities/revenue-transaction.entity';

@Injectable()
export class RevenueService {
  constructor(
    @InjectRepository(RevenueConfigEntity)
    private readonly configRepo: Repository<RevenueConfigEntity>,
    @InjectRepository(RevenueTransactionEntity)
    private readonly transactionRepo: Repository<RevenueTransactionEntity>,
  ) {}

  async getConfig(): Promise<RevenueConfigEntity> {
    const configs = await this.configRepo.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    if (configs.length > 0) {
      return configs[0];
    }
    // Create default config if not seeded yet
    const defaultConfig = this.configRepo.create({
      percentage: 7,
      minCost: 50,
      updatedBy: 'system',
    });
    return await this.configRepo.save(defaultConfig);
  }

  async updateConfig(dto: { percentage: number; minCost: number; updatedBy?: string }): Promise<RevenueConfigEntity> {
    const percentage = Number(dto.percentage);
    const minCost = Number(dto.minCost);

    if (isNaN(percentage) || percentage < 0 || percentage >= 15) {
      throw new BadRequestException('Percentage from Prize Pool must be strictly less than 15%.');
    }
    if (isNaN(minCost) || minCost < 0 || minCost >= 100) {
      throw new BadRequestException('Minimum Cost to host a Competition must be strictly less than 100.');
    }

    const current = await this.getConfig();
    current.percentage = percentage;
    current.minCost = minCost;
    if (dto.updatedBy) {
      current.updatedBy = dto.updatedBy;
    }
    return await this.configRepo.save(current);
  }

  async getTransactions(query: {
    status?: string;
    dateFilter?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status && query.status !== 'all') {
      where.status = query.status.toUpperCase();
    }

    if (query.dateFilter && query.dateFilter !== 'all') {
      const now = new Date();
      if (query.dateFilter === 'Today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        where.date = MoreThanOrEqual(startOfDay);
      } else if (query.dateFilter === 'Last 7 Days') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        where.date = MoreThanOrEqual(d7);
      } else if (query.dateFilter === 'Last 30 Days') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        where.date = MoreThanOrEqual(d30);
      } else if (query.dateFilter === 'This Quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
        where.date = MoreThanOrEqual(startOfQuarter);
      }
    }

    const [items, total] = await this.transactionRepo.findAndCount({
      where,
      order: { date: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createTransaction(dto: {
    competitionId?: string;
    competitionName?: string;
    organizerName?: string;
    grossAmount?: number;
    status?: string;
  }): Promise<RevenueTransactionEntity> {
    const config = await this.getConfig();
    const gross = Number(dto.grossAmount || 0);
    const feePercentage = Math.round(gross * (config.percentage / 100));
    const platformFee = Math.max(config.minCost, feePercentage);
    const netPayout = Math.max(0, gross - platformFee);

    const tx = this.transactionRepo.create({
      competitionId: dto.competitionId || '',
      competitionName: dto.competitionName || 'Tournament',
      organizerName: dto.organizerName || 'organizer',
      grossAmount: gross,
      platformFee: platformFee,
      netPayout: netPayout,
      status: (dto.status || 'CONFIRMED').toUpperCase(),
      date: new Date(),
    });

    return await this.transactionRepo.save(tx);
  }
}
