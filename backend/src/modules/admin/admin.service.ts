import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';
import { CompetitionEntity } from '../../entities/competition.entity';
import { DisputeEntity } from '../../entities/dispute.entity';
import { TeamEntity } from '../../entities/team.entity';
import { AdminActivityLogEntity } from '../../entities/admin-activity-log.entity';
import { AuditLogEntity } from '../../entities/audit-log.entity';
import { PlatformSettingEntity } from '../../entities/platform-setting.entity';
import { DisputeStatus } from '../../common/interfaces';
import { isUnpublished } from '../../common/validation/competition.rules';

/** Platform switches a Super Admin can change. Stored server-side so they apply to every user. */
export interface PlatformSettings {
  allowKnockout: boolean;
  allowRoundRobin: boolean;
  maxTeams: number;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  allowKnockout: true,
  allowRoundRobin: true,
  maxTeams: 256,
};

const SETTING_KEYS: Record<keyof PlatformSettings, string> = {
  allowKnockout: 'format_knockout_enabled',
  allowRoundRobin: 'format_round_robin_enabled',
  maxTeams: 'competition_max_teams',
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CompetitionEntity)
    private readonly compRepo: Repository<CompetitionEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,
    @InjectRepository(AdminActivityLogEntity)
    private readonly activityRepo: Repository<AdminActivityLogEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    @InjectRepository(PlatformSettingEntity)
    private readonly settingsRepo: Repository<PlatformSettingEntity>,
  ) {}

  async getAdminStats() {
    const users = await this.userRepo.find();
    const competitions = await this.compRepo.find({
      select: { id: true, status: true, paymentStatus: true, approvalStatus: true, prize: true },
    });
    const openDisputes = await this.disputeRepo.count({
      where: [
        { status: DisputeStatus.OPEN_ADMIN },
        { status: DisputeStatus.ESCALATED_TO_ADMIN },
        { status: DisputeStatus.OPEN_ORGANIZER },
        { status: DisputeStatus.UNDER_REVIEW },
      ],
    });
    const teams = await this.teamRepo.count();
    const staffRoles = new Set(['super_admin', 'finance_moderator', 'community_moderator']);
    const published = competitions.filter((c) => !isUnpublished(c) && c.paymentStatus !== 'EXPIRED');
    const live = published.filter((c) => !['completed', 'cancelled'].includes(String(c.status)));

    return {
      totalUsers: users.length,
      bannedUsers: users.filter((u) => u.banned).length,
      adminUsers: users.filter((u) => staffRoles.has(String(u.role)) || !!u.adminType).length,
      totalCompetitions: published.length,
      activeCompetitions: live.length,
      completedCompetitions: published.filter((c) => c.status === 'completed').length,
      pendingApprovals: competitions.filter((c) => c.approvalStatus === 'pending').length,
      totalTeams: teams,
      openDisputes,
      totalPrizePool: published.reduce((sum, c) => sum + (Number(c.prize) || 0), 0),
      systemStatus: 'ONLINE',
    };
  }

  /**
   * Admin activity: the explicit admin log plus the workflow audit trail, newest first.
   * A finance moderator only sees their own entries.
   */
  async getActivityLogs(adminUsername?: string) {
    const name = adminUsername?.trim().toLowerCase();
    const logQuery = this.activityRepo.createQueryBuilder('log').orderBy('log.timestamp', 'DESC').take(200);
    const auditQuery = this.auditRepo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(200);
    if (name) {
      logQuery.where('LOWER(log.adminUsername) = :user', { user: name });
      auditQuery.where('LOWER(a.actor) = :user', { user: name });
    }
    const [logs, audits] = await Promise.all([logQuery.getMany(), auditQuery.getMany()]);
    const merged = [
      ...logs.map((l) => ({
        id: l.id,
        adminUsername: l.adminUsername,
        actionType: l.actionType,
        details: l.details,
        metadata: l.metadata || {},
        timestamp: l.timestamp,
        source: 'admin',
      })),
      ...audits.map((a) => ({
        id: a.id,
        adminUsername: a.actor,
        actionType: a.actionType,
        details: a.details || '',
        metadata: { ...(a.metadata || {}), entityType: a.entityType, entityId: a.entityId },
        timestamp: a.createdAt,
        source: 'audit',
      })),
    ];
    return merged.sort((x, y) => +new Date(y.timestamp) - +new Date(x.timestamp)).slice(0, 200);
  }

  async logActivity(adminUsername: string, actionType: string, details: string, metadata?: Record<string, any>) {
    const log = this.activityRepo.create({
      adminUsername,
      actionType,
      details,
      metadata: metadata || {},
    });
    return await this.activityRepo.save(log);
  }

  async getPlatformSettings(): Promise<PlatformSettings> {
    const rows = await this.settingsRepo.find();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const bool = (key: string, fallback: boolean) => (byKey.has(key) ? byKey.get(key) === 'true' : fallback);
    const maxTeams = Number(byKey.get(SETTING_KEYS.maxTeams));
    return {
      allowKnockout: bool(SETTING_KEYS.allowKnockout, DEFAULT_PLATFORM_SETTINGS.allowKnockout),
      allowRoundRobin: bool(SETTING_KEYS.allowRoundRobin, DEFAULT_PLATFORM_SETTINGS.allowRoundRobin),
      maxTeams: Number.isInteger(maxTeams) && maxTeams >= 2 ? maxTeams : DEFAULT_PLATFORM_SETTINGS.maxTeams,
    };
  }

  async updatePlatformSettings(updates: Partial<PlatformSettings>, actor: string): Promise<PlatformSettings> {
    for (const [field, key] of Object.entries(SETTING_KEYS) as [keyof PlatformSettings, string][]) {
      if (updates[field] === undefined) continue;
      await this.settingsRepo.save(this.settingsRepo.create({ key, value: String(updates[field]), updatedBy: actor }));
    }
    const next = await this.getPlatformSettings();
    await this.logActivity(actor, 'PLATFORM_SETTINGS_CHANGED', 'Platform settings updated.', { ...next });
    return next;
  }
}
