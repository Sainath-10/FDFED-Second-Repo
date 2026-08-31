import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { CompetitionEntity } from '../../entities/competition.entity';
import { DisputeEntity } from '../../entities/dispute.entity';
import { AdminActivityLogEntity } from '../../entities/admin-activity-log.entity';
import { DisputeStatus } from '../../common/interfaces';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CompetitionEntity)
    private readonly compRepo: Repository<CompetitionEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(AdminActivityLogEntity)
    private readonly activityRepo: Repository<AdminActivityLogEntity>,
  ) {}

  async getAdminStats() {
    const totalUsers = await this.userRepo.count();
    const adminUsers = await this.userRepo.count({
      where: [
        { role: 'admin' as any },
        { role: 'super-admin' as any },
        { role: 'super_admin' as any },
      ],
    });
    const activeCompetitions = await this.compRepo.count({
      where: { status: 'active' },
    });
    const pendingApprovals = await this.compRepo.count({
      where: { approvalStatus: 'pending' },
    });
    const openDisputes = await this.disputeRepo.count({
      where: [
        { status: DisputeStatus.OPEN_ADMIN },
        { status: DisputeStatus.ESCALATED_TO_ADMIN },
        { status: DisputeStatus.OPEN_ORGANIZER },
      ],
    });

    return {
      totalUsers,
      adminUsers,
      activeCompetitions,
      pendingApprovals,
      openDisputes,
      systemStatus: 'ONLINE',
      uptimePercentage: 99.9,
    };
  }

  async getActivityLogs(adminUsername?: string) {
    const query = this.activityRepo.createQueryBuilder('log').orderBy('log.timestamp', 'DESC');

    if (adminUsername) {
      query.where('LOWER(log.adminUsername) = :user', { user: adminUsername.trim().toLowerCase() });
    }

    return await query.take(100).getMany();
  }

  async logActivity(adminUsername: string, actionType: string, details: string, metadata?: Record<string, any>) {
    const log = this.activityRepo.create({
      adminUsername: adminUsername || 'admin@nexus.gg',
      actionType,
      details,
      metadata: metadata || {},
    });
    return await this.activityRepo.save(log);
  }
}
